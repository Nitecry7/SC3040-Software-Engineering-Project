"""Leakage and boundary regressions using synthetic fixtures only.

Public split/baseline interfaces exercise black-box equivalence classes;
copy isolation, calibration validation and comparable tie paths exercise
white-box invariants. No real transaction data or large model training.
"""

from dataclasses import replace

import pandas as pd
import pytest

from src.baselines.comparable_sales import ComparableConfig, ComparableHistoryIndex, predict_comparable_sales
from src.evaluation.metrics import calculate_regression_metrics
from src.inference.bundle import OutOfSamplePredictionFold, build_calibration_residuals, build_uncertainty_state
from src.preprocessing.base import prepare_features
from src.splitting.chronological import SplitBoundaries, split_chronologically
from test_baselines import frame, row, target
from test_preprocessing import sample_data
from test_valuation_bundle import residual_history


def split_fixture():
    months = ["2017-01", "2024-12", "2025-01", "2025-12", "2026-01", "2026-09", "2026-10", "2027-01"]
    index = pd.Index([8, 7, 6, 5, 4, 3, 2, 1])
    features = pd.DataFrame({"x": range(len(months))}, index=index)
    targets = pd.Series(range(100, 100 + len(months)), index=index)
    periods = pd.Series(pd.PeriodIndex(months, freq="M"), index=index)
    return features, targets, periods


def test_split_assigns_every_inclusive_boundary_once_and_preserves_later_partial_months():
    features, targets, periods = split_fixture()
    partitions = split_chronologically(features, targets, periods)
    assert partitions.train.features.index.tolist() == [8, 7]
    assert partitions.validation.features.index.tolist() == [6, 5]
    assert partitions.test.features.index.tolist() == [4, 3]
    assert partitions.current_partial_period.features.index.tolist() == [2, 1]
    assigned = [index for part in vars(partitions).values() for index in part.features.index]
    assert assigned == features.index.tolist()
    assert len(set(assigned)) == len(features)


def test_split_returns_isolated_copies_for_features_targets_and_periods():
    features, targets, periods = split_fixture()
    original_features, original_targets, original_periods = features.copy(), targets.copy(), periods.copy()
    partitions = split_chronologically(features, targets, periods)
    partitions.train.features.iloc[0, 0] = -99
    partitions.train.target.iloc[0] = -99
    partitions.train.transaction_period.iloc[0] = pd.Period("2000-01", freq="M")
    pd.testing.assert_frame_equal(features, original_features)
    pd.testing.assert_series_equal(targets, original_targets)
    pd.testing.assert_series_equal(periods, original_periods)


def test_split_missing_transaction_period_fails_instead_of_silently_dropping_row():
    features, targets, periods = split_fixture()
    periods.iloc[3] = pd.NaT
    with pytest.raises(ValueError, match="cannot be missing"):
        split_chronologically(features, targets, periods)


def test_split_rejects_period_index_misalignment_even_when_lengths_match():
    features, targets, periods = split_fixture()
    periods.index = list(reversed(periods.index))
    with pytest.raises(ValueError, match="identical indices"):
        split_chronologically(features, targets, periods)


@pytest.mark.parametrize(
    "overrides,message",
    [
        ({"train_start": "2025-01"}, "Train start"),
        ({"validation_start": "2024-12"}, "Validation must start"),
        ({"validation_end": "2024-12"}, "Validation start"),
        ({"test_start": "2025-12"}, "Test must start"),
        ({"test_end": "2025-12"}, "Test start"),
        ({"partial_start": "2026-09"}, "Partial period"),
    ],
)
def test_split_rejects_reversed_or_overlapping_partition_definitions(overrides, message):
    with pytest.raises(ValueError, match=message):
        SplitBoundaries(**overrides)


def test_preparation_excludes_income_price_derivatives_and_unexpected_source_columns():
    data = sample_data()
    baseline = prepare_features(data)
    data["income"] = 1_000_000
    data["price_per_sqm"] = data["resale_price"] / data["floor_area_sqm"]
    data["target_log"] = 123
    prepared = prepare_features(data)
    pd.testing.assert_frame_equal(prepared.features, baseline.features)
    assert not {"income", "price_per_sqm", "target_log", "resale_price"}.intersection(prepared.features)


@pytest.mark.parametrize("field", ["floor_area_sqm", "storey_mid", "remaining_lease_months"])
def test_comparables_include_exact_physical_tolerance_and_exclude_just_outside(field):
    history = frame([row("2025-02", 100), row("2025-02", 900)], indices=[11, 22])
    history[field] = history[field].astype(float)
    tolerances = {"floor_area_sqm": 10, "storey_mid": 6, "remaining_lease_months": 60}
    base = {"floor_area_sqm": 70, "storey_mid": 5, "remaining_lease_months": 600}[field]
    history.loc[11, field] = base + tolerances[field]
    history.loc[22, field] = base + tolerances[field] + 0.1
    prediction = predict_comparable_sales(history, target(), ComparableConfig(minimum_comparables=1))
    assert prediction.loc[900, "candidate_count"] == 1
    assert prediction.loc[900, "selected_comparable_indices"] == (11,)
    assert prediction.loc[900, "prediction"] == 100


def test_comparable_lookback_lower_month_is_included_but_month_before_is_excluded():
    history = frame([row("2024-03", 100), row("2024-02", 900)], indices=[11, 22])
    result = predict_comparable_sales(history, target(), ComparableConfig(minimum_comparables=1))
    assert result.loc[900, "selected_comparable_indices"] == (11,)
    assert result.loc[900, "prediction"] == 100


def test_comparable_index_cannot_be_reused_for_a_later_prediction_month():
    history = frame([row("2025-01", 100)])
    index = ComparableHistoryIndex(history, pd.Period("2025-03", freq="M"))
    with pytest.raises(ValueError, match="indexed target month"):
        index.predict(target("2025-04"))


def test_comparables_can_hide_source_ids_without_changing_estimate():
    history = frame([row("2025-02", 100), row("2025-01", 300)], indices=[11, 22])
    config = ComparableConfig(minimum_comparables=1)
    visible = predict_comparable_sales(history, target(), config)
    hidden = predict_comparable_sales(history, target(), config, include_selected_indices=False)
    assert hidden.loc[900, "selected_comparable_indices"] == ()
    assert hidden.loc[900, "prediction"] == visible.loc[900, "prediction"]
    assert hidden.loc[900, "comparable_count"] == visible.loc[900, "comparable_count"]


def calibration_folds():
    folds = [OutOfSamplePredictionFold(year, pd.DataFrame({"town": ["SYNTHETIC TOWN"], "flat_type": ["3 ROOM"]}, index=[year]), pd.Series([100.0], index=[year])) for year in range(2021, 2026)]
    actual = pd.Series({year: 110.0 for year in range(2021, 2026)})
    return folds, actual


def test_calibration_rejects_duplicate_year_folds_instead_of_double_weighting():
    folds, actual = calibration_folds()
    with pytest.raises(ValueError, match="Duplicate calibration"):
        build_calibration_residuals(folds + [folds[0]], actual)


def test_calibration_requires_every_predeclared_year():
    folds, actual = calibration_folds()
    with pytest.raises(ValueError, match="exactly one"):
        build_calibration_residuals(folds[:-1], actual)


def test_calibration_rejects_reordered_prediction_indices():
    folds, actual = calibration_folds()
    folds[0] = replace(folds[0], predictions=pd.Series([100.0], index=[999]))
    with pytest.raises(ValueError, match="identical indices"):
        build_calibration_residuals(folds, actual)


def test_calibration_rejects_missing_actual_targets():
    folds, actual = calibration_folds()
    with pytest.raises(ValueError, match="missing targets or predictions"):
        build_calibration_residuals(folds, actual.drop(2023))


@pytest.mark.parametrize("bad_year", [2021.5, 2022.25])
def test_calibration_rejects_fractional_years_before_integer_conversion(bad_year):
    residuals = residual_history()
    residuals["year"] = residuals["year"].astype(float)
    residuals.loc[residuals["year"] == int(bad_year), "year"] = bad_year
    with pytest.raises(ValueError, match="finite integers"):
        build_uncertainty_state(residuals)


@pytest.mark.parametrize("actual,predicted", [([float("nan")], [1]), ([1], [float("inf")]), ([float("-inf")], [1])])
def test_metrics_reject_non_finite_values_instead_of_reporting_misleading_scores(actual, predicted):
    with pytest.raises(ValueError, match="finite"):
        calculate_regression_metrics(actual, predicted)
