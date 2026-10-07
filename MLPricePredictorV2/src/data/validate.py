"""Schema checks for the raw HDB resale transaction dataset."""

import pandas as pd

REQUIRED_COLUMNS = frozenset(
    {
        "month",
        "town",
        "flat_type",
        "block",
        "street_name",
        "storey_range",
        "floor_area_sqm",
        "flat_model",
        "lease_commence_date",
        "remaining_lease",
        "resale_price",
    }
)


def validate_required_columns(data: pd.DataFrame) -> None:
    """Raise ValueError when any required source column is absent."""
    missing = sorted(REQUIRED_COLUMNS.difference(data.columns))
    if missing:
        raise ValueError(f"Dataset is missing required columns: {', '.join(missing)}")
