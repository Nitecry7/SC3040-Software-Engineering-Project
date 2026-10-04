import numpy as np
import pandas as pd
import pytest

from src.preprocessing.parsers import parse_remaining_lease, parse_storey_range


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("61 years 04 months", 736),
        ("62 years 01 month", 745),
        ("63 years", 756),
        ("60 years", 720),
        ("  1   year   1   month ", 13),
        ("5 months", 5),
    ],
)
def test_parse_remaining_lease(value, expected):
    assert parse_remaining_lease(value) == expected


@pytest.mark.parametrize(
    "value", ["", "unknown", "61 years 12 months", "3 years ago", None, np.nan, pd.NA]
)
def test_malformed_remaining_lease_fails(value):
    with pytest.raises(ValueError):
        parse_remaining_lease(value)


def test_parse_storey_range():
    assert parse_storey_range("10 TO 12") == (10, 12, 11.0)
    assert parse_storey_range(" 01 to 03 ") == (1, 3, 2.0)


@pytest.mark.parametrize("value", ["10-12", "12 TO 10", "unknown", None])
def test_malformed_storey_range_fails(value):
    with pytest.raises(ValueError):
        parse_storey_range(value)
