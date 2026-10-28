import inspect

import numpy as np
import pandas as pd
import pytest
from scipy import sparse
from sklearn.preprocessing import OneHotEncoder

from src.evaluation.metrics import RegressionMetrics
from src.models.linear import (
    CATEGORICAL_FEATURES,
    MODEL_FEATURES,
    NUMERIC_FEATURES,
    ModelCandidate,
    RIDGE_ALPHAS,
    build_linear_pipeline,
    build_ridge_pipeline,
    evaluate_validation_candidates,
    fit_selected_model,
    select_model_features,
    select_validation_candidate,
)


def feature_frame(rows=8, *, start_index=0, town="TOWN"):
    index = range(start_index, start_index + rows)
    frame = pd.DataFrame(index=index)
    frame["transaction_year"] = 2018 + np.arange(rows) % 5
    frame["transaction_month"] = 1 + np.arange(rows) % 12
    frame["floor_area_sqm"] = 65.0 + np.arange(rows)
    frame["storey_mid"] = 2.0 + np.arange(rows) % 6
    frame["remaining_lease_months"] = 600 - np.arange(rows) * 3
    frame["town"] = [town] * rows
    frame["flat_type"] = ["3 ROOM", "4 ROOM"] * (rows // 2) + (["3 ROOM"] if rows % 2 else [])
    frame["block"] = [f"{100 + i}" for i in range(rows)]
    frame["street_name"] = [f"ROAD {i % 3}" for i in range(rows)]
    frame["flat_model"] = ["Model A", "Improved"] * (rows // 2) + (["Model A"] if rows % 2 else [])
    return frame


def metrics(mae, rmse, median_ae):
    return RegressionMetrics(mae, rmse, None, None, median_ae, 2, 1.0, 1.0)


def candidate(name, alpha, mae, rmse, median_ae):
    return ModelCandidate(name, alpha, metrics(mae, rmse, median_ae), pd.Series([0.0, 0.0]))


def test_model_feature_schema_is_fixed_and_excludes_redundant_fields():
    source = feature_frame()
    source["storey_low"] = 1
    source["storey_high"] = 3
    source["lease_commence_date"] = 1980

    selected = select_model_features(source)

    assert tuple(selected.columns) == MODEL_FEATURES
    assert tuple(selected.columns[:5]) == NUMERIC_FEATURES
    assert tuple(selected.columns[5:]) == CATEGORICAL_FEATURES
    assert "resale_price" not in selected


def test_target_column_is_rejected_and_missing_base_features_fail_clearly():
    source = feature_frame()
    source["resale_price"] = 400000
    with pytest.raises(ValueError, match="must not contain resale_price"):
        select_model_features(source)

    with pytest.raises(ValueError, match="remaining_lease_months"):
        select_model_features(feature_frame().drop(columns="remaining_lease_months"))


def test_pipeline_keeps_ohe_sparse_and_unknown_categories_do_not_crash():
    train = feature_frame()
    pipeline = build_linear_pipeline().fit(train, pd.Series(np.arange(len(train)) * 1000.0))
    transformer = pipeline.named_steps["preprocessor"]
    encoded = transformer.transform(select_model_features(train))
    encoder = transformer.named_transformers_["categorical"]

    assert sparse.issparse(encoded)
    assert isinstance(encoder, OneHotEncoder)
    assert encoder.handle_unknown == "ignore"
    assert encoder.sparse_output is True
    changed = feature_frame(2, start_index=20, town="UNSEEN TOWN")
    assert np.isfinite(pipeline.predict(select_model_features(changed))).all()


def test_validation_candidates_fit_vocabulary_and_scaling_on_train_only():
    train = feature_frame(8)
    validation = feature_frame(3, start_index=100, town="VALIDATION ONLY")
    y_train = pd.Series(np.arange(8) * 10000.0 + 250000, index=train.index)
    y_validation = pd.Series([300000.0, 350000.0, 400000.0], index=validation.index)

    results = evaluate_validation_candidates(train, y_train, validation, y_validation, alphas=(1.0,))
    linear = results[0]
    fitted = linear.pipeline
    assert fitted is not None
    encoder = fitted.named_steps["preprocessor"].named_transformers_["categorical"]
    assert "VALIDATION ONLY" not in encoder.categories_[0]
    scaler = fitted.named_steps["preprocessor"].named_transformers_["numeric"]
    np.testing.assert_allclose(scaler.mean_, train.loc[:, NUMERIC_FEATURES].mean().to_numpy())
    assert list(linear.predictions.index) == list(validation.index)


def test_validation_target_changes_metrics_but_not_fitted_preprocessing_or_coefficients():
    train = feature_frame(8)
    validation = feature_frame(3, start_index=100, town="VALIDATION ONLY")
    y_train = pd.Series(np.arange(8) * 10000.0 + 250000, index=train.index)
    y_validation = pd.Series([300000.0, 350000.0, 400000.0], index=validation.index)
    changed_validation_target = y_validation + 200000

    first = evaluate_validation_candidates(train, y_train, validation, y_validation, alphas=(1.0,))
    second = evaluate_validation_candidates(
        train, y_train, validation, changed_validation_target, alphas=(1.0,)
    )

    for left, right in zip(first, second):
        np.testing.assert_allclose(
            left.pipeline.named_steps["regressor"].coef_,
            right.pipeline.named_steps["regressor"].coef_,
        )
        assert left.metrics.mae_sgd != right.metrics.mae_sgd


def test_final_fit_takes_only_train_validation_rows_and_isolated_from_test_targets():
    history = feature_frame(8)
    history_target = pd.Series(np.arange(8) * 10000.0 + 250000, index=history.index)
    validation_rows = feature_frame(2, start_index=50, town="VALIDATION ONLY")
    validation_target = pd.Series([320000.0, 360000.0], index=validation_rows.index)
    test_rows = feature_frame(2, start_index=100, town="TEST ONLY")
    test_target = pd.Series([350000.0, 400000.0], index=test_rows.index)
    candidate_result = evaluate_validation_candidates(
        history, history_target, validation_rows, validation_target, alphas=(1.0,)
    )[0]

    final_one = fit_selected_model(candidate_result, history, history_target)
    predictions_before_target_change = final_one.predict(select_model_features(test_rows))
    changed_test_target = test_target + 1000000
    final_two = fit_selected_model(candidate_result, history, history_target)

    np.testing.assert_allclose(
        final_one.named_steps["regressor"].coef_,
        final_two.named_steps["regressor"].coef_,
    )
    assert final_one.named_steps["preprocessor"].named_transformers_["numeric"].n_samples_seen_ == len(history)
    encoder = final_one.named_steps["preprocessor"].named_transformers_["categorical"]
    assert "TEST ONLY" not in encoder.categories_[0]
    assert changed_test_target.index.equals(test_target.index)
    np.testing.assert_allclose(
        predictions_before_target_change,
        final_two.predict(select_model_features(test_rows)),
    )
    assert list(inspect.signature(fit_selected_model).parameters) == [
        "candidate", "X_training", "y_training"
    ]


def test_validation_evaluation_is_deterministic_for_fixed_inputs():
    train = feature_frame(8)
    validation = feature_frame(3, start_index=100, town="VALIDATION ONLY")
    y_train = pd.Series(np.arange(8) * 10000.0 + 250000, index=train.index)
    y_validation = pd.Series([300000.0, 350000.0, 400000.0], index=validation.index)

    first = evaluate_validation_candidates(train, y_train, validation, y_validation, alphas=(1.0,))
    second = evaluate_validation_candidates(train, y_train, validation, y_validation, alphas=(1.0,))

    for left, right in zip(first, second):
        pd.testing.assert_series_equal(left.predictions, right.predictions)
        assert left.metrics == right.metrics


def test_default_alpha_grid_is_small_and_explicit():
    assert RIDGE_ALPHAS == (0.1, 1.0, 10.0, 100.0)
    assert build_ridge_pipeline(10.0).named_steps["regressor"].solver == "lsqr"


def test_validation_selector_uses_one_percent_tie_band_then_metrics_and_simplicity():
    linear = candidate("linear", None, 100.0, 120.0, 80.0)
    ridge = candidate("ridge", 10.0, 100.9, 110.0, 70.0)
    outside_band = candidate("ridge", 100.0, 101.1, 1.0, 1.0)

    assert select_validation_candidate([linear, ridge, outside_band]) is ridge
    assert select_validation_candidate([linear, candidate("ridge", 1.0, 100.0, 120.0, 80.0)]) is linear


def test_zero_mae_requires_exact_tie_and_ridge_alpha_ties_are_stable():
    perfect = candidate("ridge", 1.0, 0.0, 0.0, 0.0)
    nearly_perfect = candidate("linear", None, 0.001, 0.0, 0.0)
    assert select_validation_candidate([perfect, nearly_perfect]) is perfect
    assert select_validation_candidate(
        [candidate("ridge", 10.0, 5, 5, 5), candidate("ridge", 1.0, 5, 5, 5)]
    ).alpha == 1.0
