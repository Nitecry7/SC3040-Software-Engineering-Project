"""Shared validation and result construction for historical baselines."""

import pandas as pd

HISTORY_COLUMNS = {"transaction_period", "resale_price", "town", "flat_type"}
TARGET_COLUMNS = {"transaction_period", "town", "flat_type"}
RESULT_COLUMNS = (
    "prediction",
    "fallback_level",
    "candidate_count",
    "comparable_count",
    "lookback_months",
    "target_month",
    "historical_cutoff_month",
    "selected_comparable_indices",
)


def validate_target_rows(target_rows: pd.DataFrame) -> pd.Period:
    missing_targets = sorted(TARGET_COLUMNS.difference(target_rows.columns))
    if missing_targets:
        raise ValueError(f"Target rows are missing required columns: {', '.join(missing_targets)}")
    if "resale_price" in target_rows:
        raise ValueError("Target rows must not contain resale_price")
    if target_rows.empty:
        raise ValueError("Target rows must contain at least one row")
    months = pd.PeriodIndex(target_rows["transaction_period"], freq="M").unique()
    if len(months) != 1:
        raise ValueError("Each baseline prediction call must contain exactly one target month")
    return months[0]


def validate_inputs(history: pd.DataFrame, target_rows: pd.DataFrame) -> pd.Period:
    missing_history = sorted(HISTORY_COLUMNS.difference(history.columns))
    if missing_history:
        raise ValueError(f"History is missing required columns: {', '.join(missing_history)}")
    target_month = validate_target_rows(target_rows)
    return target_month


def eligible_history(history: pd.DataFrame, target_month: pd.Period) -> pd.DataFrame:
    """Filter strictly prior rows even when a caller supplies a broader frame."""
    periods = pd.PeriodIndex(history["transaction_period"], freq="M")
    eligible = history.loc[periods < target_month]
    if eligible.empty:
        raise ValueError(f"No historical transactions exist before {target_month}")
    if eligible["resale_price"].isna().any():
        raise ValueError("Eligible historical resale_price values cannot be missing")
    return eligible


def result_frame(
    target_rows: pd.DataFrame,
    predictions: list[float],
    fallback_levels: list[str],
    *,
    candidate_counts: list[int] | None = None,
    comparable_counts: list[int] | None = None,
    lookback_months: int | None = None,
    selected_indices: list[tuple[object, ...]] | None = None,
) -> pd.DataFrame:
    target_month = pd.PeriodIndex(target_rows["transaction_period"], freq="M")[0]
    row_count = len(target_rows)
    result = pd.DataFrame(
        {
            "prediction": predictions,
            "fallback_level": fallback_levels,
            "candidate_count": candidate_counts or [0] * row_count,
            "comparable_count": comparable_counts or [0] * row_count,
            "lookback_months": [lookback_months] * row_count,
            "target_month": [target_month] * row_count,
            "historical_cutoff_month": [target_month - 1] * row_count,
            "selected_comparable_indices": selected_indices or [tuple()] * row_count,
        },
        index=target_rows.index,
    )
    return result.loc[:, RESULT_COLUMNS]
