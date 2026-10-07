"""Recent comparable-sales median with price-independent matching."""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from src.baselines.common import (
    eligible_history,
    result_frame,
    validate_inputs,
    validate_target_rows,
)


@dataclass(frozen=True)
class ComparableConfig:
    lookback_months: int = 12
    minimum_comparables: int = 5
    maximum_comparables: int = 30
    floor_area_tolerance_sqm: float = 10.0
    storey_mid_tolerance: float = 6.0
    remaining_lease_tolerance_months: int = 60

    def __post_init__(self) -> None:
        if self.lookback_months <= 0:
            raise ValueError("lookback_months must be positive")
        if self.minimum_comparables <= 0 or self.maximum_comparables <= 0:
            raise ValueError("Comparable minimum and maximum must be positive")
        if self.minimum_comparables > self.maximum_comparables:
            raise ValueError("minimum_comparables cannot exceed maximum_comparables")
        if self.floor_area_tolerance_sqm <= 0:
            raise ValueError("floor_area_tolerance_sqm must be positive")
        if self.storey_mid_tolerance <= 0:
            raise ValueError("storey_mid_tolerance must be positive")
        if self.remaining_lease_tolerance_months <= 0:
            raise ValueError("remaining_lease_tolerance_months must be positive")


DEFAULT_COMPARABLE_CONFIG = ComparableConfig()


def _source_ranks(indices: pd.Index) -> np.ndarray:
    """Produce a stable, sortable rank for arbitrary original index values."""
    ordered = sorted(set(indices.tolist()), key=lambda value: (type(value).__name__, repr(value)))
    ranks = {value: rank for rank, value in enumerate(ordered)}
    return np.asarray([ranks[value] for value in indices], dtype=np.int64)


class ComparableHistoryIndex:
    """Candidate index built from transactions strictly before one target month."""

    def __init__(self, history: pd.DataFrame, target_month: pd.Period):
        missing = sorted(
            {"floor_area_sqm", "storey_mid", "remaining_lease_months"}.difference(history.columns)
        )
        if missing:
            raise ValueError(f"History is missing comparable fields: {', '.join(missing)}")
        self.target_month = target_month
        prior = eligible_history(history, target_month)
        self.global_median = float(prior["resale_price"].median())
        self.group_medians = prior.groupby(
            ["town", "flat_type"], dropna=False
        )["resale_price"].median()
        self.cutoff_ordinal = target_month.ordinal
        self.grouped_arrays = {}
        for key, group in prior.groupby(["town", "flat_type"], sort=False, dropna=False):
            self.grouped_arrays[key] = {
                "period": np.asarray(
                    [period.ordinal for period in group["transaction_period"]], dtype=np.int64
                ),
                "area": group["floor_area_sqm"].to_numpy(dtype=float),
                "storey": group["storey_mid"].to_numpy(dtype=float),
                "lease": group["remaining_lease_months"].to_numpy(dtype=float),
                "price": group["resale_price"].to_numpy(dtype=float),
                "index": group.index.to_list(),
                "source_rank": _source_ranks(group.index),
            }

    def predict(
        self,
        target_rows: pd.DataFrame,
        config: ComparableConfig = DEFAULT_COMPARABLE_CONFIG,
        include_selected_indices: bool = True,
    ) -> pd.DataFrame:
        target_month = validate_target_rows(target_rows)
        if target_month != self.target_month:
            raise ValueError("Comparable index can only predict its indexed target month")
        comparable_columns = {"floor_area_sqm", "storey_mid", "remaining_lease_months"}
        missing_target = sorted(comparable_columns.difference(target_rows.columns))
        if missing_target:
            raise ValueError(f"Target rows are missing comparable fields: {', '.join(missing_target)}")
        first_ordinal = (target_month - config.lookback_months).ordinal
        predictions = []
        fallback_levels = []
        candidate_counts = []
        comparable_counts = []
        selected_indices = []

        for target_row in target_rows.to_dict(orient="records"):
            key = (target_row["town"], target_row["flat_type"])
            arrays = self.grouped_arrays.get(key)
            candidate_positions = np.empty(0, dtype=np.int64)
            scores = np.empty(0, dtype=float)
            if arrays is not None:
                area_difference = np.abs(arrays["area"] - float(target_row["floor_area_sqm"]))
                storey_difference = np.abs(arrays["storey"] - float(target_row["storey_mid"]))
                lease_difference = np.abs(
                    arrays["lease"] - float(target_row["remaining_lease_months"])
                )
                age = self.cutoff_ordinal - arrays["period"]
                eligible = (
                    (arrays["period"] >= first_ordinal)
                    & (arrays["period"] < self.cutoff_ordinal)
                    & (age >= 1)
                    & np.isfinite(arrays["area"])
                    & np.isfinite(arrays["storey"])
                    & np.isfinite(arrays["lease"])
                    & (area_difference <= config.floor_area_tolerance_sqm)
                    & (storey_difference <= config.storey_mid_tolerance)
                    & (lease_difference <= config.remaining_lease_tolerance_months)
                )
                candidate_positions = np.flatnonzero(eligible)
                scores = (
                    area_difference[candidate_positions] / config.floor_area_tolerance_sqm
                    + storey_difference[candidate_positions] / config.storey_mid_tolerance
                    + lease_difference[candidate_positions]
                    / config.remaining_lease_tolerance_months
                    + age[candidate_positions] / config.lookback_months
                )

            candidate_count = len(candidate_positions)
            candidate_counts.append(candidate_count)
            if candidate_count >= config.minimum_comparables:
                candidate_periods = arrays["period"][candidate_positions]
                candidate_ranks = arrays["source_rank"][candidate_positions]
                order = np.lexsort((candidate_ranks, -candidate_periods, scores))
                selected_positions = candidate_positions[order[: config.maximum_comparables]]
                selected_ids = (
                    tuple(arrays["index"][position] for position in selected_positions)
                    if include_selected_indices
                    else tuple()
                )
                predictions.append(float(np.median(arrays["price"][selected_positions])))
                fallback_levels.append("comparable")
                comparable_counts.append(len(selected_positions))
                selected_indices.append(selected_ids)
            else:
                group_key = (target_row["town"], target_row["flat_type"])
                if group_key in self.group_medians.index:
                    predictions.append(float(self.group_medians.loc[group_key]))
                    fallback_levels.append("town_flat_type")
                else:
                    predictions.append(self.global_median)
                    fallback_levels.append("global")
                comparable_counts.append(0)
                selected_indices.append(tuple())

        return result_frame(
            target_rows,
            predictions,
            fallback_levels,
            candidate_counts=candidate_counts,
            comparable_counts=comparable_counts,
            lookback_months=config.lookback_months,
            selected_indices=selected_indices,
        )


def predict_comparable_sales(
    history: pd.DataFrame,
    target_rows: pd.DataFrame,
    config: ComparableConfig = DEFAULT_COMPARABLE_CONFIG,
    include_selected_indices: bool = True,
) -> pd.DataFrame:
    """Predict from similar, strictly prior sales; fall back to historical medians."""
    target_month = validate_inputs(history, target_rows)
    index = ComparableHistoryIndex(history, target_month)
    return index.predict(target_rows, config, include_selected_indices)
