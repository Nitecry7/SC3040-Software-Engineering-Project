import pandas as pd
import pytest

from src.baselines.comparable_sales import ComparableConfig, predict_comparable_sales
from src.baselines.global_median import predict_global_median
from src.baselines.grouped_median import predict_town_flat_type_median


def row(month, price, *, town="A", flat_type="3 ROOM", area=70, storey=5, lease=600):
    return {
        "transaction_period": pd.Period(month, freq="M"),
        "town": town,
        "flat_type": flat_type,
        "floor_area_sqm": area,
        "storey_mid": storey,
        "remaining_lease_months": lease,
        "resale_price": price,
    }


def target(month="2025-03", *, town="A", flat_type="3 ROOM", area=70, storey=5, lease=600):
    return pd.DataFrame(
        [{
            "transaction_period": pd.Period(month, freq="M"),
            "town": town,
            "flat_type": flat_type,
            "floor_area_sqm": area,
            "storey_mid": storey,
            "remaining_lease_months": lease,
        }],
        index=[900],
    )


def frame(rows, indices=None):
    return pd.DataFrame(rows, index=indices)


def test_global_median_uses_only_strictly_earlier_history():
    history = frame([row("2025-01", 100), row("2025-03", 999999), row("2025-04", 1)])
    predicted = predict_global_median(history, target())

    assert predicted.loc[900, "prediction"] == 100
    assert predicted.loc[900, "fallback_level"] == "global"
    assert predicted.loc[900, "historical_cutoff_month"] == pd.Period("2025-02", freq="M")


def test_town_flat_type_median_falls_back_to_global_deterministically():
    history = frame([row("2025-01", 100), row("2025-02", 300, town="B")])
    target_rows = target(town="Z")
    first = predict_town_flat_type_median(history, target_rows)
    second = predict_town_flat_type_median(history, target_rows)

    assert first.loc[900, "prediction"] == 200
    assert first.loc[900, "fallback_level"] == "global"
    pd.testing.assert_frame_equal(first, second)


def test_town_flat_type_median_uses_only_matching_prior_rows():
    history = frame(
        [row("2025-01", 100), row("2025-02", 300, flat_type="4 ROOM"), row("2025-03", 900)]
    )
    predicted = predict_town_flat_type_median(history, target())

    assert predicted.loc[900, "prediction"] == 100
    assert predicted.loc[900, "fallback_level"] == "town_flat_type"


def test_comparable_selector_uses_physical_distance_not_target_price():
    similar = row("2025-02", 100000, area=70, storey=5, lease=600)
    less_similar_but_price_close = row("2025-02", 500000, area=79, storey=10, lease=550)
    target_actual_price = 490000
    history = frame([similar, less_similar_but_price_close], indices=[11, 22])
    config = ComparableConfig(
        lookback_months=12,
        minimum_comparables=1,
        maximum_comparables=1,
        floor_area_tolerance_sqm=10,
        storey_mid_tolerance=6,
        remaining_lease_tolerance_months=60,
    )

    predicted = predict_comparable_sales(history, target(), config)

    assert abs(less_similar_but_price_close["resale_price"] - target_actual_price) < abs(
        similar["resale_price"] - target_actual_price
    )
    assert predicted.loc[900, "prediction"] == 100000
    assert predicted.loc[900, "selected_comparable_indices"] == (11,)


def test_candidate_prices_do_not_change_selected_comparable_indices():
    history = frame(
        [row("2025-01", 100000, area=68), row("2025-02", 200000, area=72)],
        indices=[2, 1],
    )
    history["price_per_sqm"] = [1, 2]
    changed_prices = history.copy()
    changed_prices["resale_price"] = [999999, 1]
    changed_prices["price_per_sqm"] = [999999, 1]
    target_rows = target()
    target_rows["price_per_sqm"] = 400000
    changed_target_rows = target_rows.copy()
    changed_target_rows["price_per_sqm"] = 1
    config = ComparableConfig(minimum_comparables=1, maximum_comparables=1)

    first = predict_comparable_sales(history, target_rows, config)
    second = predict_comparable_sales(changed_prices, changed_target_rows, config)

    assert first.loc[900, "selected_comparable_indices"] == second.loc[900, "selected_comparable_indices"]


def test_same_month_and_future_candidates_are_excluded():
    history = frame(
        [row("2025-02", 100), row("2025-03", 999), row("2025-04", 1)],
        indices=[1, 2, 3],
    )
    config = ComparableConfig(minimum_comparables=1)

    predicted = predict_comparable_sales(history, target(), config)

    assert predicted.loc[900, "selected_comparable_indices"] == (1,)
    assert predicted.loc[900, "prediction"] == 100


def test_comparable_minimum_triggers_town_then_global_fallback():
    history = frame([row("2025-02", 100), row("2025-01", 300, town="B")])
    config = ComparableConfig(
        lookback_months=1,
        minimum_comparables=2,
        maximum_comparables=3,
    )

    predicted = predict_comparable_sales(history, target(), config)

    assert predicted.loc[900, "prediction"] == 100
    assert predicted.loc[900, "fallback_level"] == "town_flat_type"


def test_comparable_falls_back_to_global_when_town_flat_type_history_is_absent():
    history = frame([row("2025-02", 100, town="B"), row("2025-01", 300, town="C")])
    config = ComparableConfig(minimum_comparables=1)

    predicted = predict_comparable_sales(history, target(), config)

    assert predicted.loc[900, "prediction"] == 200
    assert predicted.loc[900, "fallback_level"] == "global"


def test_comparable_lookback_and_maximum_count_are_respected_deterministically():
    history = frame(
        [row("2024-02", 900), row("2025-01", 200), row("2025-02", 100)],
        indices=[3, 2, 1],
    )
    config = ComparableConfig(
        lookback_months=2,
        minimum_comparables=1,
        maximum_comparables=1,
    )

    first = predict_comparable_sales(history, target(), config)
    second = predict_comparable_sales(history, target(), config)

    assert first.loc[900, "selected_comparable_indices"] == (1,)
    assert first.loc[900, "candidate_count"] == 2
    assert first.loc[900, "comparable_count"] == 1
    pd.testing.assert_frame_equal(first, second)


def test_equal_score_comparables_use_source_index_as_final_tie_breaker():
    history = frame(
        [row("2025-02", 100), row("2025-02", 300)],
        indices=[22, 11],
    )
    config = ComparableConfig(minimum_comparables=1, maximum_comparables=1)

    predicted = predict_comparable_sales(history, target(), config)

    assert predicted.loc[900, "selected_comparable_indices"] == (11,)


def test_predictors_require_target_rows_without_resale_price():
    history = frame([row("2025-01", 100)])
    target_with_price = target()
    target_with_price["resale_price"] = 123

    with pytest.raises(ValueError, match="must not contain resale_price"):
        predict_global_median(history, target_with_price)
