"""Compare historical HDB price baselines with chronological evaluation."""

from functools import partial
from pathlib import Path
import sys
from time import perf_counter

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.baselines.comparable_sales import predict_comparable_sales
from src.baselines.global_median import predict_global_median
from src.baselines.grouped_median import predict_town_flat_type_median
from src.data.load import find_raw_csv, load_resale_data
from src.data.validate import validate_required_columns
from src.evaluation.configuration_selection import (
    ValidationConfigResult,
    comparable_configuration_grid,
    select_comparable_configuration,
)
from src.evaluation.diagnostics import summarize_predictions
from src.evaluation.metrics import RegressionMetrics
from src.evaluation.walk_forward import evaluate_walk_forward
from src.evaluation.walk_forward import evaluate_comparable_configurations_walk_forward
from src.preprocessing.base import prepare_features
from src.splitting.chronological import split_chronologically


def _metric_line(name: str, metrics: RegressionMetrics) -> str:
    mape = "undefined" if metrics.mape_percent is None else f"{metrics.mape_percent:.2f}%"
    r_squared = "undefined" if metrics.r_squared is None else f"{metrics.r_squared:.4f}"
    return (
        f"{name}: n={metrics.prediction_count:,}, MAE=${metrics.mae_sgd:,.2f}, "
        f"RMSE=${metrics.rmse_sgd:,.2f}, MAPE={mape}, R2={r_squared}, "
        f"median AE=${metrics.median_absolute_error_sgd:,.2f}, "
        f"mean actual=${metrics.mean_actual_sgd:,.2f}, "
        f"mean predicted=${metrics.mean_predicted_sgd:,.2f}"
    )


def _partition_frame(frame, indices):
    return frame.loc[indices].copy()


def _print_group_table(label: str, data) -> None:
    print(label)
    for row in data.itertuples(index=False):
        key = getattr(row, data.columns[0])
        print(f"  {key}: n={row.prediction_count:,}, MAE=${row.mae_sgd:,.2f}")


def main() -> None:
    started = perf_counter()
    path = find_raw_csv()
    raw = load_resale_data(path)
    validate_required_columns(raw)
    prepared = prepare_features(raw)
    split = split_chronologically(
        prepared.features, prepared.target, prepared.transaction_period
    )

    all_rows = prepared.features.copy()
    all_rows["transaction_period"] = prepared.transaction_period
    all_rows["resale_price"] = prepared.target
    train = _partition_frame(all_rows, split.train.features.index)
    validation = _partition_frame(all_rows, split.validation.features.index)
    test = _partition_frame(all_rows, split.test.features.index)

    print(f"Dataset: {path.name} ({len(raw):,} rows); raw data left unchanged")
    print("Evaluation windows: validation 2025-01 to 2025-12; test 2026-01 to 2026-09")
    print("The 2026-10 onward partial period is excluded.")
    print("\nVALIDATION BASELINE COMPARISON (walk-forward, SGD for price metrics)")

    global_predictions = evaluate_walk_forward(train, validation, predict_global_median)
    global_diagnostics = summarize_predictions(global_predictions)
    print(_metric_line("Global historical median", global_diagnostics.metrics))

    grouped_predictions = evaluate_walk_forward(
        train, validation, predict_town_flat_type_median
    )
    grouped_diagnostics = summarize_predictions(grouped_predictions)
    print(_metric_line("Town + flat type historical median", grouped_diagnostics.metrics))

    configurations = comparable_configuration_grid()
    validation_predictions = evaluate_comparable_configurations_walk_forward(
        train, validation, configurations
    )
    validation_config_results = []
    evaluated = []
    for config in configurations:
        predictions = validation_predictions[config]
        diagnostics = summarize_predictions(predictions)
        fallback_rate = 1 - diagnostics.fallback_usage.loc["comparable", "percentage"] / 100
        selection_result = ValidationConfigResult(
            config=config,
            mae_sgd=diagnostics.metrics.mae_sgd,
            fallback_rate=float(fallback_rate),
            worst_group_mae_sgd=diagnostics.worst_group_mae_sgd,
        )
        validation_config_results.append(selection_result)
        evaluated.append((config, diagnostics))
        print(
            _metric_line(
                "Comparable "
                f"(lookback={config.lookback_months}m, "
                f"area_tolerance={config.floor_area_tolerance_sqm:g}sqm, "
                f"minimum={config.minimum_comparables})",
                diagnostics.metrics,
            )
            + f", comparable coverage={100 * (1 - fallback_rate):.2f}%"
        )

    selected = select_comparable_configuration(validation_config_results)
    selected_validation = next(
        diagnostics for config, diagnostics in evaluated if config == selected
    )
    print("\nFROZEN COMPARABLE CONFIGURATION (selected using validation only)")
    print(selected)
    print(_metric_line("Selected comparable validation", selected_validation.metrics))

    # Validation actuals are now completed historical evidence for the test period.
    test_history = pd.concat([train, validation], axis=0)
    test_predictions = evaluate_walk_forward(
        test_history,
        test,
        partial(predict_comparable_sales, config=selected),
    )
    test_diagnostics = summarize_predictions(test_predictions)
    print("\nFINAL TEST RESULTS (configuration was frozen before this evaluation)")
    print(_metric_line("Selected comparable test", test_diagnostics.metrics))
    _print_group_table("MAE by town", test_diagnostics.mae_by_town)
    _print_group_table("MAE by flat type", test_diagnostics.mae_by_flat_type)
    print("Fallback usage:")
    for level, row in test_diagnostics.fallback_usage.iterrows():
        print(f"  {level}: {int(row['count']):,} ({row['percentage']:.2f}%)")
    print("Comparable count when comparable fallback level was used:")
    print(f"  {test_diagnostics.comparable_count_stats}")
    print(f"Evaluation runtime: {perf_counter() - started:.2f} seconds")


if __name__ == "__main__":
    main()
