"""Load the local official HDB resale transaction CSV."""

from pathlib import Path

import pandas as pd

DEFAULT_RAW_DIR = Path(__file__).resolve().parents[2] / "data" / "raw"


def find_raw_csv(raw_dir: Path = DEFAULT_RAW_DIR) -> Path:
    """Return the sole CSV in *raw_dir*, requiring an explicit choice if ambiguous."""
    files = sorted(raw_dir.glob("*.csv"))
    if not files:
        raise FileNotFoundError(f"No CSV files found in raw data directory: {raw_dir}")
    if len(files) > 1:
        names = ", ".join(path.name for path in files)
        raise ValueError(f"Expected one raw CSV in {raw_dir}; found: {names}")
    return files[0]


def load_resale_data(path: Path | str | None = None) -> pd.DataFrame:
    """Read a raw CSV as supplied; do not transform or clean its values."""
    csv_path = Path(path) if path is not None else find_raw_csv()
    return pd.read_csv(csv_path)
