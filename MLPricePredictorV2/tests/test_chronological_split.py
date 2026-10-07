import pandas as pd
import pytest

from src.preprocessing.base import prepare_features
from src.splitting.chronological import SplitBoundaries, split_chronologically
from test_preprocessing import sample_data


def test_default_boundaries_split_by_month_and_preserve_partial_period():
    prepared = prepare_features(sample_data())
    split = split_chronologically(
        prepared.features, prepared.target, prepared.transaction_period
    )

    assert split.train.features.index.tolist() == [10]
    assert split.validation.features.index.tolist() == [20, 40]
    assert split.test.features.index.tolist() == [60]
    assert split.current_partial_period.features.index.tolist() == [30]
    assert split.train.transaction_period.max() < split.validation.transaction_period.min()
    assert split.validation.transaction_period.max() < split.test.transaction_period.min()
    assert split.test.transaction_period.max() < split.current_partial_period.transaction_period.min()
    assert sum(
        len(part.features)
        for part in (split.train, split.validation, split.test, split.current_partial_period)
    ) == len(prepared.features)


def test_configurable_contiguous_boundaries():
    boundaries = SplitBoundaries(
        train_start="2024-12",
        train_end="2024-12",
        validation_start="2025-01",
        validation_end="2025-02",
        test_start="2025-03",
        test_end="2025-03",
        partial_start="2025-04",
    )
    features = pd.DataFrame({"x": [1, 2, 3, 4]}, index=[3, 2, 1, 0])
    target = pd.Series([10, 20, 30, 40], index=features.index)
    periods = pd.Series(
        pd.PeriodIndex(["2024-12", "2025-01", "2025-03", "2025-04"], freq="M"),
        index=features.index,
    )
    split = split_chronologically(features, target, periods, boundaries)

    assert split.train.features.index.tolist() == [3]
    assert split.validation.features.index.tolist() == [2]
    assert split.test.features.index.tolist() == [1]
    assert split.current_partial_period.features.index.tolist() == [0]


def test_dates_before_configured_train_start_fail_with_index():
    features = pd.DataFrame({"x": [1]}, index=["source-row"])
    target = pd.Series([10], index=features.index)
    periods = pd.Series(pd.PeriodIndex(["2016-12"], freq="M"), index=features.index)

    with pytest.raises(ValueError, match="source-row"):
        split_chronologically(features, target, periods)


def test_non_contiguous_boundaries_fail():
    with pytest.raises(ValueError, match="Validation must start"):
        SplitBoundaries(validation_start="2025-02")


def test_misaligned_inputs_fail():
    features = pd.DataFrame({"x": [1]}, index=[0])
    target = pd.Series([1], index=[1])
    periods = pd.Series(pd.PeriodIndex(["2017-01"], freq="M"), index=[0])

    with pytest.raises(ValueError, match="identical indices"):
        split_chronologically(features, target, periods)
