"""Group, monthly-drift, and repeatability summaries for robustness runs."""

from dataclasses import dataclass
from itertools import combinations
from time import perf_counter

import numpy as np
import pandas as pd

from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics
from src.models.boosted import ComputeDevice, fit_frozen_catboost, predict_boosted_model
from src.splitting.chronological import DataPartition


@dataclass(frozen=True)
class RepeatabilityRun:
    metrics: RegressionMetrics
    fit_seconds: float
    prediction_seconds: float
    predictions: pd.Series


@dataclass(frozen=True)
class RepeatabilitySummary:
    repeat_count: int
    mean_mae_sgd: float
    minimum_mae_sgd: float
    maximum_mae_sgd: float
    mae_std_sgd: float
    mae_range_sgd: float
    mean_rmse_sgd: float
    rmse_std_sgd: float
    mean_mape_percent: float | None
    mape_std_percent: float | None
    mean_pairwise_prediction_difference_sgd: float
    maximum_pairwise_prediction_difference_sgd: float


@dataclass(frozen=True)
class FrozenCatBoostYearResult:
    year: int
    training: DataPartition
    evaluation: DataPartition
    predictions: pd.Series
    metrics: RegressionMetrics | None
    fit_seconds: float
    prediction_seconds: float


def expanding_year_partitions(
    features: pd.DataFrame,
    target: pd.Series,
    transaction_period: pd.Series,
    year: int,
    evaluation_end_month: int = 12,
    include_evaluation_target: bool = True,
) -> tuple[DataPartition, DataPartition]:
    """Split an expanding history and one calendar-year evaluation window."""
    if not features.index.equals(target.index) or not features.index.equals(transaction_period.index):
        raise ValueError("Features, target, and transaction periods must have identical indices")
    if features.empty:
        raise ValueError("Chronological backtest data must contain rows")
    if not 1 <= evaluation_end_month <= 12:
        raise ValueError("evaluation_end_month must be between 1 and 12")
    periods = pd.PeriodIndex(transaction_period, freq="M")
    if periods.isna().any():
        raise ValueError("Transaction periods cannot be missing")
    evaluation_start = pd.Period(f"{year}-01", freq="M")
    evaluation_end = pd.Period(f"{year}-{evaluation_end_month:02d}", freq="M")
    if evaluation_end >= pd.Period("2026-10", freq="M"):
        raise ValueError("The current partial period must not be included in evaluation")
    train_mask = periods < evaluation_start
    evaluation_mask = (periods >= evaluation_start) & (periods <= evaluation_end)
    if not train_mask.any() or not evaluation_mask.any():
        raise ValueError(f"Year {year} requires non-empty historical and evaluation partitions")

    def partition(mask: np.ndarray, *, include_target: bool = True) -> DataPartition:
        positions = mask.nonzero()[0]
        partition_features = features.iloc[positions].copy()
        partition_target = (
            target.iloc[positions].copy()
            if include_target
            else target.iloc[0:0].copy()
        )
        return DataPartition(
            partition_features,
            partition_target,
            transaction_period.iloc[positions].copy(),
        )

    training = partition(train_mask)
    evaluation = partition(evaluation_mask, include_target=include_evaluation_target)
    if training.transaction_period.max() >= evaluation_start:
        raise AssertionError("Training data must end before the evaluation year")
    if not (pd.PeriodIndex(evaluation.transaction_period, freq="M") <= evaluation_end).all():
        raise AssertionError("Evaluation data extends past its configured year window")
    return training, evaluation


def evaluate_frozen_catboost_year(
    features: pd.DataFrame,
    target: pd.Series,
    transaction_period: pd.Series,
    year: int,
    device: ComputeDevice = "gpu",
    evaluation_end_month: int = 12,
    calculate_metrics: bool = True,
) -> FrozenCatBoostYearResult:
    """Fit the frozen CatBoost design through the prior December and predict one year.

    Set ``calculate_metrics=False`` when the evaluation labels must remain
    untouched until downstream intervals or decisions have been frozen.
    """
    training, evaluation = expanding_year_partitions(
        features,
        target,
        transaction_period,
        year,
        evaluation_end_month=evaluation_end_month,
        include_evaluation_target=calculate_metrics,
    )
    fit_started = perf_counter()
    model = fit_frozen_catboost(training.features, training.target, device=device)
    fit_seconds = perf_counter() - fit_started
    prediction_started = perf_counter()
    predictions = predict_boosted_model(model, evaluation.features).reindex(
        evaluation.features.index
    )
    prediction_seconds = perf_counter() - prediction_started
    metrics = (
        calculate_regression_metrics(evaluation.target, predictions)
        if calculate_metrics
        else None
    )
    return FrozenCatBoostYearResult(
        year=year,
        training=training,
        evaluation=evaluation,
        predictions=predictions,
        metrics=metrics,
        fit_seconds=fit_seconds,
        prediction_seconds=prediction_seconds,
    )


def summarize_repeatability(runs: list[RepeatabilityRun]) -> RepeatabilitySummary:
    """Aggregate repeat diagnostics without selecting or ranking a run."""
    if len(runs) < 2:
        raise ValueError("Repeatability summary requires at least two independent runs")
    reference_index = runs[0].predictions.index
    if len(reference_index) == 0:
        raise ValueError("Repeatability predictions cannot be empty")
    aligned_predictions = []
    for run in runs:
        if not run.predictions.index.equals(reference_index):
            raise ValueError("Repeat predictions must have identical ordered source indices")
        aligned_predictions.append(run.predictions.to_numpy(dtype=float))

    mae = np.asarray([run.metrics.mae_sgd for run in runs], dtype=float)
    rmse = np.asarray([run.metrics.rmse_sgd for run in runs], dtype=float)
    mape_values = [run.metrics.mape_percent for run in runs]
    if any(value is None for value in mape_values):
        mean_mape = None
        mape_std = None
    else:
        mape = np.asarray(mape_values, dtype=float)
        mean_mape = float(mape.mean())
        mape_std = float(mape.std(ddof=0))

    pairwise = [
        np.abs(left - right)
        for left, right in combinations(aligned_predictions, 2)
    ]
    pairwise_values = np.concatenate(pairwise)
    return RepeatabilitySummary(
        repeat_count=len(runs),
        mean_mae_sgd=float(mae.mean()),
        minimum_mae_sgd=float(mae.min()),
        maximum_mae_sgd=float(mae.max()),
        mae_std_sgd=float(mae.std(ddof=0)),
        mae_range_sgd=float(mae.max() - mae.min()),
        mean_rmse_sgd=float(rmse.mean()),
        rmse_std_sgd=float(rmse.std(ddof=0)),
        mean_mape_percent=mean_mape,
        mape_std_percent=mape_std,
        mean_pairwise_prediction_difference_sgd=float(pairwise_values.mean()),
        maximum_pairwise_prediction_difference_sgd=float(pairwise_values.max()),
    )


def summarize_group_mae(predictions: pd.DataFrame, group_column: str) -> pd.DataFrame:
    """Return deterministic group MAE and support counts."""
    required = {group_column, "actual", "prediction"}
    missing = sorted(required.difference(predictions.columns))
    if missing:
        raise ValueError(f"Group predictions are missing columns: {', '.join(missing)}")
    rows = []
    for label, group in predictions.groupby(group_column, sort=True, dropna=False):
        rows.append(
            {
                group_column: label,
                "support": len(group),
                "mae_sgd": float(np.abs(group["actual"] - group["prediction"]).mean()),
            }
        )
    return pd.DataFrame(rows, columns=[group_column, "support", "mae_sgd"])


def summarize_monthly_drift(
    predictions: pd.DataFrame,
) -> tuple[pd.DataFrame, float | None]:
    """Summarize monthly errors, means, bias, and descriptive MAE slope."""
    required = {"transaction_period", "actual", "prediction"}
    missing = sorted(required.difference(predictions.columns))
    if missing:
        raise ValueError(f"Monthly predictions are missing columns: {', '.join(missing)}")
    if predictions.empty:
        raise ValueError("Monthly drift requires at least one prediction")
    periods = pd.PeriodIndex(predictions["transaction_period"], freq="M")
    working = predictions.assign(transaction_period=periods)
    rows = []
    for month, group in working.groupby("transaction_period", sort=True):
        mean_actual = float(group["actual"].mean())
        mean_predicted = float(group["prediction"].mean())
        rows.append(
            {
                "transaction_period": month,
                "support": len(group),
                "mae_sgd": float(np.abs(group["actual"] - group["prediction"]).mean()),
                "mean_actual_sgd": mean_actual,
                "mean_predicted_sgd": mean_predicted,
                "prediction_bias_sgd": mean_predicted - mean_actual,
            }
        )
    summary = pd.DataFrame(rows)
    if len(summary) < 2:
        slope = None
    else:
        month_numbers = np.asarray([period.month for period in summary["transaction_period"]])
        slope = float(np.polyfit(month_numbers, summary["mae_sgd"].to_numpy(), 1)[0])
    return summary, slope
