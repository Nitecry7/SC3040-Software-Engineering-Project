import inspect

import numpy as np
import pandas as pd
import pytest
from scipy import sparse
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import StandardScaler

from src.evaluation.metrics import RegressionMetrics
from src.models.linear import CATEGORICAL_FEATURES, MODEL_FEATURES, NUMERIC_FEATURES
from src.models.tree import (
    HISTOGRAM_FEATURES,
    HISTOGRAM_CATEGORICAL_FEATURES,
    TrainCategoryFramePreprocessor,
    TreeModelConfig,
    TreeValidationResult,
    aggregate_tree_feature_importances,
    build_tree_pipeline,
    evaluate_tree_validation_candidates,
    fit_selected_tree_model,
    select_tree_candidate,
    select_tree_features,
    tree_configurations,
)
from src.preprocessing.base import prepare_features
from src.splitting.chronological import split_chronologically


def feature_frame(rows=8, *, start_index=0, town="TOWN"):
    index = range(start_index, start_index + rows)
    frame = pd.DataFrame(index=index)
    frame["transaction_year"] = 2018 + np.arange(rows) % 5
    frame["transaction_month"] = 1 + np.arange(rows) % 12
    frame["floor_area_sqm"] = 65.0 + np.arange(rows)
    frame["storey_mid"] = 2.0 + np.arange(rows) % 6
    frame["remaining_lease_months"] = 600 - np.arange(rows) * 3
    frame["town"] = [town] * rows
    frame["flat_type"] = (["3 ROOM", "4 ROOM"] * rows)[:rows]
    frame["block"] = [f"{100 + i}" for i in range(rows)]
    frame["street_name"] = [f"ROAD {i % 3}" for i in range(rows)]
    frame["flat_model"] = (["Model A", "Improved"] * rows)[:rows]
    return frame


def target_for(features):
    return pd.Series(250000.0 + np.arange(len(features)) * 12000.0, index=features.index)


def test_tree_schemas_exclude_target_derived_and_keep_deterministic_columns():
    source = feature_frame()
    source["price_per_sqm"] = 4000.0

    forest_features = select_tree_features(source, "extra_trees")
    hist_features = select_tree_features(source, "hist_gradient_boosting")

    assert tuple(forest_features.columns) == MODEL_FEATURES
    assert tuple(hist_features.columns) == HISTOGRAM_FEATURES
    assert "resale_price" not in forest_features
    assert "price_per_sqm" not in forest_features
    assert "block" not in hist_features and "street_name" not in hist_features
    assert tuple(HISTOGRAM_CATEGORICAL_FEATURES) == ("town", "flat_type", "flat_model")
    with pytest.raises(ValueError, match="must not contain resale_price"):
        select_tree_features(source.assign(resale_price=300000), "random_forest")


def test_search_has_six_fixed_deterministic_configurations():
    configurations = tree_configurations()

    assert len(configurations) == 6
    assert [config.family for config in configurations].count("extra_trees") == 2
    assert [config.family for config in configurations].count("random_forest") == 2
    assert [config.family for config in configurations].count("hist_gradient_boosting") == 2
    assert {config.parameters["random_state"] for config in configurations} == {42}
    assert {config.min_samples_leaf for config in configurations[:4]} == {2, 10}
    assert {config.max_iter for config in configurations[4:]} == {100, 200}


def test_forest_pipeline_uses_sparse_one_hot_and_no_numeric_scaling():
    features = select_tree_features(feature_frame(), "extra_trees")
    target = target_for(features)
    pipeline = build_tree_pipeline(tree_configurations()[0]).fit(features, target)
    transformed = pipeline.named_steps["preprocessor"].transform(features)

    assert sparse.issparse(transformed)
    assert not isinstance(
        pipeline.named_steps["preprocessor"].named_transformers_["numeric"], StandardScaler
    )
    assert isinstance(pipeline.named_steps["regressor"], ExtraTreesRegressor)
    assert pipeline.named_steps["regressor"].random_state == 42
    assert np.isfinite(pipeline.predict(features)).all()


def test_random_forest_pipeline_uses_fixed_seed():
    pipeline = build_tree_pipeline(tree_configurations()[2])
    estimator = pipeline.named_steps["regressor"]
    assert isinstance(estimator, RandomForestRegressor)
    assert estimator.random_state == 42
    assert estimator.n_jobs == -1


def test_fixed_seed_tree_predictions_are_reproducible():
    features = select_tree_features(feature_frame(12), "extra_trees")
    target = target_for(features)
    config = tree_configurations()[0]

    first = build_tree_pipeline(config).fit(features, target)
    second = build_tree_pipeline(config).fit(features, target)

    np.testing.assert_array_equal(first.predict(features), second.predict(features))


def test_histogram_categories_are_learned_from_training_and_unknowns_become_missing():
    train = select_tree_features(feature_frame(8), "hist_gradient_boosting")
    validation = select_tree_features(
        feature_frame(2, start_index=50, town="VALIDATION ONLY"),
        "hist_gradient_boosting",
    )
    preprocessor = TrainCategoryFramePreprocessor().fit(train)
    transformed = preprocessor.transform(validation)

    assert tuple(preprocessor.get_feature_names_out()) == HISTOGRAM_FEATURES
    assert "VALIDATION ONLY" not in preprocessor.categories_["town"]
    assert transformed["town"].isna().all()
    assert isinstance(transformed["town"].dtype, pd.CategoricalDtype)


def test_histogram_pipeline_supports_native_categories_and_unseen_validation_categories():
    train = select_tree_features(feature_frame(12), "hist_gradient_boosting")
    validation = select_tree_features(
        feature_frame(2, start_index=50, town="UNSEEN"), "hist_gradient_boosting"
    )
    pipeline = build_tree_pipeline(tree_configurations()[4]).fit(train, target_for(train))
    predictions = pipeline.predict(validation)

    assert isinstance(pipeline.named_steps["regressor"], HistGradientBoostingRegressor)
    assert pipeline.named_steps["regressor"].categorical_features == "from_dtype"
    assert np.isfinite(predictions).all()


def test_validation_target_changes_do_not_change_fitted_pipeline_or_predictions():
    train = select_tree_features(feature_frame(12), "hist_gradient_boosting")
    validation = select_tree_features(
        feature_frame(3, start_index=50, town="VALIDATION ONLY"),
        "hist_gradient_boosting",
    )
    y_train = target_for(train)
    y_validation = target_for(validation)
    config = tree_configurations()[4]

    first = evaluate_tree_validation_candidates(
        train, y_train, validation, y_validation, (config,)
    )[0]
    second = evaluate_tree_validation_candidates(
        train, y_train, validation, y_validation + 300000, (config,)
    )[0]

    np.testing.assert_allclose(first.predictions, second.predictions)
    assert first.metrics.mae_sgd != second.metrics.mae_sgd
    assert first.pipeline.named_steps["preprocessor"].categories_ == second.pipeline.named_steps[
        "preprocessor"
    ].categories_


def test_final_refit_receives_only_history_and_ignores_test_only_categories():
    train = select_tree_features(feature_frame(8), "hist_gradient_boosting")
    validation = select_tree_features(
        feature_frame(2, start_index=30, town="VALIDATION"), "hist_gradient_boosting"
    )
    test = select_tree_features(
        feature_frame(2, start_index=60, town="TEST ONLY"), "hist_gradient_boosting"
    )
    history = pd.concat([train, validation])
    history_target = pd.concat([target_for(train), target_for(validation)])
    config = tree_configurations()[4]

    model = fit_selected_tree_model(config, history, history_target)
    prediction_before_test_target_change = model.predict(test)
    changed_test_target = pd.Series([90000000.0, 1.0], index=test.index)
    second_model = fit_selected_tree_model(config, history, history_target)

    assert "VALIDATION" in second_model.named_steps["preprocessor"].categories_["town"]
    assert "TEST ONLY" not in second_model.named_steps["preprocessor"].categories_["town"]
    np.testing.assert_allclose(prediction_before_test_target_change, second_model.predict(test))
    assert changed_test_target.index.equals(test.index)
    assert list(inspect.signature(fit_selected_tree_model).parameters) == [
        "config", "X_training", "y_training"
    ]


def test_model_selection_uses_only_validation_results_and_one_percent_band():
    metrics = lambda mae, rmse, median_ae, mape: RegressionMetrics(
        mae, rmse, mape, None, median_ae, 2, 1.0, 1.0
    )
    results = []
    configs = tree_configurations()[:3]
    for config, score in zip(configs, ((100.0, 120.0, 80.0, 5.0), (100.8, 110.0, 70.0, 4.0), (101.2, 1.0, 1.0, 1.0))):
        results.append(
            TreeValidationResult(
                config,
                metrics(*score),
                pd.Series([1.0, 2.0]),
                build_tree_pipeline(config),
                1.0,
                0.1,
                (2, 5),
                "csr",
                100,
            )
        )

    assert select_tree_candidate(results).config == configs[1]
    assert list(inspect.signature(select_tree_candidate).parameters) == ["results"]


def test_tree_selection_requires_exact_mae_tie_when_best_mae_is_zero():
    config = tree_configurations()[0]
    result = TreeValidationResult(
        config,
        RegressionMetrics(0, 0, 0, None, 0, 2, 1, 1),
        pd.Series([1.0, 2.0]),
        build_tree_pipeline(config),
        0.1,
        0.1,
        (2, 3),
        "csr",
        64,
    )
    near = TreeValidationResult(
        tree_configurations()[1],
        RegressionMetrics(0.01, 0, 0, None, 0, 2, 1, 1),
        pd.Series([1.0, 2.0]),
        build_tree_pipeline(tree_configurations()[1]),
        0.1,
        0.1,
        (2, 3),
        "csr",
        64,
    )

    assert select_tree_candidate([result, near]) is result


def test_tree_feature_importances_aggregate_one_hot_values_to_source_features():
    features = select_tree_features(feature_frame(12), "extra_trees")
    pipeline = build_tree_pipeline(tree_configurations()[0]).fit(features, target_for(features))

    aggregated = aggregate_tree_feature_importances(pipeline)

    assert aggregated is not None
    assert set(aggregated).issubset(set(MODEL_FEATURES))
    assert sum(aggregated.values()) == pytest.approx(1.0)


def test_partial_period_is_not_in_validation_or_test():
    raw = pd.DataFrame(
        {
            "month": ["2024-12", "2025-01", "2026-01", "2026-10"],
            "town": ["A"] * 4,
            "flat_type": ["3 ROOM"] * 4,
            "block": ["1"] * 4,
            "street_name": ["ROAD"] * 4,
            "storey_range": ["01 TO 03"] * 4,
            "floor_area_sqm": [67.0] * 4,
            "flat_model": ["Model A"] * 4,
            "lease_commence_date": [1980] * 4,
            "remaining_lease": ["60 years"] * 4,
            "resale_price": [300000.0, 400000.0, 500000.0, 600000.0],
        }
    )
    prepared = prepare_features(raw)
    partitions = split_chronologically(
        prepared.features, prepared.target, prepared.transaction_period
    )

    assert len(partitions.validation.features) == 1
    assert len(partitions.test.features) == 1
    assert len(partitions.current_partial_period.features) == 1
    assert "2026-10" not in partitions.test.transaction_period.astype(str).tolist()
