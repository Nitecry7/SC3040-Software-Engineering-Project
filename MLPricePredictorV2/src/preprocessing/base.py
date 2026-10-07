"""Build leakage-safe base features from individual transaction rows."""

from dataclasses import dataclass

import pandas as pd

from src.data.validate import REQUIRED_COLUMNS
from src.preprocessing.parsers import parse_remaining_lease, parse_storey_range

FEATURE_COLUMNS = (
    "transaction_year",
    "transaction_month",
    "town",
    "flat_type",
    "block",
    "street_name",
    "flat_model",
    "floor_area_sqm",
    "lease_commence_date",
    "storey_low",
    "storey_high",
    "storey_mid",
    "remaining_lease_months",
)


@dataclass(frozen=True)
class PreparedData:
    """Features, target, and month key kept separate for safe splitting."""

    features: pd.DataFrame
    target: pd.Series
    transaction_period: pd.Series


def _raise_row_error(kind: str, index: object, value: object, error: Exception) -> None:
    raise ValueError(f"Invalid {kind} at source index {index!r}: {value!r} ({error})") from error


def _parse_month(value: object, index: object) -> pd.Period:
    try:
        if not isinstance(value, str) or len(value) != 7 or value[4] != "-":
            raise ValueError("expected YYYY-MM")
        year, month = value.split("-")
        if len(year) != 4 or len(month) != 2 or not year.isdigit() or not month.isdigit():
            raise ValueError("expected YYYY-MM")
        return pd.Period(value, freq="M")
    except (TypeError, ValueError) as error:
        _raise_row_error("month", index, value, error)


def _parse_field(series: pd.Series, parser, field: str) -> list:
    results = []
    for index, value in series.items():
        try:
            results.append(parser(value))
        except (TypeError, ValueError) as error:
            _raise_row_error(field, index, value, error)
    return results


def prepare_features(data: pd.DataFrame) -> PreparedData:
    """Create only transaction-time base features, without target-derived values."""
    missing = sorted(REQUIRED_COLUMNS.difference(data.columns))
    if missing:
        raise ValueError(f"Dataset is missing required columns: {', '.join(missing)}")

    periods = pd.Series(
        [_parse_month(value, index) for index, value in data["month"].items()],
        index=data.index,
        name="transaction_period",
        dtype="period[M]",
    )
    parsed_storeys = _parse_field(data["storey_range"], parse_storey_range, "storey_range")
    leases = _parse_field(data["remaining_lease"], parse_remaining_lease, "remaining_lease")

    features = data.loc[
        :,
        [
            "town",
            "flat_type",
            "block",
            "street_name",
            "flat_model",
            "floor_area_sqm",
            "lease_commence_date",
        ],
    ].copy()
    features.insert(0, "transaction_month", periods.map(lambda period: period.month).to_numpy())
    features.insert(0, "transaction_year", periods.map(lambda period: period.year).to_numpy())
    features["storey_low"] = [bounds[0] for bounds in parsed_storeys]
    features["storey_high"] = [bounds[1] for bounds in parsed_storeys]
    features["storey_mid"] = [bounds[2] for bounds in parsed_storeys]
    features["remaining_lease_months"] = leases
    features = features.loc[:, list(FEATURE_COLUMNS)]

    target = data["resale_price"].copy().rename("resale_price")
    return PreparedData(features, target, periods)
