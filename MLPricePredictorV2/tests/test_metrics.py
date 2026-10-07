import pytest

from src.evaluation.metrics import calculate_regression_metrics


def test_regression_metrics_match_hand_calculated_values():
    metrics = calculate_regression_metrics([100, 200, 300], [110, 180, 330])

    assert metrics.mae_sgd == pytest.approx(20)
    assert metrics.rmse_sgd == pytest.approx((1400 / 3) ** 0.5)
    assert metrics.mape_percent == pytest.approx(10)
    assert metrics.r_squared == pytest.approx(0.93)
    assert metrics.median_absolute_error_sgd == pytest.approx(20)
    assert metrics.prediction_count == 3
    assert metrics.mean_actual_sgd == pytest.approx(200)
    assert metrics.mean_predicted_sgd == pytest.approx(620 / 3)


def test_r_squared_is_undefined_for_insufficient_or_constant_actuals():
    assert calculate_regression_metrics([100], [90]).r_squared is None
    assert calculate_regression_metrics([100, 100], [90, 110]).r_squared is None


def test_mape_is_undefined_when_actual_contains_zero():
    assert calculate_regression_metrics([0, 100], [10, 90]).mape_percent is None


def test_metrics_reject_empty_or_misaligned_inputs():
    with pytest.raises(ValueError, match="at least one"):
        calculate_regression_metrics([], [])
    with pytest.raises(ValueError, match="same number"):
        calculate_regression_metrics([1, 2], [1])
