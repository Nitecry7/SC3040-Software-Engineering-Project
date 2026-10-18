"""Fetch one immutable private GitHub release bundle for a Render build."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from typing import BinaryIO
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener
import zipfile

V2_ROOT = Path(__file__).resolve().parents[1]
if str(V2_ROOT) not in sys.path:
    sys.path.insert(0, str(V2_ROOT))
API_ROOT = "https://api.github.com"
MAX_ARCHIVE_BYTES = 1_000_000_000
REQUIRED_FILES = {"model.cbm", "uncertainty.json", "metadata.json", "manifest.json"}


class _SafeRedirectHandler(HTTPRedirectHandler):
    """Follow HTTPS redirects without forwarding private repository tokens."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith("https://"):
            raise ValueError("GitHub release assets must redirect to HTTPS")
        safe_headers = {
            key: value
            for key, value in req.headers.items()
            if key.lower() not in {"authorization", "proxy-authorization"}
        }
        return Request(newurl, headers=safe_headers, method="GET")


def _open_url(url: str, headers: dict[str, str]):
    request = Request(url, headers=headers, method="GET")
    return build_opener(_SafeRedirectHandler).open(request, timeout=60)


def _copy_limited(response: BinaryIO, destination: Path, expected_size: int | None) -> int:
    total = 0
    with destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_ARCHIVE_BYTES:
                raise ValueError("Release bundle archive exceeds the configured size limit")
            output.write(chunk)
    if total == 0 or (expected_size is not None and total != expected_size):
        raise ValueError("Release bundle download was incomplete")
    return total


def _verified_local_bundle(bundle_path: Path, expected_version: str) -> Path:
    from src.inference.bundle import load_bundle

    bundle = load_bundle(bundle_path)
    if bundle.model_version != expected_version:
        raise ValueError("Existing bundle does not match the requested model version")
    return bundle_path


def fetch_valuation_bundle(
    expected_version: str,
    repository: str,
    token: str,
    artifact_root: str | Path | None = None,
) -> Path:
    """Download, verify, and atomically publish the versioned model bundle."""
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]*", expected_version or ""):
        raise ValueError("Expected model version must be a single version identifier")

    root = Path(artifact_root) if artifact_root is not None else V2_ROOT / "artifacts"
    root.mkdir(parents=True, exist_ok=True)
    published = root / expected_version
    if published.exists():
        return _verified_local_bundle(published, expected_version)
    if not re.fullmatch(r"[A-Za-z0-9-]+/[A-Za-z0-9_.-]+", repository or ""):
        raise ValueError("Artifact repository must use OWNER/REPOSITORY format")
    owner, name = repository.split("/", maxsplit=1)
    if not token.strip():
        raise ValueError("GitHub release token is required when the bundle is not cached")

    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "SG-Homie-Valuation-Bundle-Fetcher",
    }
    release_url = (
        f"{API_ROOT}/repos/{quote(owner)}/{quote(name)}"
        f"/releases/tags/{quote(expected_version, safe='')}"
    )
    try:
        with _open_url(release_url, headers) as response:
            release = json.load(response)
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise RuntimeError("Unable to retrieve the configured GitHub release") from error

    asset_name = f"{expected_version}.zip"
    if not isinstance(release, dict) or release.get("tag_name") != expected_version:
        raise RuntimeError("GitHub release tag does not match the requested model version")
    assets = release.get("assets") if isinstance(release, dict) else None
    asset = next(
        (
            item
            for item in assets or []
            if isinstance(item, dict) and item.get("name") == asset_name
        ),
        None,
    )
    if (
        asset is None
        or isinstance(asset.get("id"), bool)
        or not isinstance(asset.get("id"), int)
    ):
        raise RuntimeError(f"GitHub release is missing asset {asset_name}")
    declared_size = asset.get("size")
    if (
        isinstance(declared_size, bool)
        or not isinstance(declared_size, int)
        or declared_size <= 0
        or declared_size > MAX_ARCHIVE_BYTES
    ):
        raise RuntimeError("GitHub release asset has an invalid size")
    digest = asset.get("digest")
    if digest is not None and (
        not isinstance(digest, str) or not digest.startswith("sha256:")
    ):
        raise RuntimeError("GitHub release asset has an unsupported digest")

    stage_parent = Path(tempfile.mkdtemp(prefix=".valuation-fetch-", dir=root))
    staged_bundle = stage_parent / expected_version
    archive_path = stage_parent / asset_name
    publication_lock = root / f".fetch-{expected_version}.lock"
    owns_publication_lock = False
    try:
        asset_url = f"{API_ROOT}/repos/{owner}/{name}/releases/assets/{asset['id']}"
        asset_headers = {**headers, "Accept": "application/octet-stream"}
        try:
            with _open_url(asset_url, asset_headers) as response:
                downloaded = _copy_limited(response, archive_path, declared_size)
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            raise RuntimeError("Unable to download the configured GitHub release asset") from error
        if digest is not None:
            hasher = hashlib.sha256()
            with archive_path.open("rb") as downloaded_archive:
                for chunk in iter(lambda: downloaded_archive.read(1024 * 1024), b""):
                    hasher.update(chunk)
            actual_digest = hasher.hexdigest()
            if actual_digest != digest.removeprefix("sha256:"):
                raise ValueError("GitHub release asset digest verification failed")
        if downloaded != declared_size:
            raise ValueError("Release bundle download size does not match GitHub metadata")

        staged_bundle.mkdir()
        with zipfile.ZipFile(archive_path) as archive:
            entries = archive.infolist()
            names = [entry.filename for entry in entries]
            if len(names) != len(set(names)) or set(names) != REQUIRED_FILES:
                raise ValueError("Release archive must contain exactly the four bundle files at its root")
            if sum(entry.file_size for entry in entries) > MAX_ARCHIVE_BYTES:
                raise ValueError("Release bundle expands beyond the configured size limit")
            for entry in entries:
                if entry.is_dir() or Path(entry.filename).name != entry.filename:
                    raise ValueError("Release archive contains an unsafe path")
                target = staged_bundle / entry.filename
                with archive.open(entry) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)

        _verified_local_bundle(staged_bundle, expected_version)
        try:
            descriptor = os.open(
                publication_lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600
            )
            os.close(descriptor)
            owns_publication_lock = True
        except FileExistsError as error:
            raise RuntimeError("Another bundle publication is in progress") from error
        if published.exists():
            return _verified_local_bundle(published, expected_version)
        os.rename(staged_bundle, published)
        return _verified_local_bundle(published, expected_version)
    except zipfile.BadZipFile as error:
        raise ValueError("GitHub release asset is not a valid ZIP archive") from error
    finally:
        if owns_publication_lock:
            publication_lock.unlink(missing_ok=True)
        shutil.rmtree(stage_parent, ignore_errors=True)


def main() -> None:
    version = os.environ.get("VALUATION_MODEL_VERSION", "hdb-catboost-2025-12-v1")
    repository = os.environ.get("VALUATION_ARTIFACT_REPOSITORY", "")
    token = os.environ.get("GITHUB_RELEASE_TOKEN", "")
    try:
        destination = fetch_valuation_bundle(version, repository, token)
    except Exception as error:
        raise SystemExit(f"Valuation bundle acquisition failed: {error}") from error
    print(f"Verified valuation bundle {version} at {destination}")


if __name__ == "__main__":
    main()
