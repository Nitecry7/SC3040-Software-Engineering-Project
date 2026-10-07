import inspect

from src.baselines.comparable_sales import ComparableConfig
from src.evaluation.configuration_selection import (
    ValidationConfigResult,
    comparable_configuration_grid,
    select_comparable_configuration,
)


def result(config, mae, fallback, worst_group):
    return ValidationConfigResult(config, mae, fallback, worst_group)


def test_validation_grid_contains_expected_twelve_configs_and_default():
    configs = comparable_configuration_grid()

    assert len(configs) == 12
    assert ComparableConfig() in configs
    assert {config.lookback_months for config in configs} == {6, 12, 24}
    assert {config.floor_area_tolerance_sqm for config in configs} == {10.0, 15.0}
    assert {config.minimum_comparables for config in configs} == {5, 10}


def test_near_tie_prefers_lower_fallback_then_default_near_then_group_stability():
    default = ComparableConfig()
    longer = ComparableConfig(lookback_months=24)
    tight_area = ComparableConfig(floor_area_tolerance_sqm=15)
    results = [
        result(longer, 1000, 0.2, 5000),
        result(tight_area, 1005, 0.05, 7000),
        result(default, 1008, 0.05, 4000),
    ]

    assert select_comparable_configuration(results) == default


def test_configuration_outside_one_percent_is_not_preferred_for_fallback():
    default = ComparableConfig()
    low_fallback = ComparableConfig(lookback_months=24)
    results = [
        result(default, 1000, 0.4, 5000),
        result(low_fallback, 1011, 0.0, 1000),
    ]

    assert select_comparable_configuration(results) == default


def test_selector_accepts_validation_summaries_only():
    parameters = inspect.signature(select_comparable_configuration).parameters

    assert list(parameters) == ["validation_results"]
