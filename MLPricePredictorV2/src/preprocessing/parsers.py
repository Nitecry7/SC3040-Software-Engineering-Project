"""Strict parsers for source fields represented as text."""

import re

import pandas as pd

_STOREY_PATTERN = re.compile(r"^\s*(\d+)\s+TO\s+(\d+)\s*$", re.IGNORECASE)
_LEASE_PATTERN = re.compile(
    r"^\s*(?:(\d+)\s+years?)(?:\s+(\d+)\s+months?)?\s*$|"
    r"^\s*(\d+)\s+months?\s*$",
    re.IGNORECASE,
)


def _is_missing(value: object) -> bool:
    return value is None or bool(pd.isna(value))


def parse_storey_range(value: object) -> tuple[int, int, float]:
    """Parse a source range such as ``'10 TO 12'`` into low/high/midpoint."""
    match = _STOREY_PATTERN.fullmatch(str(value)) if not _is_missing(value) else None
    if match is None:
        raise ValueError(f"Malformed storey range: {value!r}")
    low, high = (int(part) for part in match.groups())
    if low > high:
        raise ValueError(f"Storey range lower bound exceeds upper bound: {value!r}")
    return low, high, (low + high) / 2


def parse_remaining_lease(value: object) -> int:
    """Parse years and optional months (or months alone) into total months."""
    match = _LEASE_PATTERN.fullmatch(str(value)) if not _is_missing(value) else None
    if match is None:
        raise ValueError(f"Malformed remaining lease: {value!r}")
    years_text, months_text, months_only_text = match.groups()
    if months_only_text is not None:
        return int(months_only_text)
    years = int(years_text)
    months = int(months_text or 0)
    if months > 11:
        raise ValueError(f"Remaining lease months must be between 0 and 11: {value!r}")
    return years * 12 + months
