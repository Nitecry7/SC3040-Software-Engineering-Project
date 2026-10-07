"""Historical town and flat-type median baseline."""

import pandas as pd

from src.baselines.common import eligible_history, result_frame, validate_inputs


def predict_town_flat_type_median(
    history: pd.DataFrame, target_rows: pd.DataFrame
) -> pd.DataFrame:
    """Use matching historical group median, falling back to the global median."""
    target_month = validate_inputs(history, target_rows)
    prior = eligible_history(history, target_month)
    global_median = float(prior["resale_price"].median())
    group_medians = prior.groupby(["town", "flat_type"], dropna=False)["resale_price"].median()

    predictions = []
    levels = []
    for row in target_rows.itertuples(index=False):
        key = (row.town, row.flat_type)
        if key in group_medians.index:
            predictions.append(float(group_medians.loc[key]))
            levels.append("town_flat_type")
        else:
            predictions.append(global_median)
            levels.append("global")
    return result_frame(target_rows, predictions, levels)
