# SG Homie HDB resale price modelling (V2)

V2 is the clean research pipeline for future HDB resale price evaluation. It
supports raw data profiling, deterministic row-wise feature preparation,
chronological partitions, and historical transaction-price baselines. It does
not train a learned model or serve valuations.

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

Default partitions are train (2017-01 to 2024-12), validation
(2025-01 to 2025-12), test (2026-01 to 2026-09), and current partial/future
period (2026-10 onward). The partial/future partition is excluded from
validation and test evaluation. Boundaries can be configured through
`SplitBoundaries`.

## Historical baselines

Baselines provide an interpretable reference that future learned models must
beat. They use completed resale transactions only, not current SG Homie asking
prices. For a prediction in month M, every baseline uses transaction months
strictly before M. All rows in M are predicted before any M prices are added to
history. Evaluation advances month by month; completed validation months may
inform later validation predictions, and completed test months may inform later
test predictions.

Three baselines are implemented:

1. **Global median:** median resale price across all eligible past transactions.
2. **Town and flat-type median:** median for the same town and flat type, with a
   global-median fallback.
3. **Recent comparable median:** same town and flat type, strictly prior sales
   inside a configurable lookback. Matching uses floor area, storey midpoint,
   remaining lease, and recency only; resale price is used only after selection
   to calculate the comparable median. If too few comparable sales qualify,
   the fallback order is town/flat-type median, then global median.

Validation alone selects among 12 predeclared configurations: lookback 6, 12,
or 24 months; floor-area tolerance 10 or 15 sqm; and minimum comparable count 5
or 10. Maximum comparables is 30, storey tolerance is 6 floors, and remaining
lease tolerance is 60 months. Lowest validation MAE is primary; configurations
within 1% of the best MAE are treated as tied, then ranked by fallback rate,
distance from the initial defaults, worst town/flat-type MAE, and a stable
parameter order. The selected configuration is frozen before final test
evaluation. Test results do not tune configuration. October 2026 onward is
excluded from both validation and test.

### Recorded evaluation

The local dataset was evaluated with the chronological procedure. MAE and RMSE
are SGD; MAPE is percent. These are historical baselines, not a production
machine-learning valuation model.

| Validation baseline | MAE | RMSE | MAPE | R2 |
|---|---:|---:|---:|---:|
| Global median | $199,982.71 | $264,540.46 | 27.04% | -0.6798 |
| Town + flat-type median | $161,613.31 | $195,249.81 | 23.25% | 0.0849 |
| Selected comparable median | $39,354.92 | $66,935.89 | 5.66% | 0.8925 |

Selected configuration: 12-month lookback, minimum 5 and maximum 30
comparables, 15 sqm floor-area tolerance, 6 storey-midpoint tolerance, and
60-month remaining-lease tolerance. It was selected from the within-1% validation
MAE band because it had lower fallback use than the lowest-MAE configuration.

| Final test selected comparable | Value |
|---|---:|
| Predictions | 19,641 |
| MAE | $40,932.90 |
| RMSE | $70,470.57 |
| MAPE | 5.90% |
| R2 | 0.8937 |
| Median absolute error | $25,000.00 |
| Comparable fallback usage | 19,284 (98.18%) |
| Town/flat-type fallback usage | 357 (1.82%) |
| Global fallback usage | 0 (0.00%) |
| Comparable count when used (mean / median) | 27.89 / 30 |
| Comparable count when used (min / max) | 5 / 30 |

Test town and flat-type MAE, fallback counts, and comparable-count statistics
are printed by `scripts/evaluate_baselines.py`. Performance varies across groups;
small groups such as multi-generation flats have few observations and noisy
error estimates.

The legacy `MLPricePredictor/` experiments contain target leakage, including
features derived from the transaction price being predicted. Their model
metrics and generated outputs therefore must not be trusted as evidence of
future performance or used as production evidence. No learned V2 model has been
trained or evaluated yet.

## Intended future purpose

The eventual purpose is to evaluate an HDB resale price estimate using only
information available at prediction time, with chronological validation,
appropriate baseline comparisons, and documented provenance. The historical
baseline and reusable walk-forward evaluation stages are implemented. Learned-
model training, model persistence, and a narrow FastAPI inference interface
remain future work. No learned model is trained by the current project stage.

## Setup and commands

From this directory, install dependencies and run:

```powershell
python -m pip install -r requirements.txt
python scripts/profile_data.py
python scripts/prepare_data.py
python scripts/evaluate_baselines.py
python -m pytest
```

The profiler, preparation script, and baseline evaluation script load the raw
CSV without modifying it. Preparation reports partition shapes/date ranges and
quality screening without writing processed artifacts. Evaluation prints
metrics and diagnostics without persisting a large artifact.
