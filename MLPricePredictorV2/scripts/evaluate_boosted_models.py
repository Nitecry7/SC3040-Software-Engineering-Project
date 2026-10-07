"""Evaluate leakage-safe CatBoost and XGBoost HDB price models."""

import argparse
from pathlib import Path
import sys
from threading import Event, Thread
from time import perf_counter

import pandas as pd
import sklearn

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.data.load import find_raw_csv, load_resale_data  # noqa: E402
from src.data.validate import validate_required_columns  # noqa: E402
from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics  # noqa: E402
from src.models.boosted import (  # noqa: E402
    BOOSTED_FEATURES,
    CATEGORICAL_FEATURES,
    NUMERIC_FEATURES,
    BoostedFamily,
    ComputeDevice,
    BoostedValidationResult,
    dataframe_memory_bytes,
    detect_gpu_devices,
    evaluate_boosted_candidates,
    feature_importance,
    fit_selected_boosted_model,
    predict_boosted_model,
    select_boosted_candidate,
    verify_gpu_libraries,
)
from src.preprocessing.base import prepare_features  # noqa: E402
from src.splitting.chronological import DataPartition, split_chronologically  # noqa: E402

RECORDED_VALIDATION_MAE = {
    "Comparable-sales baseline": 39_354.92,
    "Linear Regression": 50_772.32,
    "Extra Trees (depth/leaf candidate)": 43_443.85,
}
RECORDED_TEST_METRICS = {
    "Comparable-sales baseline": {"mae": 40_932.90, "rmse": 70_470.57, "mape": 5.90},
    "Linear Regression": {"mae": 49_861.68, "rmse": 69_194.33, "mape": 8.08},
    "Extra Trees": {"mae": 30_056.10, "rmse": 44_414.51, "mape": 4.55},
}


class GpuTelemetrySampler:
    """Sample nvidia-smi while the selected GPU workflow is running."""

    def __init__(self, interval_seconds: float = 3.0):
        self.interval_seconds = interval_seconds
        self.samples = []
        self._stop = Event()
        self._thread = Thread(target=self._sample, daemon=True)

    def _sample(self) -> None:
        while not self._stop.is_set():
            device = next((item for item in detect_gpu_devices() if item.index == 0), None)
            if device is not None:
                self.samples.append(device)
            self._stop.wait(self.interval_seconds)

    def __enter__(self) -> "GpuTelemetrySampler":
        self._thread.start()
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self._stop.set()
        self._thread.join(timeout=self.interval_seconds + 1)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--device",
        choices=("gpu", "cpu"),
        default="gpu",
        help="GPU is required by default; choose cpu explicitly for development runs.",
    )
    return parser.parse_args()


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


def _partition_rows(partition: DataPartition) -> int:
    return len(partition.features)


def _report_groups(actual: pd.Series, predicted: pd.Series, features: pd.DataFrame, column: str) -> None:
    print(f"MAE by {column} (SGD; support shown as n):")
    results = pd.DataFrame(
        {column: features[column], "actual": actual, "prediction": predicted},
        index=features.index,
    )
    for label, group in results.groupby(column, sort=True, dropna=False):
        metrics = calculate_regression_metrics(group["actual"], group["prediction"])
        support_note = " (low support)" if column == "flat_type" and len(group) < 30 else ""
        print(f"  {label}: n={len(group):,}, MAE=${metrics.mae_sgd:,.2f}{support_note}")


def _report_candidate(result: BoostedValidationResult) -> None:
    config = result.config
    print(
        f"{config.config_id}: depth={config.depth}, learning_rate={config.learning_rate:g}, "
        f"min_child_weight={config.min_child_weight}; "
        f"{_metric_line('validation', result.metrics)}"
    )
    print(
        f"  best_iteration={result.best_iteration} (zero-based), "
        f"best_score={result.best_score:.6f}, configured_max_iterations=2000, "
        f"fit={result.fit_seconds:.2f}s, predict={result.prediction_seconds:.2f}s, "
        f"serialized_size={result.model_size_bytes / (1024 * 1024):.2f} MiB"
    )


def _compare_validation(selected: BoostedValidationResult) -> None:
    print("Validation MAE references (previously recorded; not selection inputs):")
    for label, mae in RECORDED_VALIDATION_MAE.items():
        print(f"  {label}: ${mae:,.2f}; advanced model: ${selected.metrics.mae_sgd:,.2f}")
    print("Selection uses only the eight advanced-model validation results.")


def _compare_test(metrics: RegressionMetrics) -> None:
    print("Previously recorded test references (not used for model selection):")
    for label, reference in RECORDED_TEST_METRICS.items():
        print(
            f"  {label}: MAE=${reference['mae']:,.2f}, "
            f"RMSE=${reference['rmse']:,.2f}, MAPE={reference['mape']:.2f}%; "
            f"selected advanced model MAE=${metrics.mae_sgd:,.2f}"
        )
    print("Comparable baseline test uses month-by-month updates; learned models are frozen after 2025-12.")


def _report_gpu_status(device: ComputeDevice, gpu_status: dict[str, object] | None) -> None:
    detected = detect_gpu_devices()
    print(f"GPU requested: {device == 'gpu'}")
    print(f"GPU detected: {bool(detected)}")
    for gpu in detected:
        print(
            f"GPU index={gpu.index}, name={gpu.name}, VRAM={gpu.memory_used_mib}/"
            f"{gpu.memory_total_mib} MiB used, utilization={gpu.utilization_percent}%"
        )
    if gpu_status is None:
        print("CatBoost and XGBoost execution device: CPU (explicit CPU mode)")
        return
    print(
        "CatBoost execution: GPU device 0; "
        f"version={gpu_status['catboost_version']}; "
        f"GPU devices reported={gpu_status['catboost_gpu_device_count']}; smoke fit passed"
    )
    print(
        "XGBoost execution: CUDA device 0 with hist; "
        f"version={gpu_status['xgboost_version']}; "
        f"smoke-fit device={gpu_status['xgboost_smoke_device']}; smoke fit passed"
    )
    print(f"XGBoost build information: {gpu_status['xgboost_build_info']}")


def main() -> None:
    args = _parse_args()
    device: ComputeDevice = args.device
    started = perf_counter()
    initial_devices = detect_gpu_devices()
    print(f"Requested compute device: {device}")
    print(f"GPU detected before model checks: {bool(initial_devices)}")
    gpu_status = verify_gpu_libraries() if device == "gpu" else None
    if gpu_status is not None:
        print("GPU preflight: CatBoost and XGBoost both completed small GPU smoke fits.")

    import catboost
    import xgboost

    raw_path = find_raw_csv()
    raw = load_resale_data(raw_path)
    validate_required_columns(raw)
    prepared = prepare_features(raw)
    partitions = split_chronologically(
        prepared.features, prepared.target, prepared.transaction_period
    )
    train = partitions.train
    validation = partitions.validation
    test = partitions.test

    print(f"Dataset: {raw_path.name}; source=HDB via data.gov.sg")
    print("Dataset identifier: d_8b84c4ee58e3cfc0ece0d773c8ca6abc; local retrieval date: 2026-10-04")
    print(
        f"Rows={len(raw):,}; train={_partition_rows(train):,}; "
        f"validation={_partition_rows(validation):,}; test={_partition_rows(test):,}; "
        f"partial period excluded={_partition_rows(partitions.current_partial_period):,}"
    )
    print("Train period: 2017-01 to 2024-12; validation: 2025-01 to 2025-12; test: 2026-01 to 2026-09")
    print(f"Python package versions: pandas={pd.__version__}; scikit-learn={sklearn.__version__}; catboost={catboost.__version__}; xgboost={xgboost.__version__}")
    print(f"Feature order: {', '.join(BOOSTED_FEATURES)}")
    print(f"Numeric fields: {', '.join(NUMERIC_FEATURES)}")
    print(f"Native categorical fields: {', '.join(CATEGORICAL_FEATURES)}")
    print("CatBoost uses chronological has_time ordering; XGBoost categories use train-fit vocabularies and unknown-to-missing handling.")
    _report_gpu_status(device, gpu_status)

    telemetry = GpuTelemetrySampler() if device == "gpu" else None
    if telemetry is not None:
        telemetry.__enter__()
    try:
        candidates = evaluate_boosted_candidates(
            train.features,
            train.target,
            validation.features,
            validation.target,
            device=device,
        )
        print("\nVALIDATION CANDIDATES (fit data is train only; validation is eval/selection only)")
        for candidate in candidates:
            _report_candidate(candidate)

        selected = select_boosted_candidate(candidates)
        print("\nSELECTED ADVANCED MODEL (validation-only selection)")
        print(f"Selected configuration: {selected.config.config_id}; device={device}")
        print(_metric_line("Selected validation", selected.metrics))
        _compare_validation(selected)

        fit_features = pd.concat([train.features, validation.features], axis=0)
        fit_target = pd.concat([train.target, validation.target], axis=0)
        final_fit_started = perf_counter()
        fitted = fit_selected_boosted_model(selected, fit_features, fit_target, device=device)
        final_fit_seconds = perf_counter() - final_fit_started
        print("\nFINAL REFIT (train plus validation through 2025-12; no 2026 rows)")
        print(f"Selected rounds frozen from validation: {fitted.iterations}")
        print(f"Final fit runtime: {final_fit_seconds:.2f}s")

        prediction_started = perf_counter()
        predictions = predict_boosted_model(fitted, test.features)
        test_prediction_seconds = perf_counter() - prediction_started
        test_metrics = calculate_regression_metrics(test.target, predictions)
        print("\nFINAL TEST (selected model only; frozen fit; 2026-01 through 2026-09)")
        print(_metric_line("Selected advanced model", test_metrics))
        _compare_test(test_metrics)
        print(f"Full test prediction runtime={test_prediction_seconds:.2f}s; per row={test_prediction_seconds / len(test.features) * 1000:.4f}ms")

        _report_groups(test.target, predictions, test.features, "town")
        _report_groups(test.target, predictions, test.features, "flat_type")

        importance = feature_importance(fitted)
        print("Feature importance (model-native; descriptive, noncausal):")
        for name, value in importance:
            print(f"  {name}: {value:.6f}")

        candidate_train = train.features.loc[:, BOOSTED_FEATURES]
        final_train = fit_features.loc[:, BOOSTED_FEATURES]
        print("Input memory observations (native-category DataFrame estimates):")
        print(
            f"  Candidate train: {candidate_train.shape[0]:,} x {candidate_train.shape[1]}, "
            f"{dataframe_memory_bytes(candidate_train) / (1024 * 1024):.2f} MiB"
        )
        print(
            f"  Final train plus validation: {final_train.shape[0]:,} x {final_train.shape[1]}, "
            f"{dataframe_memory_bytes(final_train) / (1024 * 1024):.2f} MiB"
        )
        from src.models.boosted import _serialize_model_size

        final_size = _serialize_model_size(fitted.estimator, fitted.config.family)
        print(f"Final serialized model size estimate: {final_size / (1024 * 1024):.2f} MiB (temporary file removed)")
        print(f"Selected candidate fit={selected.fit_seconds:.2f}s; validation predict={selected.prediction_seconds:.2f}s")
    finally:
        if telemetry is not None:
            telemetry.__exit__(None, None, None)

    if telemetry is not None:
        if telemetry.samples:
            print(
                "GPU runtime observations: "
                f"samples={len(telemetry.samples)}, "
                f"max utilization={max(item.utilization_percent or 0 for item in telemetry.samples)}%, "
                f"max VRAM={max(item.memory_used_mib or 0 for item in telemetry.samples)} MiB"
            )
        else:
            print("GPU runtime observations: nvidia-smi returned no samples during fitting.")
    print("Known limitations: GPU CatBoost may vary slightly between runs; no production artifact or service was created.")
    print(f"Total benchmark runtime={perf_counter() - started:.2f}s")


if __name__ == "__main__":
    main()
