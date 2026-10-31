"""Additional HTTP contract and recovery cases; all model data are synthetic.

Public HTTP cases are black-box tests. Fault injection and lifecycle state
assertions exercise white-box error and cleanup branches with a tiny CPU model.
"""

import json
import logging

from fastapi.testclient import TestClient
import pytest

import src.api.app as api_module
from src.api.app import create_app, resolve_bundle_path
from test_api import client, test_bundle, valid_request  # noqa: F401


@pytest.mark.parametrize(
    "field,value",
    [
        ("transaction_year", 2016),
        ("transaction_year", True),
        ("transaction_year", "2026"),
        ("transaction_month", True),
        ("floor_area_sqm", 0),
        ("floor_area_sqm", False),
        ("storey_mid", 0),
        ("storey_mid", True),
        ("remaining_lease_months", False),
        ("remaining_lease_months", "780"),
        ("asking_price", 0),
        ("asking_price", -1),
        ("asking_price", True),
        ("coverage", True),
        ("town", 123),
        ("flat_type", ["4 ROOM"]),
    ],
)
def test_api_rejects_lower_bound_and_type_confusion_inputs(client, field, value):
    response = client.post(
        "/v1/valuation/predict", json=valid_request(**{field: value})
    )
    assert response.status_code == 422
    assert any(error["loc"][-1] == field for error in response.json()["detail"])


@pytest.mark.parametrize("month", [1, 12])
def test_api_accepts_inclusive_month_and_zero_remaining_lease_boundaries(client, month):
    response = client.post(
        "/v1/valuation/predict",
        json=valid_request(transaction_month=month, remaining_lease_months=0),
    )
    assert response.status_code == 200
    assert response.json()["price_position"] is None


@pytest.mark.parametrize("field", ["resale_price", "price_per_sqm", "income"])
def test_api_rejects_target_derived_and_affordability_fields(client, field):
    response = client.post(
        "/v1/valuation/predict", json=valid_request(**{field: 500_000})
    )
    assert response.status_code == 422
    assert any(error["type"] == "extra_forbidden" for error in response.json()["detail"])


@pytest.mark.parametrize(
    "authorization",
    ["Basic service-test-token", "Bearer", "Bearer ", "Bearer  service-test-token", "Bearer service-test-token "],
)
def test_api_auth_rejects_malformed_or_padded_credentials(test_bundle, monkeypatch, authorization):
    monkeypatch.setenv("VALUATION_SERVICE_TOKEN", "service-test-token")
    with TestClient(create_app(test_bundle, auth_mode="required")) as hosted:
        for route in ["/v1/valuation/model-info", "/v1/valuation/predict"]:
            response = (
                hosted.get(route, headers={"Authorization": authorization})
                if route.endswith("model-info")
                else hosted.post(route, json=valid_request(), headers={"Authorization": authorization})
            )
            assert response.status_code == 401
            assert response.headers["www-authenticate"] == "Bearer"
            assert response.json() == {"detail": "Unauthorized."}


def test_api_auth_accepts_case_insensitive_bearer_scheme(test_bundle, monkeypatch):
    monkeypatch.setenv("VALUATION_SERVICE_TOKEN", "service-test-token")
    with TestClient(create_app(test_bundle, auth_mode="required")) as hosted:
        response = hosted.get(
            "/v1/valuation/model-info",
            headers={"Authorization": "bEaReR service-test-token"},
        )
    assert response.status_code == 200


def test_api_health_reports_unavailable_before_lifespan_load():
    # TestClient deliberately has no context manager: startup has not run.
    unloaded = TestClient(create_app(auth_mode="disabled"))
    response = unloaded.get("/health")
    assert response.status_code == 503
    assert response.json() == {"detail": "Valuation model is unavailable."}
    unloaded.close()


@pytest.mark.parametrize("mode", ["unknown", "REQUIRED", " "])
def test_api_invalid_auth_mode_stops_startup(test_bundle, mode):
    with pytest.raises(RuntimeError, match="VALUATION_AUTH_MODE"):
        with TestClient(create_app(test_bundle, auth_mode=mode)):
            pass


def test_api_shutdown_clears_model_lock_and_service_secret(test_bundle, monkeypatch):
    monkeypatch.setenv("VALUATION_SERVICE_TOKEN", "service-test-token")
    app = create_app(test_bundle, auth_mode="required")
    with TestClient(app) as hosted:
        assert hosted.get("/health").status_code == 200
        assert app.state.valuation_service_token == "service-test-token"
        assert app.state.valuation_bundle is not None
        assert app.state.prediction_lock is not None
    assert app.state.valuation_bundle is None
    assert app.state.prediction_lock is None
    assert app.state.valuation_service_token is None


def test_api_model_failure_releases_prediction_lock_and_allows_retry(client, monkeypatch):
    model_type = type(client.app.state.valuation_bundle.model)
    original = model_type.predict

    def fail_prediction(*args, **kwargs):
        raise RuntimeError("synthetic-private-model-detail")

    monkeypatch.setattr(model_type, "predict", fail_prediction)
    failed = client.post("/v1/valuation/predict", json=valid_request())
    assert failed.status_code == 500
    assert failed.json() == {"detail": "Valuation prediction failed."}
    assert "synthetic-private-model-detail" not in failed.text
    assert not client.app.state.prediction_lock.locked()
    monkeypatch.setattr(model_type, "predict", original)
    assert client.post("/v1/valuation/predict", json=valid_request()).status_code == 200


def test_api_classification_failure_is_sanitized_after_prediction(client, monkeypatch, caplog):
    def fail_classification(*args, **kwargs):
        raise RuntimeError("synthetic-private-classifier-detail")

    monkeypatch.setattr(api_module, "classify_asking_price", fail_classification)
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    response = client.post(
        "/v1/valuation/predict", json=valid_request(asking_price=500_000)
    )
    assert response.status_code == 500
    assert response.json() == {"detail": "Valuation prediction failed."}
    assert "synthetic-private-classifier-detail" not in response.text + caplog.text
    assert not client.app.state.prediction_lock.locked()


@pytest.mark.parametrize("request_id", ["not-a-uuid", "private-location-value", "00000000-0000-0000-0000-000000000000"])
def test_api_invalid_correlation_hint_is_discarded_from_timing_logs(client, request_id, caplog):
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    response = client.post(
        "/v1/valuation/predict",
        json=valid_request(),
        headers={"X-Valuation-Request-ID": request_id},
    )
    assert response.status_code == 200
    events = [record.getMessage() for record in caplog.records if "valuation_timing {" in record.getMessage()]
    assert len(events) == 1
    event = json.loads(events[0].split("valuation_timing ", 1)[1])
    assert event["request_id"] is None
    assert request_id not in events[0]


def test_api_relative_bundle_override_is_project_relative_not_working_directory(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("VALUATION_BUNDLE_PATH", "artifacts/synthetic-test-version")
    assert resolve_bundle_path() == (api_module.V2_ROOT / "artifacts/synthetic-test-version").resolve()
