"""Narrow FastAPI service for the persisted valuation bundle."""

from __future__ import annotations

from contextlib import asynccontextmanager
import hmac
import logging
import math
import os
from pathlib import Path
from threading import Lock
from time import perf_counter
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.evaluation.uncertainty import classify_asking_price
from src.inference.bundle import (
    DEFAULT_COVERAGE_LEVEL,
    DEFAULT_MODEL_VERSION,
    LoadedValuationBundle,
    SUPPORTED_COVERAGE_LEVELS,
    load_bundle,
)
from src.models.boosted import BOOSTED_FEATURES
from src.api.schemas import (
    HealthResponse,
    ModelInfoResponse,
    PredictionRequest,
    PredictionResponse,
)

# Uvicorn configures this logger at INFO, so lifespan timing reaches its local
# startup diagnostics without changing process-wide logging configuration.
logger = logging.getLogger("uvicorn.error")
V2_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BUNDLE_PATH = V2_ROOT / "artifacts" / DEFAULT_MODEL_VERSION


def resolve_bundle_path(bundle_path: str | Path | None = None) -> Path:
    """Resolve explicit, environment, or portable project-local configuration."""
    configured = bundle_path
    if configured is None:
        configured = os.environ.get("VALUATION_BUNDLE_PATH")
    if configured is None or not str(configured).strip():
        return DEFAULT_BUNDLE_PATH.resolve()
    resolved = Path(configured).expanduser()
    if not resolved.is_absolute():
        resolved = V2_ROOT / resolved
    return resolved.resolve()


def create_app(
    bundle_path: str | Path | None = None,
    auth_mode: str | None = None,
    expected_model_version: str | None = None,
) -> FastAPI:
    """Create an app whose lifespan loads one validated bundle per process."""

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        configured_auth_mode = auth_mode or os.environ.get("VALUATION_AUTH_MODE", "required")
        if configured_auth_mode not in {"required", "disabled"}:
            raise RuntimeError("VALUATION_AUTH_MODE must be 'required' or 'disabled'.")
        service_token = os.environ.get("VALUATION_SERVICE_TOKEN", "")
        if configured_auth_mode == "required" and not service_token.strip():
            raise RuntimeError("VALUATION_SERVICE_TOKEN is required when authentication is enabled.")

        # The release token is needed by the build-time fetcher only. Render can
        # expose service environment variables to both build and runtime phases.
        os.environ.pop("GITHUB_RELEASE_TOKEN", None)
        model_version = expected_model_version or os.environ.get(
            "VALUATION_MODEL_VERSION", DEFAULT_MODEL_VERSION
        )
        if not model_version or Path(model_version).name != model_version:
            raise RuntimeError("VALUATION_MODEL_VERSION must be a single version identifier.")
        configured_path = bundle_path
        if configured_path is None and not os.environ.get("VALUATION_BUNDLE_PATH"):
            configured_path = V2_ROOT / "artifacts" / model_version
        resolved_path = resolve_bundle_path(configured_path)
        load_started = perf_counter()
        logger.info("Loading valuation bundle from %s", resolved_path)
        try:
            bundle = load_bundle(resolved_path)
        except Exception as error:
            logger.exception("Unable to load valuation bundle from %s", resolved_path)
            raise RuntimeError(
                f"Unable to load valuation bundle from {resolved_path}: {error}"
            ) from error
        if bundle.model_version != model_version:
            raise RuntimeError(
                "Loaded valuation bundle does not match VALUATION_MODEL_VERSION."
            )
        load_seconds = perf_counter() - load_started
        app.state.valuation_bundle = bundle
        app.state.prediction_lock = Lock()
        app.state.bundle_load_seconds = load_seconds
        app.state.valuation_auth_mode = configured_auth_mode
        app.state.valuation_service_token = service_token if configured_auth_mode == "required" else None
        logger.info(
            "Valuation bundle ready model_version=%s training_cutoff=%s "
            "coverage_levels=%s integrity=verified load_seconds=%.3f",
            bundle.model_version,
            bundle.metadata["training_cutoff"],
            SUPPORTED_COVERAGE_LEVELS,
            load_seconds,
        )
        try:
            yield
        finally:
            app.state.valuation_bundle = None
            app.state.prediction_lock = None
            app.state.valuation_service_token = None

    app = FastAPI(
        title="SG Homie HDB Valuation Research API",
        description="Research inference using a persisted CatBoost bundle.",
        version="1.0.0",
        lifespan=lifespan,
    )

    @app.exception_handler(RequestValidationError)
    async def validation_error_response(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        def json_safe(value):
            if isinstance(value, float) and not math.isfinite(value):
                return repr(value)
            if isinstance(value, BaseException):
                return str(value)
            if isinstance(value, dict):
                return {key: json_safe(item) for key, item in value.items()}
            if isinstance(value, (list, tuple)):
                return [json_safe(item) for item in value]
            return value

        return JSONResponse(
            status_code=422,
            content={"detail": json_safe(error.errors())},
        )

    @app.get("/health", response_model=HealthResponse, tags=["health"])
    def health(request: Request) -> HealthResponse:
        bundle: LoadedValuationBundle | None = getattr(
            request.app.state, "valuation_bundle", None
        )
        if bundle is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Valuation model is unavailable.",
            )
        return HealthResponse(
            status="ok",
            model_loaded=True,
        )

    def require_service_token(request: Request) -> None:
        if request.app.state.valuation_auth_mode == "disabled":
            return
        authorization = request.headers.get("authorization", "")
        scheme, separator, supplied_token = authorization.partition(" ")
        expected_token = request.app.state.valuation_service_token or ""
        if (
            not separator
            or scheme.lower() != "bearer"
            or not supplied_token
            or not hmac.compare_digest(
                supplied_token.encode("utf-8"), expected_token.encode("utf-8")
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    @app.get(
        "/v1/valuation/model-info",
        response_model=ModelInfoResponse,
        tags=["valuation"],
    )
    def model_info(request: Request) -> ModelInfoResponse:
        require_service_token(request)
        bundle: LoadedValuationBundle = request.app.state.valuation_bundle
        metadata = bundle.metadata
        return ModelInfoResponse(
            model_version=bundle.model_version,
            model_family=str(metadata["model_family"]),
            training_cutoff=str(metadata["training_cutoff"]),
            default_coverage_level=float(DEFAULT_COVERAGE_LEVEL),
            supported_coverage_levels=list(SUPPORTED_COVERAGE_LEVELS),
            uncertainty_method=str(bundle.uncertainty["inference_method"]),
        )

    @app.post(
        "/v1/valuation/predict",
        response_model=PredictionResponse,
        tags=["valuation"],
    )
    def predict(payload: PredictionRequest, request: Request) -> PredictionResponse:
        require_service_token(request)
        bundle: LoadedValuationBundle = request.app.state.valuation_bundle
        ordered_features = {
            feature_name: getattr(payload, feature_name)
            for feature_name in BOOSTED_FEATURES
        }
        try:
            prediction = bundle.predict_one(
                ordered_features,
                coverage=payload.coverage,
                prediction_lock=request.app.state.prediction_lock,
            )
        except Exception as error:
            logger.exception("Valuation inference failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Valuation prediction failed.",
            ) from error

        price_position = None
        if payload.asking_price is not None:
            try:
                price_position = classify_asking_price(
                    payload.asking_price,
                    prediction.lower_bound,
                    prediction.upper_bound,
                )
            except Exception as error:
                logger.exception("Asking-price range classification failed")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Valuation prediction failed.",
                ) from error
        return PredictionResponse(
            estimated_value=prediction.estimated_value,
            lower_bound=prediction.lower_bound,
            upper_bound=prediction.upper_bound,
            interval_half_width=prediction.interval_half_width,
            interval_full_width=prediction.interval_full_width,
            coverage_target=prediction.coverage_target,
            model_version=prediction.model_version,
            uncertainty_method=prediction.uncertainty_method,
            uncertainty_group=prediction.uncertainty_group,
            uncertainty_support=prediction.calibration_support_count,
            used_global_fallback=prediction.used_global_fallback,
            price_position=price_position,
        )

    return app


app = create_app()
