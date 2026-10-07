"""Validation-only comparable configuration search and selection."""

from dataclasses import dataclass
from itertools import product
from typing import Sequence

from src.baselines.comparable_sales import ComparableConfig

INITIAL_SELECTION_DEFAULTS = (12, 10.0, 5)


@dataclass(frozen=True)
class ValidationConfigResult:
    config: ComparableConfig
    mae_sgd: float
    fallback_rate: float
    worst_group_mae_sgd: float


def comparable_configuration_grid() -> tuple[ComparableConfig, ...]:
    """Return the predeclared 12-configuration validation search."""
    return tuple(
        ComparableConfig(
            lookback_months=lookback,
            minimum_comparables=minimum,
            floor_area_tolerance_sqm=area_tolerance,
        )
        for lookback, area_tolerance, minimum in product(
            (6, 12, 24), (10.0, 15.0), (5, 10)
        )
    )


def _default_distance(config: ComparableConfig) -> int:
    current = (
        config.lookback_months,
        config.floor_area_tolerance_sqm,
        config.minimum_comparables,
    )
    return sum(left != right for left, right in zip(current, INITIAL_SELECTION_DEFAULTS))


def select_comparable_configuration(
    validation_results: Sequence[ValidationConfigResult],
) -> ComparableConfig:
    """Select using validation MAE and predeclared deterministic tie breakers."""
    if not validation_results:
        raise ValueError("At least one validation result is required")
    for result in validation_results:
        if result.mae_sgd < 0 or result.fallback_rate < 0 or result.fallback_rate > 1:
            raise ValueError("Validation MAE and fallback rate must be non-negative and valid")

    best_mae = min(result.mae_sgd for result in validation_results)
    threshold = best_mae * 1.01 if best_mae > 0 else best_mae
    near_ties = [result for result in validation_results if result.mae_sgd <= threshold]
    selected = min(
        near_ties,
        key=lambda result: (
            result.fallback_rate,
            _default_distance(result.config),
            result.worst_group_mae_sgd,
            result.config.lookback_months,
            result.config.floor_area_tolerance_sqm,
            result.config.minimum_comparables,
        ),
    )
    return selected.config
