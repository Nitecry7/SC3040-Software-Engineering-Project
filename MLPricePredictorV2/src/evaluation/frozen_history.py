"""Comparable-sales evaluation with a fixed historical information cutoff."""

import pandas as pd

from src.baselines.comparable_sales import ComparableConfig, predict_comparable_sales
from src.evaluation.walk_forward import PARTIAL_PERIOD_START


def evaluate_frozen_history_comparable(
    all_rows: pd.DataFrame,
    evaluation_rows: pd.DataFrame,
    cutoff_month: pd.Period,
    config: ComparableConfig,
) -> pd.DataFrame:
    """Evaluate a comparable baseline without adding evaluation rows to history.

    ``all_rows`` may contain the full prepared dataset. Only rows through the
    declared cutoff are passed as historical transactions. Evaluation targets
    are stripped before prediction, and the same frozen history is supplied
    for each target month.
    """
    required = {
        "transaction_period",
        "resale_price",
        "town",
        "flat_type",
        "floor_area_sqm",
        "storey_mid",
        "remaining_lease_months",
    }
    missing_history = sorted(required.difference(all_rows.columns))
    missing_evaluation = sorted(required.difference(evaluation_rows.columns))
    if missing_history:
        raise ValueError(f"History rows are missing columns: {', '.join(missing_history)}")
    if missing_evaluation:
        raise ValueError(f"Evaluation rows are missing columns: {', '.join(missing_evaluation)}")
    if all_rows.empty or evaluation_rows.empty:
        raise ValueError("History and evaluation rows must both contain data")
    if not isinstance(cutoff_month, pd.Period):
        cutoff_month = pd.Period(cutoff_month, freq="M")
    cutoff_month = cutoff_month.asfreq("M")

    history_periods = pd.PeriodIndex(all_rows["transaction_period"], freq="M")
    if history_periods.isna().any():
        raise ValueError("History transaction periods cannot be missing")
    frozen_history = all_rows.loc[history_periods <= cutoff_month].copy()
    if frozen_history.empty:
        raise ValueError(f"No historical transactions exist through {cutoff_month}")

    evaluation_periods = pd.PeriodIndex(evaluation_rows["transaction_period"], freq="M")
    if evaluation_periods.isna().any():
        raise ValueError("Evaluation transaction periods cannot be missing")
    if (evaluation_periods <= cutoff_month).any():
        raise ValueError("Evaluation rows must be strictly after the frozen history cutoff")
    if (evaluation_periods >= PARTIAL_PERIOD_START).any():
        raise ValueError("The current partial period must not be included in evaluation")
    if set(evaluation_periods.year) != {cutoff_month.year + 1}:
        raise ValueError("A frozen-history evaluation must cover one year after its cutoff")

    period_results = []
    for month in sorted(evaluation_periods.unique()):
        positions = (evaluation_periods == month).nonzero()[0]
        month_rows = evaluation_rows.iloc[positions]
        target_rows = month_rows.drop(columns="resale_price")
        predictions = predict_comparable_sales(
            frozen_history,
            target_rows,
            config=config,
            include_selected_indices=False,
        )
        predictions["actual"] = month_rows["resale_price"].to_numpy()
        predictions["town"] = month_rows["town"].to_numpy()
        predictions["flat_type"] = month_rows["flat_type"].to_numpy()
        predictions["source_index"] = month_rows.index.to_list()
        # The source predictor's per-month cutoff describes eligibility. Report
        # the actual fixed upper bound of this evaluation history instead.
        predictions["historical_cutoff_month"] = cutoff_month
        period_results.append(predictions)

    combined = pd.concat(period_results, axis=0)
    return combined.sort_values(["target_month", "source_index"], kind="stable")
