"""Narrow FastAPI service for the persisted valuation bundle."""

from __future__ import annotations

from contextlib import asynccontextmanager
import hmac
import json
import logging
import math
import os
from pathlib import Path
import re
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
    ValuationPrediction,
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
MODEL_VERSION_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


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


def _finite_prediction_number(value: object) -> bool:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _prediction_failure_category(
    prediction: ValuationPrediction, expected_model_version: str
) -> str | None:
    numeric_fields = (
        "estimated_value",
        "lower_bound",
        "upper_bound",
        "interval_half_width",
        "interval_full_width",
        "coverage_target",
    )
    required_fields = (
        *numeric_fields,
        "model_version",
        "uncertainty_method",
        "uncertainty_group",
        "calibration_support_count",
        "used_global_fallback",
    )
    if any(not hasattr(prediction, field) for field in required_fields):
        return "INVALID_PREDICTION_SCHEMA"
    numeric_values = tuple(getattr(prediction, field) for field in numeric_fields)
    if any(not _finite_prediction_number(value) for value in numeric_values):
        return "INVALID_PREDICTION_SCHEMA"
    if not isinstance(prediction.model_version, str) or prediction.model_version != expected_model_version:
        return "MODEL_VERSION_MISMATCH"
    if (
        prediction.estimated_value <= 0
        or prediction.lower_bound < 0
        or prediction.lower_bound > prediction.estimated_value
        or prediction.estimated_value > prediction.upper_bound
        or prediction.interval_half_width < 0
        or prediction.interval_full_width < 0
        or abs(
            prediction.interval_full_width
            - (prediction.upper_bound - prediction.lower_bound)
        ) > 0.01
        or abs(
            prediction.interval_half_width
            - (prediction.upper_bound - prediction.lower_bound) / 2
        ) > 0.01
    ):
        return "INVALID_INTERVAL"
    if (
        prediction.coverage_target not in SUPPORTED_COVERAGE_LEVELS
        or not isinstance(prediction.uncertainty_method, str)
        or not prediction.uncertainty_method.strip()
        or not isinstance(prediction.uncertainty_group, str)
        or not prediction.uncertainty_group.strip()
        or isinstance(prediction.calibration_support_count, bool)
        or not isinstance(prediction.calibration_support_count, int)
        or prediction.calibration_support_count < 0
        or not isinstance(prediction.used_global_fallback, bool)
    ):
        return "INVALID_PREDICTION_SCHEMA"
    return None


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

    @app.middleware("http")
    async def valuation_timing_middleware(request: Request, call_next):
        if request.url.path != "/v1/valuation/predict":
            return await call_next(request)

        # This header is only a correlation hint. Service authentication remains
        # exclusively in require_service_token and never consults this value.
        supplied_request_id = request.headers.get("x-valuation-request-id", "")
        request_id = supplied_request_id if re.fullmatch(
            r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}",
            supplied_request_id,
        ) else None
        request.state.valuation_stage_timings_ms = {}
        request.state.valuation_prediction_sanity = "not_checked"
        request.state.valuation_failure_category = None
        request.state.valuation_response_model_version = None
        request_started_at = perf_counter()
        response_status = 500
        try:
            response = await call_next(request)
            response_status = response.status_code
            return response
        finally:
            logger.info(
                "valuation_timing %s",
                json.dumps({
                    "event": "valuation_timing",
                    "request_id": request_id,
                    "status_code": response_status,
                    "failure_category": request.state.valuation_failure_category,
                    "model_version": getattr(
                        getattr(request.app.state, "valuation_bundle", None),
                        "model_version",
                        None,
                    ),
                    "prediction_model_version": request.state.valuation_response_model_version,
                    "prediction_sanity": request.state.valuation_prediction_sanity,
                    "timings_ms": {
                        **request.state.valuation_stage_timings_ms,
                        "total_request_ms": round((perf_counter() - request_started_at) * 1000, 2),
                    },
                }, separators=(",", ":")),
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
        stage_timings = request.state.valuation_stage_timings_ms

        def record_timing(name: str, seconds: float) -> None:
            stage_timings[name] = round(seconds * 1000, 2)

        feature_started_at = perf_counter()
        ordered_features = {
            feature_name: getattr(payload, feature_name)
            for feature_name in BOOSTED_FEATURES
        }
        record_timing("request_feature_order_ms", perf_counter() - feature_started_at)
        try:
            prediction = bundle.predict_one(
                ordered_features,
                coverage=payload.coverage,
                prediction_lock=request.app.state.prediction_lock,
                timing_callback=record_timing,
            )
        except Exception:
            request.state.valuation_failure_category = "VALUATION_INFERENCE_FAILURE"
            logger.error("Valuation inference failed")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Valuation prediction failed.",
            ) from None

        price_position = None
        if payload.asking_price is not None:
            classification_started_at = perf_counter()
            try:
                price_position = classify_asking_price(
                    payload.asking_price,
                    prediction.lower_bound,
                    prediction.upper_bound,
                )
            except Exception:
                request.state.valuation_failure_category = "VALUATION_CLASSIFICATION_FAILURE"
                logger.error("Asking-price range classification failed")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Valuation prediction failed.",
                ) from None
            finally:
                record_timing("asking_price_classification_ms", perf_counter() - classification_started_at)
        if (
            isinstance(getattr(prediction, "model_version", None), str)
            and MODEL_VERSION_PATTERN.fullmatch(prediction.model_version)
        ):
            request.state.valuation_response_model_version = prediction.model_version
        failure_category = _prediction_failure_category(prediction, bundle.model_version)
        if failure_category:
            request.state.valuation_prediction_sanity = "failed"
            request.state.valuation_failure_category = failure_category
            logger.error("Valuation prediction rejected category=%s", failure_category)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Valuation prediction failed.",
            )
        request.state.valuation_prediction_sanity = "passed"
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
