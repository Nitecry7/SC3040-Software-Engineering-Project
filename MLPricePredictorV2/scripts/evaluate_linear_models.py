"""Evaluate leakage-safe Linear and Ridge regression on chronological HDB data."""

from functools import partial
from pathlib import Path
import sys
from time import perf_counter

import numpy as np
import pandas as pd
from scipy import sparse
import sklearn

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.baselines.comparable_sales import ComparableConfig, predict_comparable_sales  # noqa: E402
from src.data.load import find_raw_csv, load_resale_data  # noqa: E402
from src.data.validate import validate_required_columns  # noqa: E402
from src.evaluation.diagnostics import summarize_predictions  # noqa: E402
from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics  # noqa: E402
from src.evaluation.walk_forward import evaluate_walk_forward  # noqa: E402
from src.models.linear import (  # noqa: E402
    CATEGORICAL_FEATURES,
    MODEL_FEATURES,
    NUMERIC_FEATURES,
    evaluate_validation_candidates,
    fit_selected_model,
    select_model_features,
    select_validation_candidate,
)
from src.preprocessing.base import prepare_features  # noqa: E402
from src.splitting.chronological import DataPartition, split_chronologically  # noqa: E402

COMPARABLE_REFERENCE = ComparableConfig(
    lookback_months=12,
    minimum_comparables=5,
    maximum_comparables=30,
    floor_area_tolerance_sqm=15.0,
    storey_mid_tolerance=6.0,
    remaining_lease_tolerance_months=60,
)


def _metric_line(label: str, metrics: RegressionMetrics) -> str:
    mape = "undefined" if metrics.mape_percent is None else f"{metrics.mape_percent:.2f}%"
    r_squared = "undefined" if metrics.r_squared is None else f"{metrics.r_squared:.4f}"
    return (
        f"{label}: n={metrics.prediction_count:,}, MAE=${metrics.mae_sgd:,.2f}, "
        f"RMSE=${metrics.rmse_sgd:,.2f}, MAPE={mape}, R2={r_squared}, "
        f"median AE=${metrics.median_absolute_error_sgd:,.2f}, "
        f"mean actual=${metrics.mean_actual_sgd:,.2f}, "
        f"mean predicted=${metrics.mean_predicted_sgd:,.2f}"
    )


def _partition_frame(partition: DataPartition) -> pd.DataFrame:
    frame = partition.features.copy()
    frame["transaction_period"] = partition.transaction_period
    frame["resale_price"] = partition.target
    return frame


def _comparison_label(learned_mae: float, baseline_mae: float) -> str:
    if learned_mae < baseline_mae * 0.99:
        return "beats comparable baseline by more than 1% on MAE"
    if learned_mae <= baseline_mae * 1.01:
        return "roughly matches comparable baseline within 1% on MAE"
    return "underperforms comparable baseline by more than 1% on MAE"


def _coefficient_diagnostics(pipeline, count: int = 10) -> None:
    transformer = pipeline.named_steps["preprocessor"]
    regressor = pipeline.named_steps["regressor"]
    feature_names = transformer.get_feature_names_out()
    coefficients = np.asarray(regressor.coef_).reshape(-1)
    if len(feature_names) != len(coefficients):
        print("Coefficient diagnostics: unavailable (feature/coefficient lengths differ)")
        return

    ordered = sorted(zip(feature_names, coefficients), key=lambda item: (item[1], item[0]))
    negative = [(name, value) for name, value in ordered if value < 0][:count]
    positive = [(name, value) for name, value in reversed(ordered) if value > 0][:count]
    print("Coefficient diagnostics (noncausal; numeric variables are standardized):")
    print("  Largest positive coefficients:")
    for name, value in positive:
        print(f"    {name}: ${value:,.2f}")
    print("  Largest negative coefficients:")
    for name, value in negative:
        print(f"    {name}: -${abs(value):,.2f}")
    print("  One-hot coefficients are contrasts against each feature's dropped reference category.")


def _report_group_mae(predictions: pd.DataFrame, column: str) -> None:
    print(f"MAE by {column} (SGD; support shown as n):")
    grouped = predictions.groupby(column, sort=True, dropna=False)
    for label, group in grouped:
        mae = calculate_regression_metrics(group["actual"], group["prediction"]).mae_sgd
        print(f"  {label}: n={len(group):,}, MAE=${mae:,.2f}")


def _report_feature_matrix(pipeline, X_train: pd.DataFrame) -> None:
    transformed = pipeline.named_steps["preprocessor"].transform(X_train)
    feature_count = len(pipeline.named_steps["preprocessor"].get_feature_names_out())
    print("Categorical cardinalities in model fit data:")
    for feature in CATEGORICAL_FEATURES:
        print(f"  {feature}: {X_train[feature].nunique(dropna=False):,}")
    print(f"Encoded feature count: {feature_count:,}")
    print(f"Training design matrix shape: {transformed.shape[0]:,} x {transformed.shape[1]:,}")
    if sparse.issparse(transformed):
        estimated_mib = (
            transformed.data.nbytes + transformed.indices.nbytes + transformed.indptr.nbytes
        ) / (1024 * 1024)
        print(
            f"Sparse matrix: nnz={transformed.nnz:,}, density="
            f"{transformed.nnz / (transformed.shape[0] * transformed.shape[1]):.6f}, "
            f"CSR storage={estimated_mib:.2f} MiB"
        )
    else:
        print(f"Dense matrix storage={transformed.nbytes / (1024 * 1024):.2f} MiB")


def main() -> None:
    started = perf_counter()
    path = find_raw_csv()
    raw = load_resale_data(path)
    validate_required_columns(raw)
    prepared = prepare_features(raw)
    partitions = split_chronologically(
        prepared.features, prepared.target, prepared.transaction_period
    )
    train = partitions.train
    validation = partitions.validation
    test = partitions.test

    print(f"Dataset: {path.name}; rows={len(raw):,}; source=HDB via data.gov.sg")
    print("Dataset identifier: d_8b84c4ee58e3cfc0ece0d773c8ca6abc")
    print("Local dataset retrieval date: 2026-10-04")
    print(f"scikit-learn version: {sklearn.__version__}; model metadata version: 1")
    print("Partitions: train=2017-01..2024-12; validation=2025-01..2025-12; test=2026-01..2026-09")
    print(f"Current partial period rows excluded: {len(partitions.current_partial_period.features):,}")
    print(f"Categorical features: {', '.join(CATEGORICAL_FEATURES)}")
    print(f"Numeric features: {', '.join(NUMERIC_FEATURES)}")
    print(f"Selected base feature schema: {', '.join(MODEL_FEATURES)}")
    print("Excluded exact-redundant storey bounds and strongly correlated lease commencement year.")

    X_train = select_model_features(train.features)
    X_validation = select_model_features(validation.features)
    validation_candidates = evaluate_validation_candidates(
        X_train,
        train.target,
        X_validation,
        validation.target,
    )
    print("\nVALIDATION CANDIDATES (fitted on train only)")
    for candidate in validation_candidates:
        name = "Linear Regression" if candidate.model_name == "linear" else f"Ridge alpha={candidate.alpha:g}"
        print(_metric_line(name, candidate.metrics))

    selected = select_validation_candidate(validation_candidates)
    print("\nSELECTED LEARNED MODEL (validation only)")
    print(f"Model: {selected.model_name}; alpha={selected.alpha}")
    print(_metric_line("Selected validation", selected.metrics))

    train_frame = _partition_frame(train)
    validation_frame = _partition_frame(validation)
    test_frame = _partition_frame(test)
    validation_baseline = summarize_predictions(
        evaluate_walk_forward(
            train_frame,
            validation_frame,
            partial(predict_comparable_sales, config=COMPARABLE_REFERENCE),
        )
    )
    print("\nCOMPARABLE BASELINE VALIDATION REFERENCE (single frozen configuration)")
    print(_metric_line("Comparable validation", validation_baseline.metrics))
    print(f"Selected learned comparison: {_comparison_label(selected.metrics.mae_sgd, validation_baseline.metrics.mae_sgd)}")

    historical_features = pd.concat([train.features, validation.features])
    historical_target = pd.concat([train.target, validation.target])
    final_pipeline = fit_selected_model(selected, historical_features, historical_target)
    test_features = select_model_features(test.features)
    test_predictions = pd.Series(
        final_pipeline.predict(test_features), index=test.target.index, name="prediction"
    )
    test_metrics = calculate_regression_metrics(test.target, test_predictions)
    print("\nFINAL TEST (selected pipeline refit on train plus validation only)")
    print(_metric_line("Selected learned test", test_metrics))

    test_history = pd.concat([train_frame, validation_frame], axis=0)
    test_baseline = summarize_predictions(
        evaluate_walk_forward(
            test_history,
            test_frame,
            partial(predict_comparable_sales, config=COMPARABLE_REFERENCE),
        )
    )
    print("\nCOMPARABLE BASELINE TEST REFERENCE (single frozen configuration)")
    print(_metric_line("Comparable test", test_baseline.metrics))
    print(f"Selected learned comparison: {_comparison_label(test_metrics.mae_sgd, test_baseline.metrics.mae_sgd)}")

    group_results = test.features.loc[:, ["town", "flat_type"]].copy()
    group_results["actual"] = test.target
    group_results["prediction"] = test_predictions
    _report_group_mae(group_results, "town")
    _report_group_mae(group_results, "flat_type")

    _report_feature_matrix(final_pipeline, historical_features)
    _coefficient_diagnostics(final_pipeline)
    print("\nMODEL METADATA")
    print(f"  Source transaction coverage: {prepared.transaction_period.min()} to {prepared.transaction_period.max()}")
    print("  Train fit range: 2017-01 to 2024-12; validation selection range: 2025-01 to 2025-12")
    print("  Final fit range: 2017-01 to 2025-12; final test range: 2026-01 to 2026-09")
    print(f"  Estimator parameters: model={selected.model_name}, alpha={selected.alpha}")
    print(f"Evaluation runtime: {perf_counter() - started:.2f} seconds")


if __name__ == "__main__":
    main()
