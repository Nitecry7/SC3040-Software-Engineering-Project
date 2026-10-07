"""Regression metrics implemented without a machine-learning dependency."""

from dataclasses import asdict, dataclass
import math
from statistics import median
from typing import Iterable


@dataclass(frozen=True)
class RegressionMetrics:
    mae_sgd: float
    rmse_sgd: float
    mape_percent: float | None
    r_squared: float | None
    median_absolute_error_sgd: float
    prediction_count: int
    mean_actual_sgd: float
    mean_predicted_sgd: float

    def as_dict(self) -> dict[str, float | int | None]:
        return asdict(self)


def calculate_regression_metrics(
    actual: Iterable[float], predicted: Iterable[float]
) -> RegressionMetrics:
    actual_values = [float(value) for value in actual]
    predicted_values = [float(value) for value in predicted]
    if not actual_values or not predicted_values:
        raise ValueError("Metrics require at least one prediction")
    if len(actual_values) != len(predicted_values):
        raise ValueError("Actual and predicted must contain the same number of values")
    if not all(math.isfinite(value) for value in actual_values + predicted_values):
        raise ValueError("Metrics require finite actual and predicted values")

    errors = [pred - truth for truth, pred in zip(actual_values, predicted_values)]
    absolute_errors = [abs(error) for error in errors]
    count = len(actual_values)
    actual_mean = sum(actual_values) / count
    predicted_mean = sum(predicted_values) / count
    squared_error = sum(error * error for error in errors)
    total_variance = sum((value - actual_mean) ** 2 for value in actual_values)
    r_squared = (
        1 - squared_error / total_variance
        if count >= 2 and total_variance > 0
        else None
    )
    mape = (
        sum(error / abs(truth) for error, truth in zip(absolute_errors, actual_values))
        * 100
        / count
        if all(truth != 0 for truth in actual_values)
        else None
    )
    return RegressionMetrics(
        mae_sgd=sum(absolute_errors) / count,
        rmse_sgd=math.sqrt(squared_error / count),
        mape_percent=mape,
        r_squared=r_squared,
        median_absolute_error_sgd=median(absolute_errors),
        prediction_count=count,
        mean_actual_sgd=actual_mean,
        mean_predicted_sgd=predicted_mean,
    )
