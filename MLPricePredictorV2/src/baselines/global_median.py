"""Historical global median baseline."""

import pandas as pd

from src.baselines.common import eligible_history, result_frame, validate_inputs


def predict_global_median(history: pd.DataFrame, target_rows: pd.DataFrame) -> pd.DataFrame:
    """Predict each target row with the global median strictly before its month."""
    target_month = validate_inputs(history, target_rows)
    prior = eligible_history(history, target_month)
    value = float(prior["resale_price"].median())
    return result_frame(
        target_rows,
        [value] * len(target_rows),
        ["global"] * len(target_rows),
    )
