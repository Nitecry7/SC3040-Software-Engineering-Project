"""Controlled tests for private release retrieval without network or model downloads."""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import zipfile

import pytest
import pandas as pd
from catboost import CatBoostRegressor

from scripts import fetch_valuation_bundle as fetcher
from src.inference.bundle import (
    build_uncertainty_state,
    create_bundle_metadata,
    load_bundle,
    write_bundle,
)
from src.models.boosted import BOOSTED_FEATURES, CATEGORICAL_FEATURES

VERSION = "hdb-catboost-2025-12-v1"
FILES = {
    "model.cbm": b"test-model",
    "uncertainty.json": b"{}",
    "metadata.json": json.dumps({"model_version": VERSION}).encode(),
    "manifest.json": b"{}",
}


def make_archive(files=FILES) -> bytes:
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return stream.getvalue()


def fake_verified_bundle(path: Path, expected_version: str) -> Path:
    metadata = json.loads((path / "metadata.json").read_text(encoding="utf-8"))
    if metadata["model_version"] != expected_version:
        raise ValueError("version mismatch")
    if {item.name for item in path.iterdir()} != fetcher.REQUIRED_FILES:
        raise ValueError("missing bundle files")
    return path


def build_tiny_bundle(destination: Path) -> Path:
    row_count = 40
    features = pd.DataFrame(
        {
            "transaction_year": [2025] * row_count,
            "transaction_month": [1 + index % 12 for index in range(row_count)],
            "floor_area_sqm": [90.0 + index % 4 for index in range(row_count)],
            "storey_mid": [5.0 + index % 6 for index in range(row_count)],
            "remaining_lease_months": [650.0 - index for index in range(row_count)],
            "town": ["ANG MO KIO" if index % 2 == 0 else "BEDOK" for index in range(row_count)],
            "flat_type": ["3 ROOM" if index % 2 == 0 else "4 ROOM" for index in range(row_count)],
            "block": [str(index % 5) for index in range(row_count)],
            "street_name": [f"ROAD {index % 3}" for index in range(row_count)],
            "flat_model": ["Model A" if index % 2 == 0 else "Model B" for index in range(row_count)],
        },
        columns=BOOSTED_FEATURES,
    )
    target = 300_000 + features["floor_area_sqm"] * 900
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
    model.fit(features, target, cat_features=list(CATEGORICAL_FEATURES), verbose=False)
    residuals = pd.DataFrame(
        [
            {
                "year": year,
                "town": "ANG MO KIO",
                "flat_type": "3 ROOM",
                "residual_sgd": float(index + year - 2021),
            }
            for year in range(2021, 2026)
            for index in range(1, 13)
        ]
    )
    uncertainty = build_uncertainty_state(residuals, "2025-12")
    metadata = create_bundle_metadata(
        training_row_count=row_count,
        training_device="cpu",
        source_dataset_coverage=("2017-01", "2026-10"),
        uncertainty_state=uncertainty,
        created_at="2026-10-08T12:00:00Z",
    )
    write_bundle(destination, model, metadata, uncertainty)
    return destination


def mock_release_transport(monkeypatch, archive_bytes: bytes, *, digest=True):
    release = {
        "tag_name": VERSION,
        "assets": [
            {
                "id": 42,
                "name": f"{VERSION}.zip",
                "size": len(archive_bytes),
                "digest": (
                    "sha256:" + hashlib.sha256(archive_bytes).hexdigest()
                    if digest
                    else None
                ),
            }
        ]
    }
    calls = []

    def open_url(url, headers):
        calls.append((url, headers))
        if url.endswith(f"/releases/tags/{VERSION}"):
            return io.BytesIO(json.dumps(release).encode())
        return io.BytesIO(archive_bytes)

    monkeypatch.setattr(fetcher, "_open_url", open_url)
    return calls


def test_release_bundle_download_is_verified_and_atomically_published(
    tmp_path, monkeypatch
):
    archive_bytes = make_archive()
    calls = mock_release_transport(monkeypatch, archive_bytes)
    monkeypatch.setattr(fetcher, "_verified_local_bundle", fake_verified_bundle)

    result = fetcher.fetch_valuation_bundle(
        VERSION, "private-org/valuation-artifacts", "test-token", tmp_path
    )

    assert result == tmp_path / VERSION
    assert {path.name for path in result.iterdir()} == fetcher.REQUIRED_FILES
    assert (result / "model.cbm").read_bytes() == FILES["model.cbm"]
    assert len(calls) == 2
    assert calls[0][1]["Authorization"] == "Bearer test-token"
    assert calls[1][1]["Accept"] == "application/octet-stream"
    assert not list(tmp_path.glob(".valuation-fetch-*"))


def test_downloaded_fixture_bundle_passes_real_bundle_loader(tmp_path, monkeypatch):
    source = build_tiny_bundle(tmp_path / "source" / VERSION)
    archive_stream = io.BytesIO()
    with zipfile.ZipFile(archive_stream, "w") as archive:
        for filename in sorted(fetcher.REQUIRED_FILES):
            archive.write(source / filename, filename)
    archive_bytes = archive_stream.getvalue()
    mock_release_transport(monkeypatch, archive_bytes)

    fetched = fetcher.fetch_valuation_bundle(
        VERSION, "private-org/valuation-artifacts", "test-token", tmp_path / "artifacts"
    )
    loaded = load_bundle(fetched)
    assert loaded.model_version == VERSION
    assert set(path.name for path in fetched.iterdir()) == fetcher.REQUIRED_FILES


def test_bundle_manifest_mismatch_is_rejected_before_publication(tmp_path, monkeypatch):
    source = build_tiny_bundle(tmp_path / "source" / VERSION)
    (source / "uncertainty.json").write_text("{}", encoding="utf-8")
    archive_stream = io.BytesIO()
    with zipfile.ZipFile(archive_stream, "w") as archive:
        for filename in sorted(fetcher.REQUIRED_FILES):
            archive.write(source / filename, filename)
    archive_bytes = archive_stream.getvalue()
    mock_release_transport(monkeypatch, archive_bytes)

    with pytest.raises(ValueError, match="checksum mismatch"):
        fetcher.fetch_valuation_bundle(
            VERSION, "private-org/valuation-artifacts", "test-token", tmp_path / "artifacts"
        )
    assert not (tmp_path / "artifacts" / VERSION).exists()
    assert not list((tmp_path / "artifacts").glob(".valuation-fetch-*"))


def test_existing_valid_bundle_is_reused_without_token_or_network(tmp_path, monkeypatch):
    destination = tmp_path / VERSION
    destination.mkdir()
    for name, content in FILES.items():
        (destination / name).write_bytes(content)
    monkeypatch.setattr(fetcher, "_verified_local_bundle", fake_verified_bundle)
    monkeypatch.setattr(
        fetcher,
        "_open_url",
        lambda *args, **kwargs: pytest.fail("cached artifact should avoid network"),
    )

    assert fetcher.fetch_valuation_bundle(VERSION, "", "", tmp_path) == destination


def test_bad_asset_digest_does_not_publish_bundle(tmp_path, monkeypatch):
    archive_bytes = make_archive()
    mock_release_transport(monkeypatch, archive_bytes)
    original = fetcher._open_url
    def wrong_digest_open(url, headers):
        response = original(url, headers)
        if url.endswith(f"/releases/tags/{VERSION}"):
            payload = json.loads(response.read())
            payload["assets"][0]["digest"] = "sha256:" + "0" * 64
            return io.BytesIO(json.dumps(payload).encode())
        return io.BytesIO(archive_bytes)
    monkeypatch.setattr(fetcher, "_open_url", wrong_digest_open)

    with pytest.raises(ValueError, match="digest verification failed"):
        fetcher.fetch_valuation_bundle(VERSION, "org/repo", "token", tmp_path)
    assert not (tmp_path / VERSION).exists()
    assert not list(tmp_path.glob(".valuation-fetch-*"))


def test_missing_release_asset_fails_without_publishing(tmp_path, monkeypatch):
    monkeypatch.setattr(
        fetcher,
        "_open_url",
        lambda *args, **kwargs: io.BytesIO(
            json.dumps({"tag_name": VERSION, "assets": []}).encode()
        ),
    )
    with pytest.raises(RuntimeError, match="missing asset"):
        fetcher.fetch_valuation_bundle(VERSION, "org/repo", "token", tmp_path)
    assert not (tmp_path / VERSION).exists()


def test_failed_release_request_is_reported_without_publishing(tmp_path, monkeypatch):
    from urllib.error import URLError

    monkeypatch.setattr(
        fetcher,
        "_open_url",
        lambda *args, **kwargs: (_ for _ in ()).throw(URLError("offline")),
    )
    with pytest.raises(RuntimeError, match="Unable to retrieve the configured GitHub release"):
        fetcher.fetch_valuation_bundle(VERSION, "org/repo", "token", tmp_path)
    assert not (tmp_path / VERSION).exists()


def test_archive_with_unexpected_path_is_rejected(tmp_path, monkeypatch):
    archive_bytes = make_archive({**FILES, "../escape": b"no"})
    mock_release_transport(monkeypatch, archive_bytes, digest=False)
    monkeypatch.setattr(fetcher, "_verified_local_bundle", fake_verified_bundle)
    with pytest.raises(ValueError, match="exactly the four bundle files"):
        fetcher.fetch_valuation_bundle(VERSION, "org/repo", "token", tmp_path)
    assert not (tmp_path / "escape").exists()
    assert not (tmp_path / VERSION).exists()


def test_redirects_never_forward_authorization_header():
    from urllib.request import Request

    request = Request(
        "https://api.github.com/private", headers={"Authorization": "Bearer x"}
    )
    redirected = fetcher._SafeRedirectHandler().redirect_request(
        request,
        io.BytesIO(),
        302,
        "Found",
        {},
        "https://release-assets.githubusercontent.com/signed",
    )
    assert "Authorization" not in redirected.headers
    with pytest.raises(ValueError, match="HTTPS"):
        fetcher._SafeRedirectHandler().redirect_request(
            request, io.BytesIO(), 302, "Found", {}, "http://unsafe.example/file"
        )
