"""Configurable chronological train, validation, test, and partial splits."""

from dataclasses import dataclass

import pandas as pd


def _period(value: str | pd.Period) -> pd.Period:
    result = value if isinstance(value, pd.Period) else pd.Period(value, freq="M")
    return result.asfreq("M")


@dataclass(frozen=True)
class SplitBoundaries:
    train_start: pd.Period = pd.Period("2017-01", freq="M")
    train_end: pd.Period = pd.Period("2024-12", freq="M")
    validation_start: pd.Period = pd.Period("2025-01", freq="M")
    validation_end: pd.Period = pd.Period("2025-12", freq="M")
    test_start: pd.Period = pd.Period("2026-01", freq="M")
    test_end: pd.Period = pd.Period("2026-09", freq="M")
    partial_start: pd.Period = pd.Period("2026-10", freq="M")

    def __post_init__(self) -> None:
        names = (
            "train_start", "train_end", "validation_start", "validation_end",
            "test_start", "test_end", "partial_start",
        )
        for name in names:
            object.__setattr__(self, name, _period(getattr(self, name)))
        if not self.train_start <= self.train_end:
            raise ValueError("Train start must be on or before train end")
        if self.validation_start != self.train_end + 1:
            raise ValueError("Validation must start in the month after train ends")
        if not self.validation_start <= self.validation_end:
            raise ValueError("Validation start must be on or before validation end")
        if self.test_start != self.validation_end + 1:
            raise ValueError("Test must start in the month after validation ends")
        if not self.test_start <= self.test_end:
            raise ValueError("Test start must be on or before test end")
        if self.partial_start != self.test_end + 1:
            raise ValueError("Partial period must start in the month after test ends")


@dataclass(frozen=True)
class DataPartition:
    features: pd.DataFrame
    target: pd.Series
    transaction_period: pd.Series


@dataclass(frozen=True)
class ChronologicalPartitions:
    train: DataPartition
    validation: DataPartition
    test: DataPartition
    current_partial_period: DataPartition


def split_chronologically(
    features: pd.DataFrame,
    target: pd.Series,
    transaction_period: pd.Series,
    boundaries: SplitBoundaries = SplitBoundaries(),
) -> ChronologicalPartitions:
    """Split aligned rows by month, preserving their indices and all records."""
    if not features.index.equals(target.index) or not features.index.equals(transaction_period.index):
        raise ValueError("Features, target, and transaction periods must have identical indices")
    if transaction_period.isna().any():
        raise ValueError("Transaction periods cannot be missing")

    periods = pd.PeriodIndex(transaction_period, freq="M")
    before_start = periods < boundaries.train_start
    if before_start.any():
        position = int(before_start.argmax())
        raise ValueError(
            "Transaction month outside configured coverage at source index "
            f"{features.index[position]!r}: {periods[position]}"
        )

    masks = {
        "train": (periods >= boundaries.train_start) & (periods <= boundaries.train_end),
        "validation": (periods >= boundaries.validation_start)
        & (periods <= boundaries.validation_end),
        "test": (periods >= boundaries.test_start) & (periods <= boundaries.test_end),
        "current_partial_period": periods >= boundaries.partial_start,
    }
    assignment_count = sum(mask.astype("int8") for mask in masks.values())
    if (assignment_count != 1).any():
        position = int((assignment_count != 1).argmax())
        raise ValueError(
            "Transaction month is not assigned exactly once at source index "
            f"{features.index[position]!r}: {periods[position]}"
        )

    def partition(mask) -> DataPartition:
        positions = mask.nonzero()[0]
        return DataPartition(
            features.iloc[positions].copy(),
            target.iloc[positions].copy(),
            transaction_period.iloc[positions].copy(),
        )

    result = ChronologicalPartitions(**{name: partition(mask) for name, mask in masks.items()})
    ordered = (result.train, result.validation, result.test)
    for earlier, later in zip(ordered, ordered[1:]):
        if not earlier.transaction_period.empty and not later.transaction_period.empty:
            if earlier.transaction_period.max() >= later.transaction_period.min():
                raise AssertionError("Chronological partitions overlap or are out of order")
    assigned_count = sum(
        len(part.features)
        for part in (result.train, result.validation, result.test, result.current_partial_period)
    )
    if assigned_count != len(features):
        raise AssertionError("Not all input records were assigned exactly once")
    return result
