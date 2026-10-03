# SG Homie HDB resale price modelling (V2)

This package is the clean starting point for future HDB resale price research. Its
current scope is loading, profiling, and validating the source dataset. It does
not train or serve a model.

## Dataset

- **Dataset:** Resale flat prices based on registration date from Jan 2017 onwards
- **Publisher/source:** Housing & Development Board (HDB), published through
  data.gov.sg
- **data.gov.sg resource identifier:** `d_8b84c4ee58e3cfc0ece0d773c8ca6abc`
  (found in a commented API example in the repository; confirm it against the
  downloaded file's source page when recording a retrieval date/version.)
- **Local input:** place the downloaded CSV in `data/raw/`. The current local file
  is `ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv`.
- Raw CSV files in `data/raw/` are intentionally ignored by Git and are not
  included in commits.

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

## Setup and profiling

From this directory, install dependencies and run:

```powershell
python -m pip install -r requirements.txt
python scripts/profile_data.py
python -m pytest
```

The profiler loads the raw CSV without modifying it. The validator checks the
required source columns. Profiling output is informational and is not persisted
as a processed dataset.
