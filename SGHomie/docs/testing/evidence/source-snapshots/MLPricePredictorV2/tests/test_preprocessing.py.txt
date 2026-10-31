import pandas as pd
import pytest

from src.preprocessing.base import FEATURE_COLUMNS, prepare_features


def sample_data():
    return pd.DataFrame(
        {
            "month": ["2024-12", "2025-01", "2026-10", "2025-02", "2026-06"],
            "town": ["A", "B", "C", "D", "E"],
            "flat_type": ["3 ROOM"] * 5,
            "block": ["1"] * 5,
            "street_name": ["ROAD"] * 5,
            "storey_range": ["01 TO 03", "10 TO 12", "04 TO 06", "07 TO 09", "13 TO 15"],
            "floor_area_sqm": [67.0, 68.0, 69.0, 70.0, 71.0],
            "flat_model": ["Model A"] * 5,
            "lease_commence_date": [1980] * 5,
            "remaining_lease": ["60 years", "61 years 1 month", "62 years", "63 years", "64 years"],
            "resale_price": [300000.0, 400000.0, 500000.0, 600000.0, 700000.0],
        },
        index=[10, 20, 30, 40, 60],
    )


def test_features_separate_target_and_parse_transaction_month():
    data = sample_data()
    prepared = prepare_features(data)

    assert tuple(prepared.features.columns) == FEATURE_COLUMNS
    assert "resale_price" not in prepared.features
    pd.testing.assert_series_equal(prepared.target, data["resale_price"])
    assert prepared.transaction_period.tolist() == [
        pd.Period("2024-12", freq="M"),
        pd.Period("2025-01", freq="M"),
        pd.Period("2026-10", freq="M"),
        pd.Period("2025-02", freq="M"),
        pd.Period("2026-06", freq="M"),
    ]
    assert prepared.features.loc[10, ["transaction_year", "transaction_month"]].tolist() == [2024, 12]
    assert prepared.features.loc[20, "remaining_lease_months"] == 733


@pytest.mark.parametrize(
    ("column", "value"),
    [
        ("month", "2025-13"),
        ("storey_range", "upper floor"),
        ("remaining_lease", "about 60 years"),
    ],
)
def test_malformed_values_fail_with_source_index_and_value(column, value):
    data = sample_data()
    data.loc[20, column] = value

    with pytest.raises(ValueError, match="source index 20") as error:
        prepare_features(data)
    assert value in str(error.value)


def test_duplicate_source_rows_and_indices_are_preserved():
    data = sample_data()
    duplicate = data.iloc[[0]].copy()
    duplicate.index = [50]
    data = pd.concat([data, duplicate])
    prepared = prepare_features(data)

    assert len(prepared.features) == len(data)
    assert prepared.features.index.tolist() == data.index.tolist()
    assert prepared.features.iloc[0].equals(prepared.features.iloc[-1])
    assert prepared.target.iloc[0] == prepared.target.iloc[-1]


def test_validation_and_test_target_values_do_not_influence_features():
    data = sample_data()
    original = prepare_features(data)
    changed = data.copy()
    changed.loc[[20, 40, 60], "resale_price"] = [99999999, 1, 88888888]
    updated = prepare_features(changed)

    pd.testing.assert_frame_equal(original.features, updated.features)
