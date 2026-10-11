"""Matched-history and temporal robustness checks for the frozen CatBoost design."""

import argparse
import gc
from pathlib import Path
import sys
from time import perf_counter

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.baselines.comparable_sales import ComparableConfig  # noqa: E402
from src.data.load import find_raw_csv, load_resale_data  # noqa: E402
from src.data.validate import validate_required_columns  # noqa: E402
from src.evaluation.frozen_history import evaluate_frozen_history_comparable  # noqa: E402
from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics  # noqa: E402
from src.evaluation.robustness import (  # noqa: E402
    RepeatabilityRun,
    evaluate_frozen_catboost_year,
    expanding_year_partitions,
    summarize_group_mae,
    summarize_monthly_drift,
    summarize_repeatability,
)
from src.models.boosted import (  # noqa: E402
    BOOSTED_FEATURES,
    CATEGORICAL_FEATURES,
    FROZEN_CATBOOST_CONFIG,
    FROZEN_CATBOOST_ITERATIONS,
    ComputeDevice,
    detect_gpu_devices,
    fit_frozen_catboost,
    predict_boosted_model,
    verify_gpu_libraries,
)
from src.preprocessing.base import prepare_features  # noqa: E402

FROZEN_COMPARABLE_CONFIG = ComparableConfig(
    lookback_months=12,
    minimum_comparables=5,
    maximum_comparables=30,
    floor_area_tolerance_sqm=15.0,
    storey_mid_tolerance=6.0,
    remaining_lease_tolerance_months=60,
)
TEMPORAL_BACKTEST_YEARS = (2022, 2023, 2024, 2025)
LOW_SUPPORT_THRESHOLD = 30
REPEAT_COUNT = 3


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--device",
        choices=("gpu", "cpu"),
        default="gpu",
        help="GPU is required by default; CPU must be selected explicitly.",
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


def _prediction_frame(evaluation, predictions: pd.Series) -> pd.DataFrame:
    aligned = predictions.reindex(evaluation.target.index)
    result = evaluation.features.loc[:, ["town", "flat_type"]].copy()
    result["transaction_period"] = evaluation.transaction_period
    result["actual"] = evaluation.target
    result["prediction"] = aligned
    return result


def _report_metric_winners(catboost: RegressionMetrics, comparable: RegressionMetrics) -> None:
    lower_is_better = (
        ("MAE", catboost.mae_sgd, comparable.mae_sgd),
        ("RMSE", catboost.rmse_sgd, comparable.rmse_sgd),
        ("MAPE", catboost.mape_percent, comparable.mape_percent),
        (
            "median absolute error",
            catboost.median_absolute_error_sgd,
            comparable.median_absolute_error_sgd,
        ),
    )
    for name, model_value, baseline_value in lower_is_better:
        if model_value is None or baseline_value is None:
            winner = "undefined"
        elif model_value < baseline_value:
            winner = "CatBoost"
        elif model_value > baseline_value:
            winner = "frozen comparable"
        else:
            winner = "tie"
        print(f"  {name} winner: {winner}")
    if catboost.r_squared is None or comparable.r_squared is None:
        winner = "undefined"
    elif catboost.r_squared > comparable.r_squared:
        winner = "CatBoost"
    elif catboost.r_squared < comparable.r_squared:
        winner = "frozen comparable"
    else:
        winner = "tie"
    print(f"  R2 winner: {winner}")
    print("  Prediction counts and mean prices are descriptive, not scored as wins.")


def _report_matched_comparison(
    year: int,
    catboost_metrics: RegressionMetrics,
    comparable_metrics: RegressionMetrics,
) -> None:
    difference = catboost_metrics.mae_sgd - comparable_metrics.mae_sgd
    percent_improvement = (
        (comparable_metrics.mae_sgd - catboost_metrics.mae_sgd)
        / comparable_metrics.mae_sgd
        * 100
        if comparable_metrics.mae_sgd
        else None
    )
    percent_text = "undefined" if percent_improvement is None else f"{percent_improvement:+.2f}%"
    print(f"\nMATCHED FROZEN-HISTORY COMPARISON: {year}")
    print(_metric_line("CatBoost", catboost_metrics))
    print(_metric_line("Frozen comparable", comparable_metrics))
    print(f"  MAE difference (CatBoost - comparable): ${difference:+,.2f}")
    print(f"  MAE percentage improvement (positive favors CatBoost): {percent_text}")
    _report_metric_winners(catboost_metrics, comparable_metrics)


def _report_group_table(year: int, predictions: pd.DataFrame, group_column: str) -> pd.DataFrame:
    summary = summarize_group_mae(predictions, group_column)
    print(f"\nCatBoost MAE by {group_column} for {year} (SGD; support is n)")
    for row in summary.itertuples(index=False, name=None):
        label, support, mae = row
        support_note = " LOW SUPPORT" if support < LOW_SUPPORT_THRESHOLD else ""
        print(f"  {label}: n={support:,}, MAE=${mae:,.2f}{support_note}")
    return summary


def _report_monthly_drift(year: int, predictions: pd.DataFrame) -> None:
    monthly, slope = summarize_monthly_drift(predictions)
    print(f"\nMONTHLY DRIFT: {year} (no monthly model updates)")
    for row in monthly.itertuples(index=False):
        print(
            f"  {row.transaction_period}: n={row.support:,}, MAE=${row.mae_sgd:,.2f}, "
            f"mean actual=${row.mean_actual_sgd:,.2f}, "
            f"mean predicted=${row.mean_predicted_sgd:,.2f}, "
            f"bias=${row.prediction_bias_sgd:+,.2f}"
        )
    if slope is None:
        print("  MAE trend slope: undefined (fewer than two months)")
    else:
        direction = "increasing" if slope > 0 else "decreasing" if slope < 0 else "flat"
        print(f"  Descriptive MAE slope: ${slope:+,.2f} per calendar month ({direction})")


def _report_group_stability(group_summaries: dict[int, dict[str, pd.DataFrame]]) -> None:
    print("\nBEST/WORST SUPPORTED GROUPS BY YEAR (support >= 30)")
    for year in TEMPORAL_BACKTEST_YEARS:
        for group_column in ("town", "flat_type"):
            summary = group_summaries[year][group_column]
            eligible = summary.loc[summary["support"] >= LOW_SUPPORT_THRESHOLD]
            best = eligible.sort_values(
                ["mae_sgd", group_column], ascending=[True, True], kind="stable"
            ).head(3)
            worst = eligible.sort_values(
                ["mae_sgd", group_column], ascending=[False, True], kind="stable"
            ).head(3)
            print(f"  {year} {group_column} best: " + "; ".join(
                f"{row[0]} ${row[2]:,.0f} (n={row[1]:,})"
                for row in best.itertuples(index=False, name=None)
            ))
            print(f"  {year} {group_column} worst: " + "; ".join(
                f"{row[0]} ${row[2]:,.0f} (n={row[1]:,})"
                for row in worst.itertuples(index=False, name=None)
            ))

    print("\nREPEATED HIGH-ERROR GROUPS (top three MAE per year; support >= 30)")
    for group_column in ("town", "flat_type"):
        appearances: dict[str, list[int]] = {}
        for year in TEMPORAL_BACKTEST_YEARS:
            summary = group_summaries[year][group_column]
            eligible = summary.loc[summary["support"] >= LOW_SUPPORT_THRESHOLD]
            worst = eligible.sort_values(
                ["mae_sgd", group_column], ascending=[False, True], kind="stable"
            ).head(3)
            for row in worst.itertuples(index=False):
                appearances.setdefault(str(getattr(row, group_column)), []).append(year)
        print(f"  {group_column}:")
        for label, years in sorted(appearances.items(), key=lambda item: (-len(item[1]), item[0])):
            if len(years) > 1:
                print(f"    {label}: appeared in top three in {len(years)} years ({', '.join(map(str, years))})")
        if not any(len(years) > 1 for years in appearances.values()):
            print("    no supported group appeared in the top three more than once")


def _print_annual_comparison_table(results: dict[int, dict[str, object]]) -> int:
    wins = 0
    print("\nYEAR-BY-YEAR MAE COMPARISON (negative difference favors CatBoost)")
    for year in TEMPORAL_BACKTEST_YEARS:
        cat_metrics = results[year]["catboost_metrics"]
        comparable_metrics = results[year]["comparable_metrics"]
        difference = cat_metrics.mae_sgd - comparable_metrics.mae_sgd
        percentage = (
            (comparable_metrics.mae_sgd - cat_metrics.mae_sgd)
            / comparable_metrics.mae_sgd
            * 100
            if comparable_metrics.mae_sgd
            else float("nan")
        )
        if difference < 0:
            wins += 1
        print(
            f"  {year}: CatBoost=${cat_metrics.mae_sgd:,.2f}; "
            f"frozen comparable=${comparable_metrics.mae_sgd:,.2f}; "
            f"difference=${difference:+,.2f}; improvement={percentage:+.2f}%"
        )
    print(f"CatBoost MAE wins: {wins} of {len(TEMPORAL_BACKTEST_YEARS)} years")
    return wins


def main() -> None:
    args = _parse_args()
    device: ComputeDevice = args.device
    started = perf_counter()
    devices = detect_gpu_devices()
    print(f"Requested device: {device}; NVIDIA GPU detected: {bool(devices)}")
    if device == "gpu":
        try:
            gpu_status = verify_gpu_libraries()
        except (RuntimeError, OSError) as error:
            raise SystemExit(f"GPU preflight failed; no CPU fallback was attempted: {error}") from error
        print(
            "GPU preflight passed: "
            f"{gpu_status['device'].name}, CatBoost {gpu_status['catboost_version']}, "
            f"GPU devices={gpu_status['catboost_gpu_device_count']}"
        )
    elif not devices:
        print("Explicit CPU mode selected; no NVIDIA GPU is required.")
    else:
        print(f"Explicit CPU mode selected; detected GPU: {devices[0].name}")

    raw_path = find_raw_csv()
    raw = load_resale_data(raw_path)
    validate_required_columns(raw)
    prepared = prepare_features(raw)
    periods = pd.Series(prepared.transaction_period, index=prepared.features.index)
    all_rows = prepared.features.copy()
    all_rows["transaction_period"] = periods
    all_rows["resale_price"] = prepared.target
    print(f"Dataset: {raw_path.name}; rows={len(all_rows):,}; official HDB data via data.gov.sg")
    print("Identifier: d_8b84c4ee58e3cfc0ece0d773c8ca6abc; local retrieval date: 2026-10-04")
    print(f"Feature order: {', '.join(BOOSTED_FEATURES)}")
    print(f"Native categorical features: {', '.join(CATEGORICAL_FEATURES)}")
    print(
        f"Frozen CatBoost: depth={FROZEN_CATBOOST_CONFIG.depth}, "
        f"learning_rate={FROZEN_CATBOOST_CONFIG.learning_rate}, l2_leaf_reg=3, "
        f"seed=42, rounds={FROZEN_CATBOOST_ITERATIONS}, device={device}"
    )
    print(f"Frozen comparable configuration: {FROZEN_COMPARABLE_CONFIG}")
    print("2022-2024 results are retrospective robustness checks of a design selected on 2025.")
    print("All 2026-10 onward partial-period rows are excluded.")

    results: dict[int, dict[str, object]] = {}
    group_summaries: dict[int, dict[str, pd.DataFrame]] = {}
    repeat_runs: list[RepeatabilityRun] = []
    year_windows = (*TEMPORAL_BACKTEST_YEARS, 2026)
    for year in year_windows:
        end_month = 9 if year == 2026 else 12
        annual = evaluate_frozen_catboost_year(
            prepared.features,
            prepared.target,
            periods,
            year,
            device=device,
            evaluation_end_month=end_month,
        )
        training = annual.training
        evaluation = annual.evaluation
        cutoff_month = pd.Period(f"{year - 1}-12", freq="M")
        print(
            f"\nFITTING {year}: train rows={len(training.features):,} through {cutoff_month}; "
            f"evaluation rows={len(evaluation.features):,} through "
            f"{evaluation.transaction_period.max()}"
        )
        gc.collect()
        fit_seconds = annual.fit_seconds
        prediction_seconds = annual.prediction_seconds
        cat_predictions = annual.predictions
        cat_metrics = annual.metrics
        cat_rows = _prediction_frame(evaluation, cat_predictions)

        evaluation_rows = all_rows.loc[evaluation.features.index].copy()
        comparable_rows = evaluate_frozen_history_comparable(
            all_rows,
            evaluation_rows,
            cutoff_month,
            FROZEN_COMPARABLE_CONFIG,
        )
        comparable_metrics = calculate_regression_metrics(
            comparable_rows["actual"], comparable_rows["prediction"]
        )
        groups = {
            "town": _report_group_table(year, cat_rows, "town"),
            "flat_type": _report_group_table(year, cat_rows, "flat_type"),
        }
        _report_monthly_drift(year, cat_rows)
        results[year] = {
            "catboost_metrics": cat_metrics,
            "comparable_metrics": comparable_metrics,
            "catboost_rows": cat_rows,
            "comparable_rows": comparable_rows,
            "fit_seconds": fit_seconds,
            "prediction_seconds": prediction_seconds,
        }
        if year in TEMPORAL_BACKTEST_YEARS:
            group_summaries[year] = groups
        if year == 2025:
            repeat_runs.append(
                RepeatabilityRun(cat_metrics, fit_seconds, prediction_seconds, cat_predictions)
            )
        gc.collect()

    for repeat_number in (2, 3):
        training, evaluation = expanding_year_partitions(
            prepared.features,
            prepared.target,
            periods,
            2025,
        )
        gc.collect()
        fit_started = perf_counter()
        fitted = fit_frozen_catboost(training.features, training.target, device=device)
        fit_seconds = perf_counter() - fit_started
        prediction_started = perf_counter()
        predictions = predict_boosted_model(fitted, evaluation.features)
        prediction_seconds = perf_counter() - prediction_started
        metrics = calculate_regression_metrics(
            evaluation.target, predictions.reindex(evaluation.target.index)
        )
        repeat_runs.append(RepeatabilityRun(metrics, fit_seconds, prediction_seconds, predictions))
        print(
            f"\n{device.upper()} REPEAT {repeat_number}: "
            f"{_metric_line('2025 validation', metrics)}, "
            f"fit={fit_seconds:.2f}s, predict={prediction_seconds:.2f}s"
        )
        del fitted
        gc.collect()

    for year in TEMPORAL_BACKTEST_YEARS:
        result = results[year]
        print(
            f"\nTEMPORAL BACKTEST {year}: "
            f"{_metric_line('CatBoost', result['catboost_metrics'])}; "
            f"{_metric_line('Frozen comparable', result['comparable_metrics'])}; "
            f"fit={result['fit_seconds']:.2f}s, predict={result['prediction_seconds']:.2f}s"
        )
        _report_matched_comparison(
            year, result["catboost_metrics"], result["comparable_metrics"]
        )

    for year in (2025, 2026):
        _report_matched_comparison(
            year,
            results[year]["catboost_metrics"],
            results[year]["comparable_metrics"],
        )

    wins = _print_annual_comparison_table(results)
    _report_group_stability(group_summaries)
    summary = summarize_repeatability(repeat_runs)
    print("\nCATBOOST GPU REPEATABILITY (all runs are diagnostics; no run selected)")
    for number, run in enumerate(repeat_runs, start=1):
        print(
            f"  repeat {number}: {_metric_line('2025', run.metrics)}, "
            f"fit={run.fit_seconds:.2f}s, predict={run.prediction_seconds:.2f}s"
        )
    print(
        f"  MAE mean/min/max/std/range: ${summary.mean_mae_sgd:,.2f} / "
        f"${summary.minimum_mae_sgd:,.2f} / ${summary.maximum_mae_sgd:,.2f} / "
        f"${summary.mae_std_sgd:,.2f} / ${summary.mae_range_sgd:,.2f}"
    )
    print(
        f"  RMSE mean/std: ${summary.mean_rmse_sgd:,.2f} / ${summary.rmse_std_sgd:,.2f}; "
        f"MAPE mean/std: {summary.mean_mape_percent:.4f}% / {summary.mape_std_percent:.4f}%"
    )
    print(
        f"  Pairwise prediction absolute difference mean/max: "
        f"${summary.mean_pairwise_prediction_difference_sgd:,.4f} / "
        f"${summary.maximum_pairwise_prediction_difference_sgd:,.4f}"
    )
    print(f"\nCatBoost MAE wins across annual backtests: {wins}/4")
    print("No acceptance threshold was applied; these results do not retune the model.")
    print(f"Total robustness evaluation runtime: {perf_counter() - started:.2f}s")


if __name__ == "__main__":
    main()
