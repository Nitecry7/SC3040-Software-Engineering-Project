import math

import numpy as np
import pandas as pd
import pytest

from src.evaluation.uncertainty import (
    CALIBRATION_METHODS,
    COVERAGE_LEVELS,
    HISTORICAL_EVALUATION_YEARS,
    CalibrationMethod,
    calibrate_prediction_intervals,
    calculate_interval_metrics,
    classify_asking_price,
    finite_sample_conformal_quantile,
    passes_ninety_percent_historical_gate,
    select_calibration_method,
    select_prior_residuals,
    summarize_interval_groups,
    symmetric_prediction_intervals,
)


def residual_rows(years, residuals, towns=None, flat_types=None):
    size = len(years)
    return pd.DataFrame(
        {
            "year": years,
            "residual_sgd": residuals,
            "town": towns if towns is not None else ["TOWN"] * size,
            "flat_type": flat_types if flat_types is not None else ["3 ROOM"] * size,
        }
    )


def method(name="global_all_years"):
    return next(item for item in CALIBRATION_METHODS if item.name == name)


def test_finite_sample_quantile_uses_ceiling_order_statistic_without_interpolation():
    assert finite_sample_conformal_quantile(np.arange(1, 10), 0.80) == 8.0
    assert finite_sample_conformal_quantile([1, 2, 3, 4], 0.50) == 3.0


def test_finite_sample_quantile_returns_infinity_if_rank_exceeds_sample():
    assert math.isinf(finite_sample_conformal_quantile([1.0, 2.0], 0.95))


@pytest.mark.parametrize("coverage", [0.0, 1.0, -0.1, 1.1, float("nan"), float("inf")])
def test_conformal_quantile_rejects_invalid_coverage(coverage):
    with pytest.raises(ValueError, match="nominal_coverage"):
        finite_sample_conformal_quantile([1.0], coverage)


@pytest.mark.parametrize("residuals", [[], [1.0, float("nan")], [1.0, float("inf")], [-1.0]])
def test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals(residuals):
    with pytest.raises(ValueError):
        finite_sample_conformal_quantile(residuals, 0.90)


def test_symmetric_intervals_preserve_index_and_compute_bounds_and_width():
    predictions = pd.Series([100.0, 200.0], index=[8, 12], name="prediction")
    intervals = symmetric_prediction_intervals(predictions, 25.0)
    assert intervals.index.tolist() == [8, 12]
    assert intervals["lower_bound"].tolist() == [75.0, 175.0]
    assert intervals["upper_bound"].tolist() == [125.0, 225.0]
    assert (intervals["upper_bound"] - intervals["lower_bound"]).tolist() == [50.0, 50.0]


def test_interval_metrics_match_hand_calculated_coverage_and_width():
    actual = pd.Series([90.0, 120.0, 220.0], index=[1, 2, 3])
    intervals = pd.DataFrame(
        {
            "lower_bound": [80.0, 100.0, 200.0],
            "upper_bound": [100.0, 110.0, 240.0],
        },
        index=actual.index,
    )
    metrics = calculate_interval_metrics(actual, intervals, 0.80)
    assert metrics.prediction_count == 3
    assert metrics.covered_count == 2
    assert metrics.empirical_coverage == pytest.approx(2 / 3)
    assert metrics.coverage_error_percentage_points == pytest.approx((2 / 3 - 0.8) * 100)
    assert metrics.mean_width_sgd == pytest.approx(70 / 3)
    assert metrics.median_width_sgd == 20.0


def test_prior_residual_selection_excludes_evaluation_and_future_years():
    history = residual_rows([2021] * 3 + [2022, 2025], [2, 4, 6, 900, 1000])
    selected = select_prior_residuals(history, 2022, method())
    assert selected["year"].tolist() == [2021, 2021, 2021]
    assert selected["residual_sgd"].tolist() == [2, 4, 6]


def test_recent_window_uses_only_previous_calendar_years():
    history = residual_rows([2021, 2022, 2023, 2024, 2025], [1, 2, 3, 4, 999])
    selected = select_prior_residuals(history, 2026, method("global_recent_1_year"))
    assert selected["year"].tolist() == [2025]
    assert selected["residual_sgd"].tolist() == [999]


def test_evaluation_target_mutation_cannot_change_frozen_intervals():
    history = residual_rows([2021] * 4 + [2022], [10, 20, 30, 40, 1_000_000])
    points = pd.DataFrame(
        {"prediction": [500.0, 600.0], "town": ["TOWN", "TOWN"], "flat_type": ["3 ROOM"] * 2},
        index=[10, 11],
    )
    first = calibrate_prediction_intervals(history, points, 2022, method(), 0.50)
    changed_history = history.copy()
    changed_history.loc[changed_history["year"] == 2022, "residual_sgd"] = -999999
    second = calibrate_prediction_intervals(changed_history, points, 2022, method(), 0.50)
    pd.testing.assert_frame_equal(first, second)
    with pytest.raises(ValueError, match="must not contain evaluation targets"):
        calibrate_prediction_intervals(
            history, points.assign(actual=[100.0, 200.0]), 2022, method(), 0.50
        )


def test_group_quantiles_use_minimum_support_and_global_fallback():
    history = residual_rows(
        [2021] * 35,
        [10.0] * 30 + [20.0] * 5,
        ["A"] * 30 + ["B"] * 5,
    )
    points = pd.DataFrame(
        {
            "prediction": [100.0, 100.0, 100.0],
            "town": ["A", "B", "UNSEEN"],
            "flat_type": ["3 ROOM"] * 3,
        },
        index=[1, 2, 3],
    )
    intervals = calibrate_prediction_intervals(
        history, points, 2022, method("town_all_years"), 0.90
    )
    assert intervals["calibration_rows"].tolist() == [35, 35, 35]
    assert intervals["calibration_group_rows"].tolist() == [30, 35, 35]
    assert intervals["used_global_fallback"].tolist() == [False, True, True]
    assert intervals["quantile_sgd"].tolist() == [10.0, 20.0, 20.0]


def test_group_coverage_summary_flags_evaluation_groups_below_support_threshold():
    actual = pd.Series([10.0, 20.0, 30.0], index=[2, 4, 6])
    intervals = pd.DataFrame(
        {
            "lower_bound": [5.0, 15.0, 25.0],
            "upper_bound": [15.0, 25.0, 35.0],
            "town": ["A", "A", "B"],
        },
        index=actual.index,
    )
    summary = summarize_interval_groups(actual, intervals, "town", 0.90, minimum_support=2)
    assert summary["town"].tolist() == ["A", "B"]
    assert summary["support"].tolist() == [2, 1]
    assert summary["low_support"].tolist() == [False, True]
    assert summary["empirical_coverage"].tolist() == [1.0, 1.0]


def _selection_fixture():
    rows = []
    for item in CALIBRATION_METHODS:
        for year in HISTORICAL_EVALUATION_YEARS:
            for level in COVERAGE_LEVELS:
                rows.append(
                    {
                        "method": item.name,
                        "year": year,
                        "nominal_coverage": level,
                        "empirical_coverage": level,
                        "mean_width_sgd": 100.0,
                        "prediction_count": 100,
                    }
                )
    return pd.DataFrame(rows)


def test_method_selector_is_deterministic_and_uses_simplicity_for_exact_ties():
    assert select_calibration_method(_selection_fixture()).name == "global_all_years"


def test_method_selector_rejects_final_test_results():
    results = _selection_fixture()
    results.loc[len(results)] = [
        "global_all_years", 2026, 0.90, 0.90, 100.0, 10
    ]
    with pytest.raises(ValueError, match="must not contain 2026"):
        select_calibration_method(results)


def test_ninety_percent_gate_uses_pooled_ninety_and_each_year_eighty_five():
    rows = []
    for year, coverage in zip(HISTORICAL_EVALUATION_YEARS, [0.85, 0.90, 0.92, 0.93]):
        rows.append(
            {
                "year": year,
                "nominal_coverage": 0.90,
                "empirical_coverage": coverage,
                "prediction_count": 100,
            }
        )
    assert passes_ninety_percent_historical_gate(pd.DataFrame(rows))
    rows[0]["empirical_coverage"] = 0.84
    assert not passes_ninety_percent_historical_gate(pd.DataFrame(rows))


@pytest.mark.parametrize(
    ("price", "expected"),
    [
        (99.99, "below_estimated_market_range"),
        (100.0, "within_estimated_market_range"),
        (150.0, "within_estimated_market_range"),
        (200.0, "within_estimated_market_range"),
        (200.01, "above_estimated_market_range"),
    ],
)
def test_asking_price_interval_classification_boundaries(price, expected):
    assert classify_asking_price(price, 100.0, 200.0) == expected


def test_asking_price_classification_rejects_invalid_inputs():
    with pytest.raises(ValueError):
        classify_asking_price(float("nan"), 100.0, 200.0)
    with pytest.raises(ValueError):
        classify_asking_price(150.0, 200.0, 100.0)

