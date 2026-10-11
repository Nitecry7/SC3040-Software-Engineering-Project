"""Evaluate leakage-safe conformal ranges for the frozen CatBoost model."""

import argparse
from pathlib import Path
import platform
import sys
from time import perf_counter

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from src.data.load import find_raw_csv, load_resale_data  # noqa: E402
from src.data.validate import validate_required_columns  # noqa: E402
from src.evaluation.robustness import evaluate_frozen_catboost_year  # noqa: E402
from src.evaluation.uncertainty import (  # noqa: E402
    CALIBRATION_METHODS,
    COVERAGE_LEVELS,
    HISTORICAL_EVALUATION_YEARS,
    MIN_GROUP_CALIBRATION_SUPPORT,
    calibrate_prediction_intervals,
    calculate_interval_metrics,
    passes_ninety_percent_historical_gate,
    select_calibration_method,
    summarize_interval_groups,
)
from src.models.boosted import (  # noqa: E402
    BOOSTED_FEATURES,
    CATEGORICAL_FEATURES,
    FROZEN_CATBOOST_CONFIG,
    FROZEN_CATBOOST_ITERATIONS,
    ComputeDevice,
    detect_gpu_devices,
    verify_gpu_libraries,
)
from src.preprocessing.base import prepare_features  # noqa: E402

CALIBRATION_RESIDUAL_YEARS = (2021, 2022, 2023, 2024, 2025)
LOW_SUPPORT_THRESHOLD = MIN_GROUP_CALIBRATION_SUPPORT


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--device",
        choices=("gpu", "cpu"),
        default="gpu",
        help="GPU is required by default; CPU must be selected explicitly.",
    )
    return parser.parse_args()


def _residual_frame(annual, actual: pd.Series) -> pd.DataFrame:
    evaluation = annual.evaluation
    result = evaluation.features.loc[:, ["town", "flat_type"]].copy()
    result["year"] = annual.year
    result["actual"] = actual.reindex(evaluation.features.index)
    result["prediction"] = annual.predictions.reindex(evaluation.features.index)
    result["residual_sgd"] = (result["actual"] - result["prediction"]).abs()
    return result


def _point_frame(annual) -> pd.DataFrame:
    result = annual.evaluation.features.loc[:, ["town", "flat_type"]].copy()
    result["prediction"] = annual.predictions.reindex(annual.evaluation.features.index)
    return result


def _result_record(method, year, level, intervals, metrics) -> dict[str, object]:
    group_counts = intervals["calibration_group_rows"]
    return {
        "method": method.name,
        "year": year,
        "nominal_coverage": level,
        "empirical_coverage": metrics.empirical_coverage,
        "coverage_error_percentage_points": metrics.coverage_error_percentage_points,
        "mean_width_sgd": metrics.mean_width_sgd,
        "median_width_sgd": metrics.median_width_sgd,
        "prediction_count": metrics.prediction_count,
        "covered_count": metrics.covered_count,
        "global_calibration_rows": int(intervals["calibration_rows"].iloc[0]),
        "group_calibration_min": int(group_counts.min()),
        "group_calibration_median": float(group_counts.median()),
        "group_calibration_max": int(group_counts.max()),
        "global_fallback_count": int(intervals["used_global_fallback"].sum()),
    }


def _pooled_metrics(results: pd.DataFrame, method_name: str) -> pd.DataFrame:
    selected = results.loc[results["method"] == method_name]
    rows = []
    for level, group in selected.groupby("nominal_coverage", sort=True):
        count = int(group["prediction_count"].sum())
        covered = int(group["covered_count"].sum())
        empirical = covered / count
        rows.append(
            {
                "nominal_coverage": float(level),
                "empirical_coverage": empirical,
                "coverage_error_percentage_points": (empirical - float(level)) * 100,
                "mean_width_sgd": float(
                    (group["mean_width_sgd"] * group["prediction_count"]).sum() / count
                ),
                "prediction_count": count,
                "covered_count": covered,
            }
        )
    return pd.DataFrame(rows)


def _print_result_table(results: pd.DataFrame, *, title: str) -> None:
    print(f"\n{title}")
    print(
        "method | year | nominal | empirical | error pp | mean width SGD | "
        "median width SGD | n | calibration rows (global; group min/median/max)"
    )
    for row in results.sort_values(
        ["method", "year", "nominal_coverage"], kind="stable"
    ).itertuples(index=False):
        print(
            f"{row.method} | {row.year} | {row.nominal_coverage:.0%} | "
            f"{row.empirical_coverage:.2%} | {row.coverage_error_percentage_points:+.2f} | "
            f"${row.mean_width_sgd:,.2f} | ${row.median_width_sgd:,.2f} | "
            f"{row.prediction_count:,} | {row.global_calibration_rows:,}; "
            f"{row.group_calibration_min:,}/{row.group_calibration_median:,.0f}/"
            f"{row.group_calibration_max:,}"
        )


def _print_group_table(
    label: str, summary: pd.DataFrame, group_column: str, nominal_coverage: float
) -> None:
    print(f"\n2026 {label} coverage and width at {nominal_coverage:.0%} nominal")
    for row in summary.itertuples(index=False):
        support_note = " LOW SUPPORT" if row.low_support else ""
        print(
            f"  {getattr(row, group_column)}: n={row.support:,}, "
            f"coverage={row.empirical_coverage:.2%}, "
            f"error={row.coverage_error_percentage_points:+.2f} pp, "
            f"mean width=${row.mean_width_sgd:,.2f}{support_note}"
        )


def main() -> None:
    args = _parse_args()
    device: ComputeDevice = args.device
    started = perf_counter()
    devices = detect_gpu_devices()
    print(f"Requested device: {device}; NVIDIA GPU detected: {bool(devices)}")
    gpu_status = None
    if device == "gpu":
        try:
            gpu_status = verify_gpu_libraries()
        except (RuntimeError, OSError) as error:
            raise SystemExit(
                f"GPU preflight failed; no CPU fallback was attempted: {error}"
            ) from error
        print(
            f"GPU preflight passed: device {gpu_status['device'].index}, "
            f"{gpu_status['device'].name}; CatBoost {gpu_status['catboost_version']}; "
            f"XGBoost {gpu_status['xgboost_version']} smoke fit passed"
        )
    elif devices:
        print(f"Explicit CPU mode selected; detected GPU: {devices[0].name}")
    else:
        print("Explicit CPU mode selected; no NVIDIA GPU is required.")

    import catboost

    raw_path = find_raw_csv()
    raw = load_resale_data(raw_path)
    validate_required_columns(raw)
    prepared = prepare_features(raw)
    periods = pd.Series(prepared.transaction_period, index=prepared.features.index)
    print(
        f"Dataset={raw_path.name}; source=HDB via data.gov.sg; "
        "resource=d_8b84c4ee58e3cfc0ece0d773c8ca6abc; retrieval=2026-10-04; "
        f"rows={len(raw):,}"
    )
    print(
        f"Runtime versions: Python={platform.python_version()}; "
        f"CatBoost={catboost.__version__}; pandas={pd.__version__}; "
        f"NumPy={np.__version__}; device={device}"
    )
    print(
        f"Frozen point model: CatBoost depth={FROZEN_CATBOOST_CONFIG.depth}, "
        f"learning_rate={FROZEN_CATBOOST_CONFIG.learning_rate}, l2_leaf_reg=3, "
        f"seed=42, iterations={FROZEN_CATBOOST_ITERATIONS}"
    )
    print(f"Features: {', '.join(BOOSTED_FEATURES)}")
    print(f"Native categorical features: {', '.join(CATEGORICAL_FEATURES)}")
    print(
        "2021-2025 predictions are fixed-cutoff out-of-sample residual sources. "
        "2021 trains through 2020; 2022-2025 are used for method selection."
    )

    annual_records = []
    residual_frames = []
    # 2021 is calibration-only; its residuals become available after its
    # out-of-sample predictions are made and before the 2022 point fit begins.
    first_residual_year = evaluate_frozen_catboost_year(
        prepared.features,
        prepared.target,
        periods,
        2021,
        device=device,
        calculate_metrics=False,
    )
    print(
        f"OUT-OF-SAMPLE RESIDUAL YEAR 2021: train n={len(first_residual_year.training.features):,} "
        f"through 2020-12; evaluation n={len(first_residual_year.evaluation.features):,}; "
        f"fit={first_residual_year.fit_seconds:.2f}s; "
        f"predict={first_residual_year.prediction_seconds:.2f}s"
    )
    residual_frames.append(
        _residual_frame(
            first_residual_year,
            prepared.target.reindex(first_residual_year.evaluation.features.index),
        )
    )
    for year in HISTORICAL_EVALUATION_YEARS:
        # Calibration data is frozen from earlier residual years before this
        # year's point model is fit or its predictions are generated.
        residual_history = pd.concat(residual_frames, axis=0)
        annual = evaluate_frozen_catboost_year(
            prepared.features,
            prepared.target,
            periods,
            year,
            device=device,
            calculate_metrics=False,
        )
        print(
            f"OUT-OF-SAMPLE RESIDUAL YEAR {year}: train n={len(annual.training.features):,} "
            f"through {year - 1}-12; evaluation n={len(annual.evaluation.features):,}; "
            f"fit={annual.fit_seconds:.2f}s; predict={annual.prediction_seconds:.2f}s"
        )
        point_predictions = _point_frame(annual)
        frozen_intervals = {}
        for method in CALIBRATION_METHODS:
            for level in COVERAGE_LEVELS:
                frozen_intervals[(method.name, level)] = calibrate_prediction_intervals(
                    residual_history,
                    point_predictions,
                    year,
                    method,
                    level,
                )
        # Every candidate interval for this year is now fixed. Only now read
        # the current year's labels for coverage and future-year calibration.
        actual = prepared.target.reindex(annual.evaluation.features.index)
        for method in CALIBRATION_METHODS:
            for level in COVERAGE_LEVELS:
                intervals = frozen_intervals[(method.name, level)]
                metrics = calculate_interval_metrics(
                    actual, intervals, level
                )
                annual_records.append(
                    _result_record(method, year, level, intervals, metrics)
                )
        residual_frames.append(_residual_frame(annual, actual))

    # The final 2026 calibration pool includes every completed residual year,
    # including 2025 after its own historical intervals have been evaluated.
    residual_history = pd.concat(residual_frames, axis=0)
    historical_results = pd.DataFrame(annual_records)
    _print_result_table(historical_results, title="HISTORICAL CHRONOLOGICAL INTERVAL RESULTS")
    selected_method = select_calibration_method(historical_results)
    print(f"\nSELECTED CALIBRATION STRATEGY (2022-2025 only): {selected_method.name}")
    selected_history = historical_results.loc[
        historical_results["method"] == selected_method.name
    ].copy()
    pooled = _pooled_metrics(historical_results, selected_method.name)
    print("Selected strategy pooled historical metrics (row weighted):")
    for row in pooled.itertuples(index=False):
        print(
            f"  nominal={row.nominal_coverage:.0%}; empirical={row.empirical_coverage:.2%}; "
            f"error={row.coverage_error_percentage_points:+.2f} pp; "
            f"mean width=${row.mean_width_sgd:,.2f}; n={row.prediction_count:,}"
        )
    gate_passed = passes_ninety_percent_historical_gate(selected_history)
    print(
        "90% historical recommendation gate: "
        f"{'PASS' if gate_passed else 'FAIL'} "
        "(pooled coverage >=90%; each 2022-2025 year >=85%)."
    )
    print("The calibration strategy and gate are frozen before final 2026 evaluation.")

    # Final-test fitting and labels are accessed only after historical selection is fixed.
    final_annual = evaluate_frozen_catboost_year(
        prepared.features,
        prepared.target,
        periods,
        2026,
        device=device,
        evaluation_end_month=9,
        calculate_metrics=False,
    )
    final_points = _point_frame(final_annual)
    print(
        f"\nFINAL 2026 POINT MODEL: train n={len(final_annual.training.features):,} "
        "through 2025-12; evaluation n="
        f"{len(final_annual.evaluation.features):,} through 2026-09; "
        f"fit={final_annual.fit_seconds:.2f}s; "
        f"predict={final_annual.prediction_seconds:.2f}s"
    )
    final_intervals = {}
    for level in COVERAGE_LEVELS:
        intervals = calibrate_prediction_intervals(
            residual_history,
            final_points,
            2026,
            selected_method,
            level,
        )
        final_intervals[level] = intervals
    # Freeze all three final interval levels before accessing any 2026 target.
    final_actual = prepared.target.reindex(final_annual.evaluation.features.index)
    for level in COVERAGE_LEVELS:
        intervals = final_intervals[level]
        metrics = calculate_interval_metrics(final_actual, intervals, level)
        print(
            f"2026 {selected_method.name} nominal={level:.0%}: "
            f"empirical={metrics.empirical_coverage:.2%}; "
            f"error={metrics.coverage_error_percentage_points:+.2f} pp; "
            f"mean width=${metrics.mean_width_sgd:,.2f}; "
            f"median width=${metrics.median_width_sgd:,.2f}; "
            f"n={metrics.prediction_count:,}; "
            f"calibration rows={int(intervals['calibration_rows'].iloc[0]):,}"
        )

    selected_intervals = final_intervals[0.90]
    for group_column in ("town", "flat_type"):
        summary = summarize_interval_groups(
            final_actual,
            selected_intervals,
            group_column,
            0.90,
            minimum_support=LOW_SUPPORT_THRESHOLD,
        )
        _print_group_table("group", summary, group_column, 0.90)

    actual_values = final_actual
    ranks = actual_values.rank(method="first", pct=True)
    quartiles = pd.cut(
        ranks,
        bins=[0.0, 0.25, 0.50, 0.75, 1.0],
        labels=["Q1 lowest", "Q2", "Q3", "Q4 highest"],
        include_lowest=True,
    )
    price_intervals = selected_intervals.assign(actual_price_quartile=quartiles)
    quartile_summary = summarize_interval_groups(
        actual_values,
        price_intervals,
        "actual_price_quartile",
        0.90,
        minimum_support=LOW_SUPPORT_THRESHOLD,
    )
    _print_group_table("actual-price-quartile diagnostic", quartile_summary, "actual_price_quartile", 0.90)
    print(
        "Price-quartile groups use 2026 actual prices after intervals were frozen; "
        "they are diagnostic only and did not affect calibration or selection."
    )
    print(
        "90% recommendation: "
        f"{'supported by the historical gate' if gate_passed else 'not supported by the historical gate'}; "
        "2026 is reported as an untouched diagnostic, not used to retune."
    )
    print(f"Total uncertainty evaluation runtime: {perf_counter() - started:.2f}s")


if __name__ == "__main__":
    main()
