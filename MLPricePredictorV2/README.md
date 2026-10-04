# SG Homie HDB resale price modelling (V2)

V2 is the clean research pipeline for a future HDB resale price estimate. It
currently supports raw data profiling, deterministic row-wise base-feature
preparation, and chronological dataset partitions. It does not train or serve a
model.

## Dataset

- **Dataset:** Resale flat prices based on registration date from Jan-2017 onwards
- **Publisher:** Housing & Development Board (HDB)
- **Source:** [data.gov.sg](https://data.gov.sg/)
- **Resource ID:** `d_8b84c4ee58e3cfc0ece0d773c8ca6abc`
- **Local retrieval date:** 2026-10-04
- **Observed coverage:** 2017-01 through 2026-10
- **Update cadence:** the official source is updated daily; October 2026 is the
  current incomplete month as of retrieval.
- **Local input:** place the downloaded CSV in `data/raw/`. The current local file
  is `ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv`.
- Raw CSV files in `data/raw/` are intentionally ignored by Git and are not
included in commits. The local copy does not automatically synchronize with
data.gov.sg; retrieve and verify a new copy explicitly when refreshing data.

## Data handling

Preparation preserves source rows and indices. The profiler observed 318 exact
duplicate rows. There is no unique transaction identifier in the source, so
equality across recorded fields does not establish that records refer to the
same real-world transaction; duplicates are reported, never automatically
deleted. IQR screening for resale price and floor area is informational only and
does not remove records.

Base features are constructed row by row from transaction month/year, town,
flat type, block, street, flat model, floor area, lease commencement year,
parsed storey bounds/midpoint, and parsed remaining lease months. The target is
`resale_price`, kept separately from `X`. No price-derived features, target
aggregates, rolling price statistics, or category encodings are created.

Default partitions are train (2017-01–2024-12), validation
(2025-01–2025-12), test (2026-01–2026-09), and current partial/future period
(2026-10 onward). The partial/future partition is excluded from validation and
test evaluation. Boundaries can be configured through `SplitBoundaries`.

The legacy `MLPricePredictor/` experiments contain target leakage, including
features derived from the transaction price being predicted. Their model
metrics and generated outputs therefore must not be trusted as evidence of
future performance or used as production evidence. V2 starts with a verified
understanding of the source data before implementing leakage-safe processing.

## Intended future purpose

The eventual purpose is to evaluate an HDB resale price estimate using only
information available at prediction time, with chronological validation,
appropriate baseline comparisons, and documented provenance. Later stages may
add preprocessing, training, evaluation, model persistence, and a narrow FastAPI
inference interface. These capabilities are planned and are not implemented
here. No model is trained by the current project stage.

## Setup and commands

From this directory, install dependencies and run:

```powershell
python -m pip install -r requirements.txt
python scripts/profile_data.py
python scripts/prepare_data.py
python -m pytest
```

The profiler and preparation script load the raw CSV without modifying it.
Preparation reports partition shapes/date ranges and quality screening without
writing processed artifacts. Training, evaluation, model persistence, and
FastAPI inference remain future work.
