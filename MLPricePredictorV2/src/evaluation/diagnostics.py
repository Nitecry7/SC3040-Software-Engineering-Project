"""Evaluation metrics and transparent baseline-specific diagnostics."""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from src.evaluation.metrics import RegressionMetrics, calculate_regression_metrics

FALLBACK_LEVELS = ("comparable", "town_flat_type", "global")


@dataclass(frozen=True)
class PredictionDiagnostics:
    metrics: RegressionMetrics
    mae_by_town: pd.DataFrame
    mae_by_flat_type: pd.DataFrame
    fallback_usage: pd.DataFrame
    comparable_count_stats: dict[str, float | int | None]
    worst_group_mae_sgd: float


def _group_mae(predictions: pd.DataFrame, group_column: str) -> pd.DataFrame:
    rows = []
    for key, group in predictions.groupby(group_column, sort=True, dropna=False):
        metrics = calculate_regression_metrics(group["actual"], group["prediction"])
        rows.append({group_column: key, "prediction_count": len(group), "mae_sgd": metrics.mae_sgd})
    return pd.DataFrame(rows, columns=[group_column, "prediction_count", "mae_sgd"])


def summarize_predictions(predictions: pd.DataFrame) -> PredictionDiagnostics:
    """Summarize one complete walk-forward result without hiding any group."""
    required = {
        "actual", "prediction", "town", "flat_type", "fallback_level", "comparable_count"
    }
    missing = sorted(required.difference(predictions.columns))
    if missing:
        raise ValueError(f"Predictions are missing diagnostic columns: {', '.join(missing)}")
    if predictions.empty:
        raise ValueError("Cannot summarize an empty prediction frame")

    metrics = calculate_regression_metrics(predictions["actual"], predictions["prediction"])
    town_mae = _group_mae(predictions, "town")
    flat_type_mae = _group_mae(predictions, "flat_type")
    worst_group_mae = max(town_mae["mae_sgd"].max(), flat_type_mae["mae_sgd"].max())

    fallback_counts = predictions["fallback_level"].value_counts().reindex(FALLBACK_LEVELS, fill_value=0)
    fallback_usage = pd.DataFrame(
        {
            "count": fallback_counts.astype(int),
            "percentage": fallback_counts.astype(float) * 100 / len(predictions),
        }
    )
    comparable_counts = predictions.loc[
        predictions["fallback_level"] == "comparable", "comparable_count"
    ].astype(int)
    if comparable_counts.empty:
        comparable_stats = {"mean": None, "median": None, "minimum": None, "maximum": None}
    else:
        comparable_stats = {
            "mean": float(comparable_counts.mean()),
            "median": float(np.median(comparable_counts.to_numpy())),
            "minimum": int(comparable_counts.min()),
            "maximum": int(comparable_counts.max()),
        }
    return PredictionDiagnostics(
        metrics=metrics,
        mae_by_town=town_mae,
        mae_by_flat_type=flat_type_mae,
        fallback_usage=fallback_usage,
        comparable_count_stats=comparable_stats,
        worst_group_mae_sgd=float(worst_group_mae),
    )
