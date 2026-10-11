"""Typed request and response models for local valuation inference."""

from __future__ import annotations

import math
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, StrictInt, StrictStr, field_validator

from src.inference.bundle import DEFAULT_COVERAGE_LEVEL, SUPPORTED_COVERAGE_LEVELS

PricePosition = Literal[
    "below_estimated_market_range",
    "within_estimated_market_range",
    "above_estimated_market_range",
]


class PredictionRequest(BaseModel):
    """Property inputs required by the frozen CatBoost feature contract."""

    model_config = ConfigDict(extra="forbid")

    transaction_year: Annotated[StrictInt, Field(ge=2017)]
    transaction_month: Annotated[StrictInt, Field(ge=1, le=12)]
    floor_area_sqm: Annotated[FiniteFloat, Field(gt=0)]
    storey_mid: Annotated[FiniteFloat, Field(gt=0)]
    remaining_lease_months: Annotated[FiniteFloat, Field(ge=0)]
    town: StrictStr
    flat_type: StrictStr
    block: StrictStr
    street_name: StrictStr
    flat_model: StrictStr
    coverage: float = DEFAULT_COVERAGE_LEVEL
    asking_price: Annotated[FiniteFloat, Field(gt=0)] | None = None

    @field_validator(
        "floor_area_sqm",
        "storey_mid",
        "remaining_lease_months",
        "asking_price",
        mode="before",
    )
    @classmethod
    def require_json_number(cls, value: object) -> object:
        if value is None:
            return value
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("numeric values must be JSON numbers")
        return value

    @field_validator("town", "flat_type", "block", "street_name", "flat_model")
    @classmethod
    def reject_blank_categories(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("categorical values must not be blank")
        return value

    @field_validator("coverage", mode="before")
    @classmethod
    def validate_coverage(cls, value: object) -> float:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(
                "coverage must be one of 0.8, 0.9, or 0.95"
            )
        numeric = float(value)
        if not math.isfinite(numeric) or numeric not in SUPPORTED_COVERAGE_LEVELS:
            raise ValueError("coverage must be one of 0.8, 0.9, or 0.95")
        return numeric


class PredictionResponse(BaseModel):
    """Estimated value and persisted conformal interval for one property."""

    estimated_value: float
    lower_bound: float
    upper_bound: float
    interval_half_width: float
    interval_full_width: float
    coverage_target: float
    model_version: str
    uncertainty_method: str
    uncertainty_group: str
    uncertainty_support: int
    used_global_fallback: bool
    price_position: PricePosition | None = None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_loaded: Literal[True]
    model_version: str
    bundle_format_version: int


class ModelInfoResponse(BaseModel):
    model_version: str
    model_family: str
    training_cutoff: str
    default_coverage_level: float
    supported_coverage_levels: list[float]
    uncertainty_method: str
