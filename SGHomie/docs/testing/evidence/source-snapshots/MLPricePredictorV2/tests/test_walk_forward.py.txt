import pandas as pd
import pytest

from src.baselines.global_median import predict_global_median
from src.baselines.comparable_sales import (
    ComparableConfig,
    predict_comparable_sales,
)
from src.evaluation.walk_forward import (
    evaluate_comparable_configurations_walk_forward,
    evaluate_walk_forward,
)


def transactions(months, prices, indices=None):
    return pd.DataFrame(
        {
            "transaction_period": pd.PeriodIndex(months, freq="M"),
            "town": ["A"] * len(months),
            "flat_type": ["3 ROOM"] * len(months),
            "floor_area_sqm": [70.0] * len(months),
            "storey_mid": [5.0] * len(months),
            "remaining_lease_months": [600] * len(months),
            "resale_price": prices,
        },
        index=indices,
    )


def run_global(history, targets):
    return evaluate_walk_forward(history, targets, predict_global_median)


def test_same_month_targets_cannot_influence_each_others_predictions():
    history = transactions(["2025-01", "2025-02"], [100, 200], [1, 2])
    targets = transactions(["2025-03", "2025-03"], [300, 400], [3, 4])
    changed = targets.copy()
    changed.loc[4, "resale_price"] = 999999

    first = run_global(history, targets)
    second = run_global(history, changed)

    assert first.loc[3, "prediction"] == 150
    assert first.loc[3, "prediction"] == second.loc[3, "prediction"]
    assert first.loc[4, "prediction"] == second.loc[4, "prediction"]


def test_same_month_actual_mutation_does_not_change_comparable_prediction():
    history = transactions(["2025-01", "2025-02"], [100, 200], [1, 2])
    targets = transactions(["2025-03", "2025-03"], [300, 400], [3, 4])
    changed = targets.copy()
    changed.loc[4, "resale_price"] = 999999
    predictor = lambda prior, current: predict_comparable_sales(
        prior, current, ComparableConfig(minimum_comparables=1)
    )

    first = evaluate_walk_forward(history, targets, predictor)
    second = evaluate_walk_forward(history, changed, predictor)

    assert first.loc[3, "prediction"] == second.loc[3, "prediction"]


def test_future_actual_mutation_cannot_change_earlier_predictions():
    history = transactions(["2025-01", "2025-02"], [100, 200], [1, 2])
    targets = transactions(["2025-03", "2025-04"], [300, 400], [3, 4])
    changed = targets.copy()
    changed.loc[4, "resale_price"] = 999999

    first = run_global(history, targets)
    second = run_global(history, changed)

    assert first.loc[3, "prediction"] == second.loc[3, "prediction"]


def test_future_missing_target_cannot_change_earlier_prediction():
    history = transactions(["2025-01", "2025-02"], [100, 200], [1, 2])
    targets = transactions(["2025-03", "2025-04"], [300, 400], [3, 4])
    changed = targets.copy()
    changed.loc[4, "resale_price"] = float("nan")

    first = run_global(history, targets)
    second = run_global(history, changed)

    assert first.loc[3, "prediction"] == second.loc[3, "prediction"]


def test_prior_completed_month_updates_history_for_later_month():
    history = transactions(["2025-01"], [100], [1])
    targets = transactions(["2025-03", "2025-04"], [1000, 400], [3, 4])
    changed = targets.copy()
    changed.loc[3, "resale_price"] = 2000

    first = run_global(history, targets)
    second = run_global(history, changed)

    assert first.loc[4, "prediction"] == 550
    assert second.loc[4, "prediction"] == 1050


def test_prior_completed_month_can_change_later_comparable_prediction():
    history = transactions(["2025-01"], [100], [1])
    targets = transactions(["2025-02", "2025-03"], [1000, 500], [2, 3])
    changed = targets.copy()
    changed.loc[2, "resale_price"] = 2000
    predictor = lambda prior, current: predict_comparable_sales(
        prior, current, ComparableConfig(minimum_comparables=1)
    )

    first = evaluate_walk_forward(history, targets, predictor)
    second = evaluate_walk_forward(history, changed, predictor)

    assert first.loc[3, "prediction"] == 550
    assert second.loc[3, "prediction"] == 1050


def test_partial_period_rows_are_rejected_from_evaluation():
    history = transactions(["2025-09"], [100], [1])
    targets = transactions(["2026-10"], [200], [2])

    with pytest.raises(ValueError, match="partial period"):
        run_global(history, targets)


def test_months_are_evaluated_in_chronological_order():
    history = transactions(["2025-01"], [100], [1])
    targets = transactions(["2025-03", "2025-02"], [300, 200], [3, 2])

    result = run_global(history, targets)

    assert result["target_month"].tolist() == [
        pd.Period("2025-02", freq="M"),
        pd.Period("2025-03", freq="M"),
    ]
    assert result.loc[3, "prediction"] == 150


def test_comparable_grid_reuses_walk_forward_history_without_changing_predictions():
    history = transactions(["2025-01", "2025-02"], [100, 200], [1, 2])
    targets = transactions(["2025-03", "2025-04"], [300, 400], [3, 4])
    configs = [
        ComparableConfig(lookback_months=2, minimum_comparables=1),
        ComparableConfig(lookback_months=2, minimum_comparables=2),
    ]
    grid = evaluate_comparable_configurations_walk_forward(history, targets, configs)

    for config in configs:
        single = evaluate_walk_forward(
            history,
            targets,
            lambda prior, current, config=config: predict_comparable_sales(
                prior, current, config
            ),
        )
        pd.testing.assert_series_equal(grid[config]["prediction"], single["prediction"])
