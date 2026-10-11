"""Compare leakage-safe nonlinear tree benchmarks on chronological HDB data."""

from functools import partial
from pathlib import Path
import pickle
import sys
from time import perf_counter

import pandas as pd
import sklearn

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.baselines.comparable_sales import ComparableConfig, predict_comparable_sales  # noqa: E402
from src.data.load import find_raw_csv, load_resale_data  # noqa: E402
from src.data.validate import validate_required_columns  # noqa: E402
from src.evaluation.diagnostics import summarize_predictions  # noqa: E402
from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics  # noqa: E402
from src.evaluation.walk_forward import evaluate_walk_forward  # noqa: E402
from src.models.linear import CATEGORICAL_FEATURES, MODEL_FEATURES, NUMERIC_FEATURES  # noqa: E402
from src.models.tree import (  # noqa: E402
    HISTOGRAM_CATEGORICAL_FEATURES,
    HISTOGRAM_FEATURES,
    aggregate_tree_feature_importances,
    evaluate_tree_validation_candidates,
    fit_selected_tree_model,
    select_tree_candidate,
    select_tree_features,
    tree_configurations,
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
RECORDED_VALIDATION_MAE = {
    "Linear Regression": 50_772.32,
    "Ridge alpha=0.1": 50_793.75,
}
RECORDED_TEST_METRICS = {
    "Comparable median": {"mae": 40_932.90, "rmse": 70_470.57, "mape": 5.90},
    "Linear Regression": {"mae": 49_861.68, "rmse": 69_194.33, "mape": 8.08},
}


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


def _report_groups(results: pd.DataFrame, column: str) -> None:
    print(f"Test MAE by {column} (SGD; support shown as n):")
    for label, group in results.groupby(column, sort=True, dropna=False):
        mae = calculate_regression_metrics(group["actual"], group["prediction"]).mae_sgd
        print(f"  {label}: n={len(group):,}, MAE=${mae:,.2f}")


def _report_matrix(pipeline, features: pd.DataFrame, family: str) -> None:
    transformed = pipeline.named_steps["preprocessor"].transform(
        select_tree_features(features, family)
    )
    names = pipeline.named_steps["preprocessor"].get_feature_names_out()
    print("Final fit feature diagnostics:")
    relevant_categories = (
        HISTOGRAM_CATEGORICAL_FEATURES if family == "hist_gradient_boosting" else CATEGORICAL_FEATURES
    )
    for feature in relevant_categories:
        print(f"  {feature} fit cardinality: {features[feature].nunique(dropna=False):,}")
    print(f"  Feature/matrix width: {len(names):,}; shape={transformed.shape[0]:,} x {transformed.shape[1]:,}")
    if hasattr(transformed, "nnz"):
        memory = transformed.data.nbytes + transformed.indices.nbytes + transformed.indptr.nbytes
        print(
            f"  Sparse {transformed.format.upper()} matrix: nnz={transformed.nnz:,}, "
            f"density={transformed.nnz / (transformed.shape[0] * transformed.shape[1]):.6f}, "
            f"storage={memory / (1024 * 1024):.2f} MiB"
        )
    elif isinstance(transformed, pd.DataFrame):
        memory = int(transformed.memory_usage(index=True, deep=True).sum())
        print(f"  Native-category DataFrame storage={memory / (1024 * 1024):.2f} MiB")
    else:
        print(f"  Dense ndarray storage={transformed.nbytes / (1024 * 1024):.2f} MiB")
    estimator_bytes = len(
        pickle.dumps(pipeline.named_steps["regressor"], protocol=pickle.HIGHEST_PROTOCOL)
    )
    print(f"  Serialized estimator size estimate={estimator_bytes / (1024 * 1024):.2f} MiB")


def _validation_comparable(validation: DataPartition, train: DataPartition) -> RegressionMetrics:
    result = evaluate_walk_forward(
        _partition_frame(train),
        _partition_frame(validation),
        partial(predict_comparable_sales, config=COMPARABLE_REFERENCE),
    )
    return summarize_predictions(result).metrics


def main() -> None:
    started = perf_counter()
    path = find_raw_csv()
    raw = load_resale_data(path)
    validate_required_columns(raw)
    prepared = prepare_features(raw)
    partitions = split_chronologically(
        prepared.features, prepared.target, prepared.transaction_period
    )
    train, validation, test = partitions.train, partitions.validation, partitions.test

    print(f"Dataset: {path.name}; rows={len(raw):,}; source=HDB via data.gov.sg")
    print("Dataset identifier: d_8b84c4ee58e3cfc0ece0d773c8ca6abc")
    print("Local dataset retrieval date: 2026-10-04")
    print(f"scikit-learn version: {sklearn.__version__}; random_state=42")
    print("Partitions: train=2017-01..2024-12; validation=2025-01..2025-12; test=2026-01..2026-09")
    print(f"Partial period excluded: {len(partitions.current_partial_period.features):,} rows")
    print(f"Forest feature order: {', '.join(MODEL_FEATURES)}")
    print(f"Forest categorical fields: {', '.join(CATEGORICAL_FEATURES)}; numeric fields: {', '.join(NUMERIC_FEATURES)}")
    print(f"HistGradientBoosting feature order: {', '.join(HISTOGRAM_FEATURES)}")
    print(f"HistGradientBoosting native categorical fields: {', '.join(HISTOGRAM_CATEGORICAL_FEATURES)}")
    print("Block and street are omitted for HistGradientBoosting because their category counts exceed max_bins=255.")

    candidates = evaluate_tree_validation_candidates(
        train.features, train.target, validation.features, validation.target
    )
    print("\nVALIDATION CANDIDATES (all preprocessing and fitting use train only)")
    for result in candidates:
        config = result.config
        print(
            f"{config.config_id}; parameters={config.parameters}; "
            f"{_metric_line('validation', result.metrics)}"
        )
        print(
            f"  fit={result.fit_seconds:.2f}s, predict={result.prediction_seconds:.2f}s, "
            f"matrix={result.matrix_shape[0]:,} x {result.matrix_shape[1]:,} "
            f"({result.matrix_format}, {result.matrix_memory_bytes / (1024 * 1024):.2f} MiB), "
            f"serialized estimator={result.model_memory_bytes / (1024 * 1024):.2f} MiB"
        )

    selected = select_tree_candidate(candidates)
    print("\nSELECTED CONFIGURATION (validation only; 1% MAE band, then RMSE, median AE, MAPE, simplicity, resources)")
    print(f"{selected.config.config_id}; parameters={selected.config.parameters}")
    print(_metric_line("Selected validation", selected.metrics))

    comparable_validation = _validation_comparable(validation, train)
    print("\nVALIDATION COMPARISONS")
    print(_metric_line("Comparable baseline, fixed 12-month reference", comparable_validation))
    print("Recorded learned validation MAE references (from the prior linear benchmark run):")
    for name, mae in RECORDED_VALIDATION_MAE.items():
        print(f"  {name}: MAE=${mae:,.2f}")
    print("These recorded figures are comparisons only and were not passed into tree selection.")

    fit_features = pd.concat([train.features, validation.features], axis=0)
    fit_target = pd.concat([train.target, validation.target], axis=0)
    final_fit_started = perf_counter()
    final_pipeline = fit_selected_tree_model(selected.config, fit_features, fit_target)
    final_fit_seconds = perf_counter() - final_fit_started
    test_features = select_tree_features(test.features, selected.config.family)
    prediction_started = perf_counter()
    test_predictions = pd.Series(
        final_pipeline.predict(test_features), index=test.target.index, name="prediction"
    )
    test_prediction_seconds = perf_counter() - prediction_started
    test_metrics = calculate_regression_metrics(test.target, test_predictions)
    print("\nFINAL TEST (one frozen selected configuration; refit on train plus validation)")
    print(_metric_line("Selected tree model", test_metrics))
    print(f"Final fit={final_fit_seconds:.2f}s; test prediction={test_prediction_seconds:.2f}s")
    print("Recorded test references (not used for selection; comparable baseline uses walk-forward updates):")
    for name, metrics in RECORDED_TEST_METRICS.items():
        print(f"  {name}: MAE=${metrics['mae']:,.2f}, RMSE=${metrics['rmse']:,.2f}, MAPE={metrics['mape']:.2f}%")

    group_results = test.features.loc[:, ["town", "flat_type"]].copy()
    group_results["actual"] = test.target
    group_results["prediction"] = test_predictions
    _report_groups(group_results, "town")
    _report_groups(group_results, "flat_type")

    _report_matrix(final_pipeline, fit_features, selected.config.family)
    importances = aggregate_tree_feature_importances(final_pipeline)
    if importances is None:
        print("Native tree feature importances: unavailable for this estimator.")
    else:
        print("Aggregated impurity importances by source feature (noncausal and potentially high-cardinality biased):")
        for feature, importance in importances.items():
            print(f"  {feature}: {importance:.6f}")
    print("\nLimitations: the trained candidate is a research benchmark, not an approved valuation model.")
    print("Recorded final test references were not recomputed; tree test results are evaluated once after selection.")
    print(f"Total evaluation runtime={perf_counter() - started:.2f}s")


if __name__ == "__main__":
    main()
