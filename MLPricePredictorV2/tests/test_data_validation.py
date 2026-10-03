import pandas as pd
import pytest

from src.data.validate import REQUIRED_COLUMNS, validate_required_columns


def test_required_column_set_matches_hdb_source_schema():
    assert REQUIRED_COLUMNS == {
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


def test_missing_required_column_fails():
    data = pd.DataFrame(columns=REQUIRED_COLUMNS - {"resale_price"})

    with pytest.raises(ValueError, match="resale_price"):
        validate_required_columns(data)


def test_valid_dataset_schema_is_accepted():
    data = pd.DataFrame(columns=sorted(REQUIRED_COLUMNS))

    assert validate_required_columns(data) is None
