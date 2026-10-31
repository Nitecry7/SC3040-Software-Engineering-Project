import numpy as np
import pandas as pd
import pytest

from src.evaluation.metrics import RegressionMetrics
from src.models.boosted import (
    BOOSTED_FEATURES,
    CATEGORICAL_FEATURES,
    BoostedModelConfig,
    BoostedValidationResult,
    TrainCategoryPreprocessor,
    _ordered_rows,
    build_boosted_estimator,
    boosted_configurations,
    evaluate_boosted_candidates,
    fit_selected_boosted_model,
    prepare_catboost_features,
    select_boosted_candidate,
    select_boosted_features,
)


def feature_frame(rows=8, *, start_index=0, town="TOWN"):
    frame = pd.DataFrame(index=range(start_index, start_index + rows))
    frame["transaction_year"] = 2020
    frame["transaction_month"] = 1 + np.arange(rows) % 12
    frame["floor_area_sqm"] = 65.0 + np.arange(rows)
    frame["storey_mid"] = 2.0 + np.arange(rows) % 6
    frame["remaining_lease_months"] = 600 - np.arange(rows) * 3
    frame["town"] = town
    frame["flat_type"] = ["3 ROOM", "4 ROOM"] * (rows // 2) + (["3 ROOM"] if rows % 2 else [])
    frame["block"] = [str(100 + i) for i in range(rows)]
    frame["street_name"] = [f"ROAD {i % 3}" for i in range(rows)]
    frame["flat_model"] = ["Model A", "Improved"] * (rows // 2) + (["Model A"] if rows % 2 else [])
    return frame.loc[:, BOOSTED_FEATURES]


def validation_result(config, mae, rmse, median=10.0, best_iteration=2):
    metrics = RegressionMetrics(mae, rmse, 4.0, 0.9, median, 2, 100.0, 101.0)
    return BoostedValidationResult(
        config, metrics, pd.Series([1.0, 2.0]), best_iteration, mae, 1.0, 0.1, 100
    )


def test_boosted_schema_is_fixed_and_rejects_target_leakage():
    source = feature_frame()
    source["storey_low"] = 1
    source["storey_high"] = 3
    assert tuple(select_boosted_features(source).columns) == BOOSTED_FEATURES
    with pytest.raises(ValueError, match="must not contain resale_price"):
        select_boosted_features(source.assign(resale_price=500000))
    with pytest.raises(ValueError, match="target-derived price_per_sqm"):
        select_boosted_features(source.assign(price_per_sqm=123.0))


def test_eight_fixed_configurations_and_device_parameters():
    configs = boosted_configurations()
    assert len(configs) == 8
    assert {item.config_id for item in configs}
    for config in configs:
        assert config.parameters_for("cpu")["random_seed" if config.family == "catboost" else "random_state"] == 42
        gpu_params = config.parameters_for("gpu")
        if config.family == "catboost":
            assert gpu_params["task_type"] == "GPU" and gpu_params["devices"] == "0"
        else:
            assert gpu_params["device"] == "cuda"
            assert gpu_params["enable_categorical"] is True


def test_xgboost_category_vocabularies_are_fit_only_from_training_rows():
    train = feature_frame(4)
    validation = feature_frame(2, start_index=20, town="VALIDATION ONLY")
    preprocessor = TrainCategoryPreprocessor().fit(train)
    transformed = preprocessor.transform(validation)
    assert tuple(transformed.columns) == BOOSTED_FEATURES
    assert "VALIDATION ONLY" not in preprocessor.categories_["town"]
    assert transformed["town"].isna().all()
    assert isinstance(transformed["town"].dtype, pd.CategoricalDtype)


def test_catboost_receives_native_categories_and_unseen_values():
    source = feature_frame(2, town="UNSEEN")
    prepared = prepare_catboost_features(source)
    assert tuple(prepared.columns) == BOOSTED_FEATURES
    assert all(prepared[column].dtype == object for column in CATEGORICAL_FEATURES)
    assert prepared["town"].tolist() == ["UNSEEN", "UNSEEN"]


def test_fit_rows_are_stably_sorted_by_transaction_month_and_keep_source_indices():
    source = feature_frame(4, start_index=50)
    source["transaction_month"] = [3, 1, 1, 2]
    target = pd.Series([30, 10, 11, 20], index=source.index)
    ordered_features, ordered_target = _ordered_rows(source, target)
    assert list(ordered_features.index) == [51, 52, 53, 50]
    assert ordered_target.tolist() == [10, 11, 20, 30]


def test_cpu_estimators_fit_small_data_and_predict():
    features = feature_frame(8)
    target = pd.Series(np.arange(8, dtype=float) * 1000 + 200000, index=features.index)
    for config in (boosted_configurations()[0], boosted_configurations()[4]):
        model = build_boosted_estimator(config, device="cpu", iterations=2)
        if config.family == "catboost":
            prepared = prepare_catboost_features(features)
            model.fit(prepared, target, cat_features=list(CATEGORICAL_FEATURES), verbose=False)
            predictions = model.predict(prepared)
        else:
            prep = TrainCategoryPreprocessor().fit(features)
            prepared = prep.transform(features)
            model.fit(prepared, target, verbose=False)
            predictions = model.predict(prepared)
        assert np.isfinite(predictions).all()


def test_selector_uses_validation_metrics_and_configured_one_percent_band():
    configs = boosted_configurations()
    best = validation_result(configs[0], 100.0, 30.0)
    within_band_better_rmse = validation_result(configs[1], 100.5, 20.0)
    outside_band = validation_result(configs[2], 101.1, 1.0)
    assert select_boosted_candidate([best, within_band_better_rmse, outside_band]) is within_band_better_rmse


def test_selector_zero_mae_band_requires_exact_equality():
    configs = boosted_configurations()
    zero = validation_result(configs[0], 0.0, 0.0)
    positive = validation_result(configs[1], 0.001, 0.0)
    assert select_boosted_candidate([zero, positive]) is zero


def test_final_fit_uses_only_supplied_rows_and_freezes_best_round_count():
    config = boosted_configurations()[0]
    selected = validation_result(config, 100.0, 20.0, best_iteration=1)
    features = feature_frame(8)
    target = pd.Series(np.arange(8, dtype=float) * 5000 + 200000, index=features.index)
    fitted = fit_selected_boosted_model(selected, features.iloc[:6], target.iloc[:6], device="cpu")
    assert fitted.iterations == 2
    assert fitted.estimator.tree_count_ == 2
    with pytest.raises(ValueError, match="must not contain resale_price"):
        fit_selected_boosted_model(
            selected,
            features.iloc[:6].assign(resale_price=target.iloc[:6]),
            target.iloc[:6],
            device="cpu",
        )


def test_validation_labels_are_only_passed_as_evaluation_data(monkeypatch):
    import src.models.boosted as boosted

    observed = {}

    class FitSpy:
        def fit(self, features, target, *, cat_features, eval_set, verbose):
            observed["fit_target"] = target.copy()
            observed["validation_target"] = eval_set[1].copy()
            self.feature_names_ = list(features.columns)
            return self

        def get_best_iteration(self):
            return 0

        def get_best_score(self):
            return {"validation": {"MAE": 10.0}}

        def predict(self, features):
            return np.full(len(features), 200000.0)

    monkeypatch.setattr(boosted, "build_boosted_estimator", lambda *args, **kwargs: FitSpy())
    monkeypatch.setattr(boosted, "_serialize_model_size", lambda *args: 1)
    train = feature_frame(3)
    validation = feature_frame(2, start_index=20, town="VAL ONLY")
    y_train = pd.Series([100000.0, 200000.0, 300000.0], index=train.index)
    y_validation = pd.Series([250000.0, 350000.0], index=validation.index)
    evaluate_boosted_candidates(
        train,
        y_train,
        validation,
        y_validation,
        configurations=(boosted_configurations()[0],),
        device="cpu",
    )
    pd.testing.assert_series_equal(observed["fit_target"], y_train)
    pd.testing.assert_series_equal(observed["validation_target"], y_validation)


def test_selection_interface_has_no_test_result_parameter():
    import inspect

    assert tuple(inspect.signature(select_boosted_candidate).parameters) == ("results",)
