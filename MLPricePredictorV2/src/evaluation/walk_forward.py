"""Month-by-month historical evaluation with a strict prior-month cutoff."""

from collections.abc import Callable
from collections.abc import Sequence

import pandas as pd

from src.baselines.common import RESULT_COLUMNS
from src.baselines.comparable_sales import (
    ComparableConfig,
    ComparableHistoryIndex,
)

BaselinePredictor = Callable[[pd.DataFrame, pd.DataFrame], pd.DataFrame]
PARTIAL_PERIOD_START = pd.Period("2026-10", freq="M")


def evaluate_walk_forward(
    initial_history: pd.DataFrame,
    evaluation_rows: pd.DataFrame,
    predictor: BaselinePredictor,
) -> pd.DataFrame:
    """Predict a whole month before adding its actuals to later-month history.

    ``initial_history`` and ``evaluation_rows`` contain feature fields,
    ``transaction_period``, and ``resale_price``. The target price column is
    stripped before the predictor receives each month's rows.
    """
    required = {"transaction_period", "resale_price", "town", "flat_type"}
    if missing := sorted(required.difference(initial_history.columns)):
        raise ValueError(f"Initial history is missing columns: {', '.join(missing)}")
    if missing := sorted(required.difference(evaluation_rows.columns)):
        raise ValueError(f"Evaluation rows are missing columns: {', '.join(missing)}")
    if evaluation_rows.empty:
        raise ValueError("Evaluation rows must contain at least one row")

    evaluation_periods = pd.PeriodIndex(evaluation_rows["transaction_period"], freq="M")
    if (evaluation_periods >= PARTIAL_PERIOD_START).any():
        raise ValueError("The current partial period must not be included in evaluation")
    ordered_months = sorted(evaluation_periods.unique())
    first_month = ordered_months[0]
    history_periods = pd.PeriodIndex(initial_history["transaction_period"], freq="M")
    if (history_periods >= first_month).any():
        raise ValueError("Initial history must contain only months before evaluation begins")

    history = initial_history.copy()
    month_results = []
    for month in ordered_months:
        positions = (evaluation_periods == month).nonzero()[0]
        month_rows = evaluation_rows.iloc[positions].copy()
        target_rows = month_rows.drop(columns="resale_price")
        predictions = predictor(history, target_rows)
        if not predictions.index.equals(target_rows.index):
            raise ValueError("Predictor results must preserve target source indices and order")
        if "prediction" not in predictions.columns:
            raise ValueError("Predictor results must contain a prediction column")

        results = predictions.copy()
        results["actual"] = month_rows["resale_price"].to_numpy()
        results["town"] = month_rows["town"].to_numpy()
        results["flat_type"] = month_rows["flat_type"].to_numpy()
        results["source_index"] = month_rows.index.to_list()
        month_results.append(results)

        # The whole month becomes history only after all its predictions exist.
        history = pd.concat([history, month_rows], axis=0)

    combined = pd.concat(month_results, axis=0)
    columns = [
        "prediction",
        "actual",
        "town",
        "flat_type",
        "source_index",
        *[column for column in RESULT_COLUMNS if column in combined.columns],
    ]
    # Keep useful predictor metadata while preventing duplicate column names.
    ordered_columns = list(dict.fromkeys(columns))
    return combined.loc[:, ordered_columns].sort_values(
        ["target_month", "source_index"], kind="stable"
    )


def evaluate_comparable_configurations_walk_forward(
    initial_history: pd.DataFrame,
    evaluation_rows: pd.DataFrame,
    configurations: Sequence[ComparableConfig],
) -> dict[ComparableConfig, pd.DataFrame]:
    """Evaluate a comparable grid while building one history index per month."""
    if not configurations:
        raise ValueError("At least one comparable configuration is required")
    required = {"transaction_period", "resale_price", "town", "flat_type"}
    missing_history = sorted(required.difference(initial_history.columns))
    missing_targets = sorted(required.difference(evaluation_rows.columns))
    if missing_history:
        raise ValueError(f"Initial history is missing columns: {', '.join(missing_history)}")
    if missing_targets:
        raise ValueError(f"Evaluation rows are missing columns: {', '.join(missing_targets)}")
    if evaluation_rows.empty:
        raise ValueError("Evaluation rows must contain at least one row")

    evaluation_periods = pd.PeriodIndex(evaluation_rows["transaction_period"], freq="M")
    if (evaluation_periods >= PARTIAL_PERIOD_START).any():
        raise ValueError("The current partial period must not be included in evaluation")
    ordered_months = sorted(evaluation_periods.unique())
    first_month = ordered_months[0]
    history_periods = pd.PeriodIndex(initial_history["transaction_period"], freq="M")
    if (history_periods >= first_month).any():
        raise ValueError("Initial history must contain only months before evaluation begins")

    history = initial_history.copy()
    results_by_config = {config: [] for config in configurations}
    for month in ordered_months:
        positions = (evaluation_periods == month).nonzero()[0]
        month_rows = evaluation_rows.iloc[positions].copy()
        target_rows = month_rows.drop(columns="resale_price")
        history_index = ComparableHistoryIndex(history, month)
        for config in configurations:
            predictions = history_index.predict(target_rows, config, include_selected_indices=False)
            predictions["actual"] = month_rows["resale_price"].to_numpy()
            predictions["town"] = month_rows["town"].to_numpy()
            predictions["flat_type"] = month_rows["flat_type"].to_numpy()
            predictions["source_index"] = month_rows.index.to_list()
            results_by_config[config].append(predictions)
        history = pd.concat([history, month_rows], axis=0)

    result = {}
    for config, frames in results_by_config.items():
        combined = pd.concat(frames, axis=0)
        columns = [
            "prediction", "actual", "town", "flat_type", "source_index",
            *[column for column in RESULT_COLUMNS if column in combined.columns],
        ]
        combined = combined.loc[:, list(dict.fromkeys(columns))]
        result[config] = combined.sort_values(
            ["target_month", "source_index"], kind="stable"
        )
    return result
