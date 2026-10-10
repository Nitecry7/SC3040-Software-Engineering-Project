"""FastAPI transport tests using a small temporary CatBoost bundle."""

from __future__ import annotations

import json
import shutil

import pandas as pd
import pytest
from catboost import CatBoostRegressor
from fastapi.testclient import TestClient

from src.api import app as api_module
from src.api.app import create_app, resolve_bundle_path
from src.evaluation.uncertainty import classify_asking_price
from src.inference.bundle import (
    DEFAULT_COVERAGE_LEVEL,
    DEFAULT_MODEL_VERSION,
    LoadedValuationBundle,
    build_uncertainty_state,
    create_bundle_metadata,
    load_bundle,
    write_bundle,
)
from src.models.boosted import BOOSTED_FEATURES, CATEGORICAL_FEATURES


def _training_features(rows: int = 40) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "transaction_year": [2025] * rows,
            "transaction_month": [1 + index % 12 for index in range(rows)],
            "floor_area_sqm": [90.0 + index % 4 for index in range(rows)],
            "storey_mid": [5.0 + index % 6 for index in range(rows)],
            "remaining_lease_months": [650.0 - index for index in range(rows)],
            "town": ["ANG MO KIO" if index % 2 == 0 else "BEDOK" for index in range(rows)],
            "flat_type": ["3 ROOM" if index % 2 == 0 else "4 ROOM" for index in range(rows)],
            "block": [str(index % 5) for index in range(rows)],
            "street_name": [f"ROAD {index % 3}" for index in range(rows)],
            "flat_model": ["Model A" if index % 2 == 0 else "Model B" for index in range(rows)],
        },
        columns=BOOSTED_FEATURES,
    )


def _make_test_bundle(directory):
    X = _training_features()
    y = 300_000 + X["floor_area_sqm"] * 900 + X["storey_mid"] * 200
    model = CatBoostRegressor(
        iterations=3,
        depth=2,
        learning_rate=0.1,
        loss_function="RMSE",
        random_seed=42,
        allow_writing_files=False,
        verbose=False,
        thread_count=1,
    )
    model.fit(X, y, cat_features=list(CATEGORICAL_FEATURES), verbose=False)

    residual_rows = []
    for year in range(2021, 2026):
        residual_rows.extend(
            {
                "year": year,
                "town": "ANG MO KIO",
                "flat_type": "3 ROOM",
                "residual_sgd": float(residual + year - 2021),
            }
            for residual in range(1, 11)
        )
        residual_rows.extend(
            {
                "year": year,
                "town": "BEDOK",
                "flat_type": "4 ROOM",
                "residual_sgd": float(residual + year - 2021),
            }
            for residual in range(1, 3)
        )
    uncertainty = build_uncertainty_state(pd.DataFrame(residual_rows), "2025-12")
    metadata = create_bundle_metadata(
        training_row_count=len(X),
        training_device="cpu",
        source_dataset_coverage=("2017-01", "2026-10"),
        uncertainty_state=uncertainty,
        created_at="2026-10-08T12:00:00Z",
    )
    write_bundle(directory, model, metadata, uncertainty)
    return directory


@pytest.fixture(scope="module")
def test_bundle(tmp_path_factory):
    return _make_test_bundle(
        tmp_path_factory.mktemp("api_bundle") / DEFAULT_MODEL_VERSION
    )


@pytest.fixture
def client(test_bundle):
    with TestClient(create_app(test_bundle)) as test_client:
        yield test_client


def valid_request(**overrides):
    payload = {
        "transaction_year": 2026,
        "transaction_month": 10,
        "floor_area_sqm": 92,
        "storey_mid": 8,
        "remaining_lease_months": 780,
        "town": "Ang Mo Kio",
        "flat_type": "4 ROOM",
        "block": "123",
        "street_name": "TAMPINES STREET 11",
        "flat_model": "Model A",
    }
    payload.update(overrides)
    return payload


def test_health_and_model_info_expose_only_safe_fields(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {
        "status": "ok",
        "model_loaded": True,
        "model_version": DEFAULT_MODEL_VERSION,
        "bundle_format_version": 1,
    }

    info = client.get("/v1/valuation/model-info")
    assert info.status_code == 200
    assert info.json() == {
        "model_version": DEFAULT_MODEL_VERSION,
        "model_family": "catboost",
        "training_cutoff": "2025-12",
        "default_coverage_level": 0.90,
        "supported_coverage_levels": [0.8, 0.9, 0.95],
        "uncertainty_method": "town_conformal",
    }
    assert "directory" not in info.text
    assert "sha256" not in info.text.lower()
    assert "thresholds" not in info.text


def test_openapi_docs_are_enabled(client):
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_prediction_defaults_to_90_percent_and_returns_typed_interval(client):
    response = client.post("/v1/valuation/predict", json=valid_request())
    assert response.status_code == 200
    body = response.json()
    assert body["coverage_target"] == DEFAULT_COVERAGE_LEVEL
    assert body["model_version"] == DEFAULT_MODEL_VERSION
    assert body["uncertainty_method"] == "town_conformal"
    assert body["uncertainty_group"] == "ANG MO KIO"
    assert body["uncertainty_support"] == 50
    assert body["used_global_fallback"] is False
    assert body["price_position"] is None
    assert body["lower_bound"] == pytest.approx(
        body["estimated_value"] - body["interval_half_width"]
    )
    assert body["upper_bound"] == pytest.approx(
        body["estimated_value"] + body["interval_half_width"]
    )
    assert body["interval_full_width"] == pytest.approx(
        2 * body["interval_half_width"]
    )


@pytest.mark.parametrize("coverage", [0.80, 0.95])
def test_supported_non_default_coverage_levels_work(client, coverage):
    response = client.post(
        "/v1/valuation/predict", json=valid_request(coverage=coverage)
    )
    assert response.status_code == 200
    assert response.json()["coverage_target"] == coverage


@pytest.mark.parametrize("coverage", [0.85, 0.99, "90%", "0.9", 90])
def test_unsupported_or_coerced_coverage_is_rejected(client, coverage):
    response = client.post(
        "/v1/valuation/predict", json=valid_request(coverage=coverage)
    )
    assert response.status_code == 422


def test_non_finite_coverage_returns_structured_validation_error(client):
    response = client.post(
        "/v1/valuation/predict",
        content=json.dumps(valid_request(coverage=float("nan"))),
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422
    assert "coverage" in response.text


def test_integral_numeric_inputs_are_accepted(client):
    response = client.post("/v1/valuation/predict", json=valid_request())
    assert response.status_code == 200


@pytest.mark.parametrize(
    "field,value",
    [("floor_area_sqm", "92"), ("asking_price", "500000")],
)
def test_numeric_strings_are_rejected(client, field, value):
    assert client.post(
        "/v1/valuation/predict", json=valid_request(**{field: value})
    ).status_code == 422


@pytest.mark.parametrize("month", [0, 13, 1.5])
def test_invalid_month_is_rejected(client, month):
    assert client.post(
        "/v1/valuation/predict", json=valid_request(transaction_month=month)
    ).status_code == 422


@pytest.mark.parametrize(
    "field,value",
    [
        ("town", "   "),
        ("flat_type", ""),
        ("block", " "),
        ("street_name", ""),
        ("flat_model", "\t"),
    ],
)
def test_blank_required_categories_are_rejected(client, field, value):
    assert client.post(
        "/v1/valuation/predict", json=valid_request(**{field: value})
    ).status_code == 422


@pytest.mark.parametrize("field,value", [("floor_area_sqm", float("nan")), ("storey_mid", float("inf")), ("remaining_lease_months", -1)])
def test_invalid_numeric_inputs_are_rejected(client, field, value):
    response = client.post(
        "/v1/valuation/predict",
        content=json.dumps(valid_request(**{field: value})),
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422


def test_missing_or_unexpected_fields_are_rejected(client):
    payload = valid_request()
    payload.pop("flat_model")
    assert client.post("/v1/valuation/predict", json=payload).status_code == 422
    assert client.post(
        "/v1/valuation/predict", json=valid_request(unknown_field="value")
    ).status_code == 422


def test_known_town_normalizes_case_and_whitespace_and_unknown_falls_back(client):
    known = client.post(
        "/v1/valuation/predict", json=valid_request(town="  aNg Mo Kio  ")
    ).json()
    assert known["uncertainty_group"] == "ANG MO KIO"
    assert known["used_global_fallback"] is False

    unknown = client.post(
        "/v1/valuation/predict", json=valid_request(town="Unknown Town")
    ).json()
    assert unknown["uncertainty_group"] == "UNKNOWN TOWN"
    assert unknown["used_global_fallback"] is True
    assert unknown["uncertainty_support"] == 60


def test_asking_price_is_context_only_and_uses_existing_classifier(
    client, monkeypatch
):
    captured = {}
    original = LoadedValuationBundle.predict_one

    def spy(self, features, coverage=DEFAULT_COVERAGE_LEVEL, prediction_lock=None):
        captured["features"] = dict(features)
        return original(self, features, coverage, prediction_lock)

    monkeypatch.setattr(LoadedValuationBundle, "predict_one", spy)
    baseline = client.post("/v1/valuation/predict", json=valid_request()).json()
    assert tuple(captured["features"]) == BOOSTED_FEATURES
    assert "asking_price" not in captured["features"]
    assert "coverage" not in captured["features"]

    below = baseline["lower_bound"] - 1
    within = baseline["lower_bound"]
    above = baseline["upper_bound"] + 1
    for amount, expected in [
        (below, "below_estimated_market_range"),
        (within, "within_estimated_market_range"),
        (above, "above_estimated_market_range"),
    ]:
        body = client.post(
            "/v1/valuation/predict", json=valid_request(asking_price=amount)
        ).json()
        assert body["price_position"] == expected
        assert body["estimated_value"] == baseline["estimated_value"]
    assert classify_asking_price(
        baseline["lower_bound"], baseline["lower_bound"], baseline["upper_bound"]
    ) == "within_estimated_market_range"


def test_prediction_lock_is_held_only_for_model_call(client, monkeypatch):
    bundle = client.app.state.valuation_bundle
    lock = client.app.state.prediction_lock
    original_predict = bundle.model.predict
    original_lookup = LoadedValuationBundle.get_uncertainty_threshold
    observed = {"model_call_locked": False, "threshold_lookup_unlocked": False}

    def checked_predict(model, *args, **kwargs):
        assert lock.locked()
        observed["model_call_locked"] = True
        return original_predict(*args, **kwargs)

    def checked_lookup(model, *args, **kwargs):
        assert not lock.locked()
        observed["threshold_lookup_unlocked"] = True
        return original_lookup(model, *args, **kwargs)

    monkeypatch.setattr(type(bundle.model), "predict", checked_predict)
    monkeypatch.setattr(LoadedValuationBundle, "get_uncertainty_threshold", checked_lookup)
    assert client.post("/v1/valuation/predict", json=valid_request()).status_code == 200
    assert observed == {
        "model_call_locked": True,
        "threshold_lookup_unlocked": True,
    }
    assert not lock.locked()


def test_http_matches_direct_bundle_prediction(client):
    payload = valid_request(town="ANG MO KIO")
    features = {name: payload[name] for name in BOOSTED_FEATURES}
    direct = client.app.state.valuation_bundle.predict_one(features)
    response = client.post("/v1/valuation/predict", json=payload)
    assert response.status_code == 200
    body = response.json()
    for key, expected in [
        ("estimated_value", direct.estimated_value),
        ("lower_bound", direct.lower_bound),
        ("upper_bound", direct.upper_bound),
        ("interval_half_width", direct.interval_half_width),
        ("interval_full_width", direct.interval_full_width),
        ("coverage_target", direct.coverage_target),
    ]:
        assert body[key] == pytest.approx(expected, rel=1e-12, abs=1e-8)
    assert body["used_global_fallback"] == direct.used_global_fallback


def test_unseen_categories_and_absent_raw_csv_do_not_block_inference(
    test_bundle, tmp_path, monkeypatch
):
    monkeypatch.chdir(tmp_path)
    assert not (tmp_path / "data" / "raw").exists()

    def forbid_csv_read(*args, **kwargs):
        raise AssertionError("API runtime must not read CSV files")

    monkeypatch.setattr(pd, "read_csv", forbid_csv_read)
    payload = valid_request(
        town="Unknown Town",
        flat_type="UNSEEN FLAT TYPE",
        block="999999",
        street_name="UNKNOWN STREET",
        flat_model="UNSEEN MODEL",
    )
    with TestClient(create_app(test_bundle)) as isolated_client:
        response = isolated_client.post("/v1/valuation/predict", json=payload)
    assert response.status_code == 200
    assert response.json()["used_global_fallback"] is True


def test_bundle_loads_once_per_application_lifespan(test_bundle, monkeypatch):
    calls = []
    original_loader = api_module.load_bundle

    def counted_loader(path):
        calls.append(path)
        return original_loader(path)

    monkeypatch.setattr(api_module, "load_bundle", counted_loader)
    app = create_app(test_bundle)
    with TestClient(app) as first_lifespan:
        assert first_lifespan.get("/health").status_code == 200
        for _ in range(3):
            assert first_lifespan.post(
                "/v1/valuation/predict", json=valid_request()
            ).status_code == 200
        assert len(calls) == 1
    with TestClient(app) as second_lifespan:
        assert second_lifespan.get("/health").status_code == 200
        assert len(calls) == 2
    with TestClient(create_app(test_bundle)) as independent_app:
        assert independent_app.get("/health").status_code == 200
        assert len(calls) == 3


def test_startup_fails_clearly_when_bundle_is_missing(tmp_path):
    with pytest.raises(RuntimeError, match="Unable to load valuation bundle"):
        with TestClient(create_app(tmp_path / "missing-bundle")):
            pass


def test_startup_fails_clearly_on_checksum_corruption(test_bundle, tmp_path):
    corrupt = tmp_path / DEFAULT_MODEL_VERSION
    shutil.copytree(test_bundle, corrupt)
    uncertainty = corrupt / "uncertainty.json"
    uncertainty.write_text(uncertainty.read_text(encoding="utf-8") + " ", encoding="utf-8")
    with pytest.raises(RuntimeError, match="Unable to load valuation bundle"):
        with TestClient(create_app(corrupt)):
            pass


def test_bundle_path_defaults_and_environment_override(test_bundle, monkeypatch):
    monkeypatch.delenv("VALUATION_BUNDLE_PATH", raising=False)
    assert resolve_bundle_path() == api_module.DEFAULT_BUNDLE_PATH.resolve()
    monkeypatch.setenv("VALUATION_BUNDLE_PATH", str(test_bundle))
    monkeypatch.chdir(test_bundle.parent.parent)
    assert resolve_bundle_path() == test_bundle.resolve()


def test_unexpected_prediction_error_is_logged_and_sanitized(client, monkeypatch):
    def fail(*args, **kwargs):
        raise RuntimeError("internal stack data")

    monkeypatch.setattr(LoadedValuationBundle, "predict_one", fail)
    response = client.post("/v1/valuation/predict", json=valid_request())
    assert response.status_code == 500
    assert response.json() == {"detail": "Valuation prediction failed."}
    assert "internal stack data" not in response.text
