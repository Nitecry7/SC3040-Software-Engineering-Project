"""Leakage-safe conformal intervals for chronological HDB price predictions."""

from dataclasses import dataclass
from decimal import Decimal, ROUND_CEILING
import math
from typing import Literal

import numpy as np
import pandas as pd

CoverageGroup = Literal["town", "flat_type"]
COVERAGE_LEVELS = (0.80, 0.90, 0.95)
HISTORICAL_EVALUATION_YEARS = (2022, 2023, 2024, 2025)
MIN_GROUP_CALIBRATION_SUPPORT = 30


@dataclass(frozen=True)
class CalibrationMethod:
    name: str
    history_years: int | None
    group_column: CoverageGroup | None
    simplicity_order: int


CALIBRATION_METHODS = (
    CalibrationMethod("global_all_years", None, None, 0),
    CalibrationMethod("global_recent_2_years", 2, None, 1),
    CalibrationMethod("global_recent_1_year", 1, None, 2),
    CalibrationMethod("town_all_years", None, "town", 3),
    CalibrationMethod("flat_type_all_years", None, "flat_type", 4),
)


@dataclass(frozen=True)
class IntervalMetrics:
    nominal_coverage: float
    empirical_coverage: float
    coverage_error_percentage_points: float
    mean_width_sgd: float
    median_width_sgd: float
    prediction_count: int
    covered_count: int


def finite_sample_conformal_quantile(
    absolute_residuals: pd.Series | np.ndarray | list[float],
    nominal_coverage: float,
) -> float:
    """Return the split-conformal order statistic using 1-indexed finite-sample rank."""
    _validate_coverage(nominal_coverage)
    residuals = np.asarray(absolute_residuals, dtype=float).reshape(-1)
    if residuals.size == 0:
        raise ValueError("Calibration residuals must not be empty")
    if not np.isfinite(residuals).all():
        raise ValueError("Calibration residuals must all be finite")
    if (residuals < 0).any():
        raise ValueError("Absolute calibration residuals cannot be negative")

    rank = int(
        (Decimal(residuals.size + 1) * Decimal(str(nominal_coverage))).to_integral_value(
            rounding=ROUND_CEILING
        )
    )
    if rank > residuals.size:
        return math.inf
    return float(np.partition(residuals, rank - 1)[rank - 1])


def symmetric_prediction_intervals(
    predictions: pd.Series | np.ndarray | list[float], quantile_sgd: float
) -> pd.DataFrame:
    """Build prediction +/- quantile intervals while preserving a Series index."""
    values = np.asarray(predictions, dtype=float).reshape(-1)
    if values.size == 0:
        raise ValueError("Predictions must not be empty")
    if not np.isfinite(values).all():
        raise ValueError("Predictions must all be finite")
    if math.isnan(quantile_sgd) or quantile_sgd < 0:
        raise ValueError("Conformal quantile must be non-negative and not NaN")
    index = predictions.index if isinstance(predictions, pd.Series) else None
    return pd.DataFrame(
        {
            "prediction": values,
            "lower_bound": values - quantile_sgd,
            "upper_bound": values + quantile_sgd,
            "quantile_sgd": quantile_sgd,
        },
        index=index,
    )


def select_prior_residuals(
    residual_history: pd.DataFrame,
    evaluation_year: int,
    method: CalibrationMethod,
) -> pd.DataFrame:
    """Keep only out-of-sample residuals strictly earlier than evaluation year."""
    required = {"year", "residual_sgd", "town", "flat_type"}
    missing = sorted(required.difference(residual_history.columns))
    if missing:
        raise ValueError(f"Residual history is missing columns: {', '.join(missing)}")
    years = pd.to_numeric(residual_history["year"], errors="coerce")
    if (
        years.isna().any()
        or not np.isfinite(years.to_numpy(dtype=float)).all()
        or not np.equal(years, np.floor(years)).all()
    ):
        raise ValueError("Residual years must be finite integers")
    residuals = pd.to_numeric(residual_history["residual_sgd"], errors="coerce")
    prior_mask = years < evaluation_year
    selected = residual_history.loc[prior_mask].copy()
    selected["year"] = years.loc[prior_mask].astype(int)
    selected["residual_sgd"] = residuals.loc[prior_mask]
    if method.history_years is not None and not selected.empty:
        first_year = evaluation_year - method.history_years
        selected = selected.loc[selected["year"] >= first_year].copy()
    if selected.empty:
        raise ValueError(
            f"No prior out-of-sample residuals are available for {evaluation_year} "
            f"with method {method.name}"
        )
    if not np.isfinite(selected["residual_sgd"].to_numpy(dtype=float)).all():
        raise ValueError("Prior calibration residuals must all be finite")
    if (selected["residual_sgd"] < 0).any():
        raise ValueError("Absolute calibration residuals cannot be negative")
    if (selected["year"] >= evaluation_year).any():
        raise AssertionError("Calibration data contains evaluation-year or future residuals")
    return selected


def calibrate_prediction_intervals(
    residual_history: pd.DataFrame,
    point_predictions: pd.DataFrame,
    evaluation_year: int,
    method: CalibrationMethod,
    nominal_coverage: float,
    minimum_group_support: int = MIN_GROUP_CALIBRATION_SUPPORT,
) -> pd.DataFrame:
    """Apply a frozen calibration policy to predictions without reading their targets."""
    _validate_coverage(nominal_coverage)
    if minimum_group_support < 1:
        raise ValueError("minimum_group_support must be positive")
    if point_predictions.empty:
        raise ValueError("Point predictions must not be empty")
    if "prediction" not in point_predictions.columns:
        raise ValueError("Point predictions must contain a prediction column")
    if {"actual", "residual_sgd"}.intersection(point_predictions.columns):
        raise ValueError("Point predictions must not contain evaluation targets or residuals")
    if method.group_column and method.group_column not in point_predictions.columns:
        raise ValueError(f"Point predictions are missing group column {method.group_column}")

    values = pd.to_numeric(point_predictions["prediction"], errors="coerce")
    if not np.isfinite(values.to_numpy(dtype=float)).all():
        raise ValueError("Point predictions must all be finite")
    calibration = select_prior_residuals(residual_history, evaluation_year, method)
    global_quantile = finite_sample_conformal_quantile(
        calibration["residual_sgd"], nominal_coverage
    )
    result = point_predictions.copy()
    result["prediction"] = values
    result["calibration_rows"] = len(calibration)
    result["calibration_group_rows"] = len(calibration)
    result["used_global_fallback"] = False
    result["quantile_sgd"] = global_quantile

    if method.group_column:
        thresholds: dict[object, tuple[float, int]] = {}
        for label, group in calibration.groupby(method.group_column, sort=True, dropna=True):
            if len(group) >= minimum_group_support:
                thresholds[label] = (
                    finite_sample_conformal_quantile(group["residual_sgd"], nominal_coverage),
                    len(group),
                )
        mapped = result[method.group_column].map(thresholds)
        has_group_threshold = mapped.notna()
        result.loc[has_group_threshold, "quantile_sgd"] = mapped.loc[
            has_group_threshold
        ].map(lambda value: value[0])
        result.loc[has_group_threshold, "calibration_group_rows"] = mapped.loc[
            has_group_threshold
        ].map(lambda value: value[1])
        result["used_global_fallback"] = ~has_group_threshold

    result["lower_bound"] = result["prediction"] - result["quantile_sgd"]
    result["upper_bound"] = result["prediction"] + result["quantile_sgd"]
    return result


def calculate_interval_metrics(
    actual: pd.Series,
    intervals: pd.DataFrame,
    nominal_coverage: float,
) -> IntervalMetrics:
    """Measure empirical coverage and interval width after intervals are frozen."""
    _validate_coverage(nominal_coverage)
    required = {"lower_bound", "upper_bound"}
    missing = sorted(required.difference(intervals.columns))
    if missing:
        raise ValueError(f"Intervals are missing columns: {', '.join(missing)}")
    if actual.empty or len(actual) != len(intervals):
        raise ValueError("Actual values and intervals must have the same non-zero length")
    if not actual.index.equals(intervals.index):
        raise ValueError("Actual values and intervals must have identical ordered indices")
    actual_values = pd.to_numeric(actual, errors="coerce").to_numpy(dtype=float)
    lower = pd.to_numeric(intervals["lower_bound"], errors="coerce").to_numpy(dtype=float)
    upper = pd.to_numeric(intervals["upper_bound"], errors="coerce").to_numpy(dtype=float)
    if not np.isfinite(actual_values).all() or np.isnan(lower).any() or np.isnan(upper).any():
        raise ValueError("Actual values must be finite and interval bounds must not contain NaN")
    if (lower > upper).any():
        raise ValueError("Each interval lower bound must be <= its upper bound")
    covered = (actual_values >= lower) & (actual_values <= upper)
    widths = upper - lower
    empirical = float(covered.mean())
    return IntervalMetrics(
        nominal_coverage=nominal_coverage,
        empirical_coverage=empirical,
        coverage_error_percentage_points=(empirical - nominal_coverage) * 100,
        mean_width_sgd=float(widths.mean()),
        median_width_sgd=float(np.median(widths)),
        prediction_count=len(actual_values),
        covered_count=int(covered.sum()),
    )


def summarize_interval_groups(
    actual: pd.Series,
    intervals: pd.DataFrame,
    group_column: str,
    nominal_coverage: float,
    minimum_support: int = MIN_GROUP_CALIBRATION_SUPPORT,
) -> pd.DataFrame:
    """Return deterministic coverage and width diagnostics for observed groups."""
    if group_column not in intervals.columns:
        raise ValueError(f"Intervals are missing group column {group_column}")
    if not actual.index.equals(intervals.index):
        raise ValueError("Actual values and intervals must have identical ordered indices")
    working = intervals.copy()
    working["actual"] = actual
    rows = []
    for label, group in working.groupby(group_column, sort=True, dropna=False):
        metrics = calculate_interval_metrics(
            group["actual"], group, nominal_coverage
        )
        rows.append(
            {
                group_column: label,
                "support": metrics.prediction_count,
                "low_support": metrics.prediction_count < minimum_support,
                "empirical_coverage": metrics.empirical_coverage,
                "coverage_error_percentage_points": metrics.coverage_error_percentage_points,
                "mean_width_sgd": metrics.mean_width_sgd,
                "median_width_sgd": metrics.median_width_sgd,
            }
        )
    return pd.DataFrame(rows)


def select_calibration_method(annual_results: pd.DataFrame) -> CalibrationMethod:
    """Select one method from pre-2026 annual metrics only, never from final-test results."""
    required = {
        "method",
        "year",
        "nominal_coverage",
        "empirical_coverage",
        "mean_width_sgd",
        "prediction_count",
    }
    missing = sorted(required.difference(annual_results.columns))
    if missing:
        raise ValueError(f"Annual uncertainty results are missing columns: {', '.join(missing)}")
    if annual_results.empty:
        raise ValueError("Annual uncertainty results must not be empty")
    result_years = pd.to_numeric(annual_results["year"], errors="coerce")
    if result_years.isna().any() or (result_years >= 2026).any():
        raise ValueError("Uncertainty method selection must not contain 2026 or later results")

    expected = {
        (year, level)
        for year in HISTORICAL_EVALUATION_YEARS
        for level in COVERAGE_LEVELS
    }
    methods_by_name = {method.name: method for method in CALIBRATION_METHODS}
    scored = []
    for name, group in annual_results.groupby("method", sort=True):
        if name not in methods_by_name:
            raise ValueError(f"Unknown calibration method: {name}")
        cells = set(zip(group["year"].astype(int), group["nominal_coverage"].astype(float)))
        if cells != expected or len(group) != len(expected):
            raise ValueError(
                f"Method {name} must contain one result for each 2022-2025 year "
                "and 80%, 90%, 95% coverage level"
            )
        worst_undercoverage = max(
            max(0.0, float(row.nominal_coverage - row.empirical_coverage))
            for row in group.itertuples(index=False)
        )
        pooled_errors = []
        for level, level_rows in group.groupby("nominal_coverage", sort=True):
            total = int(level_rows["prediction_count"].sum())
            pooled = float(
                (
                    level_rows["empirical_coverage"]
                    * level_rows["prediction_count"]
                ).sum()
                / total
            )
            pooled_errors.append(abs(pooled - float(level)))
        mean_calibration_error = float(np.mean(pooled_errors))
        all_rows = int(group["prediction_count"].sum())
        mean_width = float(
            (group["mean_width_sgd"] * group["prediction_count"]).sum() / all_rows
        )
        method = methods_by_name[name]
        scored.append(
            (
                worst_undercoverage,
                mean_calibration_error,
                mean_width,
                method.simplicity_order,
                method,
            )
        )
    if set(annual_results["method"].unique()) != set(methods_by_name):
        raise ValueError("Annual results must include all five predeclared calibration methods")
    return min(scored, key=lambda item: item[:4])[4]


def passes_ninety_percent_historical_gate(annual_results: pd.DataFrame) -> bool:
    """Require pooled 90% coverage and at least 85% in each 2022-2025 year."""
    selected = annual_results.loc[annual_results["nominal_coverage"] == 0.90].copy()
    if set(selected["year"].astype(int)) != set(HISTORICAL_EVALUATION_YEARS):
        raise ValueError("The 90% historical gate requires results for 2022 through 2025")
    total = int(selected["prediction_count"].sum())
    pooled = float(
        (selected["empirical_coverage"] * selected["prediction_count"]).sum() / total
    )
    return pooled >= 0.90 and bool((selected["empirical_coverage"] >= 0.85).all())


def classify_asking_price(
    asking_price: float, lower_bound: float, upper_bound: float
) -> Literal[
    "below_estimated_market_range",
    "within_estimated_market_range",
    "above_estimated_market_range",
]:
    """Classify asking-price position relative to an estimated interval, not value."""
    values = np.asarray([asking_price, lower_bound, upper_bound], dtype=float)
    if np.isnan(values).any() or not np.isfinite(asking_price):
        raise ValueError("Asking price must be finite and bounds must not be NaN")
    if lower_bound > upper_bound:
        raise ValueError("Lower bound must be <= upper bound")
    if asking_price < lower_bound:
        return "below_estimated_market_range"
    if asking_price > upper_bound:
        return "above_estimated_market_range"
    return "within_estimated_market_range"


def _validate_coverage(nominal_coverage: float) -> None:
    if not math.isfinite(nominal_coverage) or not 0 < nominal_coverage < 1:
        raise ValueError("nominal_coverage must be finite and strictly between 0 and 1")
