# SG Homie HDB resale price modelling (V2)

V2 is the clean research pipeline for HDB resale price evaluation. It supports
raw data profiling, deterministic row-wise feature preparation, chronological
partitions, historical transaction-price baselines, and leakage-safe Linear,
Ridge, tree, and CatBoost research. It evaluates uncertainty ranges for the
selected CatBoost point estimator; it does not serve valuations or provide an
approved production model.

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
aggregates, rolling price statistics, or target-based category encodings are
created. The learned model pipeline uses a fixed subset described below.

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

## Initial learned linear models

`scripts/evaluate_linear_models.py` compares ordinary Linear Regression with
Ridge Regression at alphas 0.1, 1, 10, and 100. Both use the same sparse
one-hot categorical encoding and numeric scaling inside a scikit-learn
pipeline. Unknown categories are ignored at transform time. Encoders and
scalers are fitted only on training data for validation; the selected pipeline
is then refitted on train plus validation before test evaluation. No model
artifact or processed dataset is written.

The model feature schema is `transaction_year`, `transaction_month`,
`floor_area_sqm`, `storey_mid`, `remaining_lease_months`, `town`, `flat_type`,
`block`, `street_name`, and `flat_model`. `storey_low` and `storey_high` are
omitted because their midpoint is an exact linear combination. The observed
correlation between `lease_commence_date` and `remaining_lease_months` is 0.982,
so lease commencement is omitted in favor of remaining lease. Block and street
are retained as sparse categories despite their high cardinality. The selector
uses validation MAE, treats candidates within 1% of the minimum as tied, then
uses RMSE, median absolute error, and model simplicity. Test results do not
select the model or alpha.

On the current local dataset (241,920 rows), the selected validation model was
Linear Regression. Its validation MAE was $50,772.32, RMSE $70,114.17, MAPE
7.44%, R2 0.8820, and median absolute error $38,617.41. The best Ridge result
was alpha 0.1, with validation MAE $50,793.75. Linear Regression was selected
within the 1% MAE band because it had lower RMSE. The selected comparable
baseline validation MAE was $39,354.92; Linear Regression underperformed it on
MAE.

After refitting Linear Regression on 2017-01 through 2025-12, its 2026-01 to
2026-09 test results were MAE $49,861.68, RMSE $69,194.33, MAPE 8.08%, R2
0.8975, and median absolute error $37,212.77. The comparable baseline test
reference was MAE $40,932.90, RMSE $70,470.57, MAPE 5.90%, R2 0.8937, and
median absolute error $25,000. The learned model underperformed on MAE, MAPE,
and median absolute error while having lower RMSE and higher R2. This is an
initial research result, not a production valuation. Test town and flat-type
MAE with support counts and coefficient diagnostics are printed by the script.

The selected pipeline has 3,375 encoded features. Train plus validation design
data has shape 222,067 by 3,375, with approximately 26.13 MiB of CSR storage.
The largest coefficients are descriptive contrasts against dropped one-hot
reference categories; they are not causal explanations. Correlated property
attributes and high-cardinality locations make individual coefficients
unstable and should be interpreted cautiously.

The test comparison is not a perfectly matched update protocol: the historical
comparable baseline advances month by month and may use completed earlier test
months, while the learned model is frozen after 2025-12 as required by this
evaluation. Neither test result was used for model selection. Current partial
period rows from 2026-10 onward remain excluded.

## Nonlinear tree benchmarks

`scripts/evaluate_tree_models.py` compares Extra Trees, Random Forest, and
HistGradientBoosting using the chronological partitions above. The four forest
candidates use the fixed 100-tree, `max_features=1.0`, seed-42 setup and compare
minimum leaf sizes 2 and 10. Forests use the same five one-hot categorical and
five numeric features as the linear pipeline, but numeric columns are not
scaled. The two HistGradientBoosting candidates compare 100 and 200 boosting
iterations; both use learning rate 0.1, `max_leaf_nodes=31`,
`min_samples_leaf=20`, `l2_regularization=1.0`, `early_stopping=False`, and
seed 42. It uses native categorical data for town, flat type, and flat model;
block and street are omitted because their category cardinalities exceed the
estimator's `max_bins=255` limit. Category values are learned from the fitting
partition only, and unseen values map to missing.

All six candidates fit only on 2017-01 through 2024-12 and are scored on 2025.
Selection uses the 1% validation MAE band, followed by RMSE, median absolute
error, MAPE, configuration simplicity, measured runtime and memory, and a
stable tie-break. The frozen selected configuration is refitted through
2025-12 and evaluated once on 2026-01 through 2026-09. Validation and test
targets do not fit preprocessing or model parameters; 2026-10 onward is
excluded. The script reports candidate and final matrix/model memory, fit and
prediction time, test MAE by town and flat type with support, and aggregated
impurity feature importance where the estimator exposes it. Impurity importance
is noncausal and can favor high-cardinality features.

On the local 241,920-row CSV, the six validation candidates produced:

| Candidate | Validation MAE | RMSE | MAPE | Fit seconds | Estimator size estimate |
|---|---:|---:|---:|---:|---:|
| Extra Trees, leaf 2 | $43,443.85 | $56,546.91 | 6.55% | 989.27 | 1,136.57 MiB |
| Extra Trees, leaf 10 | $46,452.53 | $64,009.61 | 6.80% | 225.28 | 185.61 MiB |
| Random Forest, leaf 2 | $46,808.59 | $62,509.40 | 6.97% | 678.24 | 741.90 MiB |
| Random Forest, leaf 10 | $51,095.84 | $73,152.73 | 7.41% | 131.25 | 131.90 MiB |
| HistGradientBoosting, 100 iterations | $49,911.97 | $66,744.98 | 7.32% | 0.61 | 0.43 MiB |
| HistGradientBoosting, 200 iterations | $48,578.84 | $64,173.23 | 7.17% | 0.91 | 0.84 MiB |

Extra Trees with minimum leaf size 2 had the lowest validation MAE and was
selected. Its validation MAE was $43,443.85, RMSE $56,546.91, MAPE 6.55%, R2
0.9232, and median absolute error $36,050.04. It was better than the recorded
Linear/Ridge validation MAEs ($50,772.32 / $50,793.75), but worse than the
fixed comparable-baseline validation MAE of $39,354.92. The comparable
configuration was evaluated as a reference only and did not enter tree
selection.

After refitting on train plus validation, the frozen Extra Trees model scored
the test period at MAE $30,056.10, RMSE $44,414.51, MAPE 4.55%, R2 0.9578,
median absolute error $21,287.12, mean actual price $663,826.70, and mean
predicted price $663,921.94. The previously recorded comparable baseline test
metrics were MAE $40,932.90, RMSE $70,470.57, MAPE 5.90%; recorded Linear
Regression test metrics were $49,861.68, $69,194.33, and 8.08% respectively.
These references were not rerun or used to select the tree model. The
comparable baseline uses month-by-month test updates, whereas the learned model
is frozen after 2025-12, so this is not a matched update protocol.

The final encoded design matrix was 222,067 by 3,380 with 2,220,670 nonzero
entries and 26.26 MiB of CSR storage. The selected final estimator's serialized
size estimate was 1,281.10 MiB; its train-only validation counterpart was
1,136.57 MiB. Extra Trees fit on train plus validation in 956.98 seconds and
predicted test rows in 0.07 seconds. The full script, including all six
validation fits and the validation comparable reference, took 2,999.24 seconds
(about 50 minutes) on the local environment. The validation forest input
matrix was 196,982 by 3,358 with 23.29 MiB of CSR storage. Test town MAEs
ranged from $21,712.50 (Bukit Batok, n=1,118) to $48,938.84 (Queenstown,
n=616). Flat-type MAEs ranged from $17,805.21 (2 ROOM, n=588) to $136,968.90
(MULTI-GENERATION, n=6); the low-support group estimate is noisy.

Aggregated impurity importance ranked flat type, town, and transaction year
highest. These values are noncausal and may favor high-cardinality predictors.
Results are research benchmarks, not evidence of production valuation quality.
The large, slow Extra Trees fit and high serialized estimator size are material
deployment limitations. Next, investigate a compute-efficient and stable model
that improves validation error over the comparable-sales baseline before
considering production integration. The later CatBoost benchmark and persisted
research bundle are documented separately below.

## CatBoost and XGBoost benchmarks

`scripts/evaluate_boosted_models.py` adds validation-only CatBoost and XGBoost
comparisons. It defaults to `--device gpu`; the script checks `nvidia-smi`,
CatBoost GPU availability, and small CatBoost/XGBoost CUDA smoke fits before
training. `--device cpu` is an explicit development option. A requested GPU
that either library cannot use is an error; the script never deliberately
switches a GPU request to CPU. On Windows, install the pinned-compatible
requirements from this directory before running the benchmark.

Both models use the same ten base features as the linear and tree experiments:
numeric `transaction_year`, `transaction_month`, `floor_area_sqm`,
`storey_mid`, and `remaining_lease_months`, plus native categorical `town`,
`flat_type`, `block`, `street_name`, and `flat_model`. No target-derived or
price aggregate features are used. Train partitions are stable-sorted by
transaction year/month before fitting. CatBoost receives the five categorical
columns directly, uses `has_time=True`, and learns its categorical statistics
from the current fit rows and labels only. XGBoost receives pandas categorical
columns with category vocabularies fitted on training rows only; unknown
validation/test values become missing. Neither model uses external target
encoding. Numeric features are not scaled.

Each family has four validation configurations (2,000 maximum rounds, seed 42,
100-round early stopping). CatBoost crosses depth 6/8 with learning rate
0.03/0.05, fixing RMSE objective, MAE evaluation, and L2 leaf regularization 3.
XGBoost crosses depth 6/8 with minimum child weight 5/10, fixing learning rate
0.05, subsample and column sample 0.8, L2 regularization 1, MAE evaluation,
and native-category limits 4/64. Selection considers all eight validation
results: lowest MAE, then the 1% MAE tie band and deterministic RMSE, median
absolute error, MAPE, simplicity, serialized-size, runtime, and config ordering
rules. Test results are excluded from selection. The selected round count is
frozen from validation; that configuration is refitted on train plus validation
through 2025-12 and evaluated once on 2026-01 through 2026-09. The partial
2026-10 rows are excluded.

The local GPU run used CatBoost 1.2.10 and XGBoost 3.2.0 on an NVIDIA GeForce
RTX 3080 Ti Laptop GPU (GPU 0, 16 GiB, CUDA-enabled XGBoost build). XGBoost
3.2.0 is the newest version available for this Python 3.11 environment on the
configured package index; its supported CUDA and categorical interfaces match
the implementation. CatBoost GPU training can be nondeterministic. The local
source file remains a manually retrieved dataset and does not sync automatically.

| Validation candidate | MAE | RMSE | MAPE | Fit seconds | Serialized MiB |
|---|---:|---:|---:|---:|---:|
| CatBoost depth 6, LR 0.03 | $36,331.24 | $49,535.14 | 5.41% | 40.86 | 63.54 |
| CatBoost depth 6, LR 0.05 | $35,018.66 | $47,467.15 | 5.22% | 41.30 | 79.05 |
| CatBoost depth 8, LR 0.03 | $34,492.75 | $46,716.88 | 5.15% | 56.69 | 114.83 |
| CatBoost depth 8, LR 0.05 | **$33,524.38** | **$45,217.47** | **5.02%** | 59.87 | 147.35 |
| XGBoost depth 6, child weight 5 | $44,089.44 | $58,607.68 | 6.59% | 12.28 | 138.48 |
| XGBoost depth 6, child weight 10 | $43,565.62 | $57,343.66 | 6.54% | 11.79 | 114.96 |
| XGBoost depth 8, child weight 5 | $43,817.40 | $58,704.31 | 6.55% | 22.63 | 296.82 |
| XGBoost depth 8, child weight 10 | $43,261.07 | $56,663.10 | 6.51% | 22.36 | 173.72 |

CatBoost depth 8 at learning rate 0.05 was selected by validation MAE. Its
validation metrics were RMSE $45,217.47, MAPE 5.02%, R2 0.9509, and median
absolute error $26,456.09. It improved on the recorded validation MAE of the
comparable-sales baseline ($39,354.92), Linear Regression ($50,772.32), and
Extra Trees ($43,443.85). Those recorded benchmarks were comparison references
only; they were not rerun or used to select this model.

The final refit used 1,998 rounds on 222,067 rows through 2025-12. The test
metrics were MAE $29,490.56, RMSE $41,587.78, MAPE 4.52%, R2 0.9630, and median
absolute error $21,852.89. Mean actual price was $663,826.70 and mean predicted
price was $669,591.22. The recorded comparable baseline, Linear Regression,
and Extra Trees test MAEs were $40,932.90, $49,861.68, and $30,056.10
respectively. Their references were not re-evaluated. The comparable baseline
advances history month by month, while this learned model is frozen after
2025-12, so these figures use different update protocols.

Test MAE by town (support n): Ang Mo Kio $31,326 (674), Bedok $35,002 (1,045),
Bishan $42,240 (329), Bukit Batok $22,518 (1,118), Bukit Merah $40,579 (722),
Bukit Panjang $28,331 (619), Bukit Timah $41,946 (46), Central Area $47,231
(141), Choa Chu Kang $24,834 (820), Clementi $33,625 (392), Geylang $29,624
(504), Hougang $29,642 (988), Jurong East $25,901 (384), Jurong West $26,590
(1,170), Kallang/Whampoa $37,176 (586), Marine Parade $44,048 (98), Pasir Ris
$26,070 (610), Punggol $29,152 (1,331), Queenstown $45,475 (616), Sembawang
$26,427 (661), Sengkang $27,202 (1,391), Serangoon $31,629 (295), Tampines
$23,579 (1,630), Toa Payoh $39,073 (762), Woodlands $24,351 (1,459), and
Yishun $24,822 (1,250). By flat type: 1 ROOM $14,740 (8), 2 ROOM $15,265
(588), 3 ROOM $21,844 (4,505), 4 ROOM $28,556 (8,649), 5 ROOM $37,425
(4,613), EXECUTIVE $40,543 (1,272), and MULTI-GENERATION $88,056 (6). The
1 ROOM and MULTI-GENERATION estimates have low support.

Aggregated CatBoost model-native prediction-change importance ranked flat type,
transaction year, street name, town, and remaining lease highest in this run.
These are noncausal diagnostics and can be affected by correlated features and
category cardinality; they do not explain causal price effects. The final
model serialized to 143.99 MiB in a temporary file that was removed. Candidate
training peaked at 15,542 MiB GPU memory used; sampled peak utilization was 73%.
The selected validation fit took 59.87 seconds, final refit 82.77 seconds, and
test prediction 0.25 seconds. Total benchmark time was 365.74 seconds. XGBoost
warned that prediction from CPU-resident pandas input used a DMatrix fallback,
which may increase memory use and prediction time. CatBoost reached the
configured 2,000-round limit in all four candidates, so the 100-round early
stopping setting did not shorten those fits. These results are local research
measurements and do not establish production readiness.

For Google Colab, clone/download this repository, put the same official CSV in
`MLPricePredictorV2/data/raw/`, install `MLPricePredictorV2/requirements.txt`,
and select a CUDA runtime. From the V2 directory, run:

```powershell
python scripts/evaluate_boosted_models.py --device gpu
```

The script will validate GPU availability and fail rather than run a requested
GPU benchmark on CPU. Results can differ by GPU, library build, and CatBoost
GPU nondeterminism. Do not upload the raw CSV to Git or treat Colab output as
an approved production model.

## Matched and temporal robustness

The walk-forward comparable baseline remains unchanged: it adds each completed
evaluation month to history before predicting later months. The matched
`frozen_history_comparable` path uses a fixed prior-December history cutoff for
every prediction in an evaluation year. It does not add evaluation-year
transactions or targets to that history. The existing 12-month comparable
lookback remains relative to each target transaction month; all candidate
transactions still come from the same frozen pool. This matches the information
cutoff of a CatBoost model trained once at the same prior December.

The robustness script keeps CatBoost fixed at depth 8, learning rate 0.05, L2
regularization 3, seed 42, the existing ten-feature schema and native
categorical strategy, and exactly 1,998 rounds. Each annual model is fitted
through the preceding December and evaluated without monthly model updates. The
2026 window ends in September; the 212 partial October rows are excluded. The
2022–2024 evaluations are retrospective checks of a design selected using 2025,
not independent validation experiments. The 2025 comparison also reuses the
selection period; 2026 remains the later test window. No robustness result
retunes either method.

On the local dataset, the matched 2025 comparison used training/history through
2024-12 (25,085 predictions). CatBoost scored MAE $33,608.96, RMSE $45,241.57,
MAPE 5.03%, R2 0.9509, and median absolute error $26,426.04. The frozen
comparable scored MAE $54,982.31, RMSE $98,196.32, MAPE 7.64%, R2 0.7685, and
median absolute error $30,000. CatBoost's MAE difference was -$21,373.35
(38.87% improvement relative to the comparable). Mean actual price was
$652,521.60; mean CatBoost prediction was $626,752.19 and mean comparable
prediction was $612,665.03.

The matched 2026 comparison used training/history through 2025-12 (19,641
predictions). CatBoost scored MAE $29,490.56, RMSE $41,587.78, MAPE 4.52%, R2
0.9630, and median absolute error $21,852.89. The frozen comparable scored MAE
$48,612.05, RMSE $87,926.83, MAPE 6.86%, R2 0.8345, and median absolute error
$28,500. CatBoost's MAE difference was -$19,121.50 (39.33% improvement).
Mean actual price was $663,826.70; mean CatBoost prediction was $669,591.22 and
mean comparable prediction was $653,524.91. CatBoost won MAE, RMSE, MAPE,
median absolute error, and R2 in both matched comparisons.

### Expanding-window annual backtests

The same frozen CatBoost configuration and comparable settings were evaluated
with each preceding December as the fixed cutoff. All prices are SGD.

| Evaluation year | Train/history through | CatBoost MAE | CatBoost RMSE | MAPE | R2 | Median AE |
|---|---|---:|---:|---:|---:|---:|
| 2022 | 2021-12 | $42,085.23 | $52,197.96 | 7.57% | 0.9060 | $36,404.45 |
| 2023 | 2022-12 | $30,250.84 | $40,785.62 | 5.19% | 0.9449 | $23,766.63 |
| 2024 | 2023-12 | $37,791.19 | $51,154.63 | 5.93% | 0.9264 | $29,491.80 |
| 2025 | 2024-12 | $33,608.96 | $45,241.57 | 5.03% | 0.9509 | $26,426.04 |

| Evaluation year | Frozen comparable MAE | RMSE | MAPE | R2 | Median AE | CatBoost MAE difference | Relative improvement |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2022 | $55,946.07 | $84,951.31 | 9.44% | 0.7511 | $38,500 | -$13,860.84 | 24.78% |
| 2023 | $46,516.08 | $78,342.92 | 7.47% | 0.7969 | $27,500 | -$16,265.25 | 34.97% |
| 2024 | $58,013.53 | $96,010.10 | 8.59% | 0.7408 | $35,000 | -$20,222.34 | 34.86% |
| 2025 | $54,982.31 | $98,196.32 | 7.64% | 0.7685 | $30,000 | -$21,373.35 | 38.87% |

CatBoost had lower MAE in all four annual windows and also won RMSE, MAPE,
median absolute error, and R2 in each. The 2022–2024 measurements are useful
for temporal robustness but are retrospective because the configuration was
chosen after 2025 validation results were observed. They do not establish
independent historical model selection.

### GPU repeatability, group errors, and monthly drift

Three same-seed GPU fits were evaluated on the same 2025 rows. The first was
the 2025 annual fit; two identical fits were run afterward. No repeat was
selected. Repeat MAEs were $33,608.96, $33,624.01, and $33,608.96; corresponding
RMSEs were $45,241.57, $45,272.44, and $45,241.57. Their MAPEs were all 5.03%
and R2 values were 0.9509, 0.9508, and 0.9509. Mean MAE was $33,613.98 with
standard deviation $7.09 and range $15.05. Mean RMSE was $45,251.86 with
standard deviation $14.56; mean MAPE was 5.0332% with standard deviation
0.0011 percentage points. Across all pairwise prediction comparisons, mean
absolute difference was $341.90 and maximum absolute difference was $6,552.67.
Aggregate metric variation was small in this run, though individual prediction
differences were larger than the MAE range.

The script reports full MAE and support tables for every town and flat type in
each year. Among groups with at least 30 observations, Bukit Timah, Bishan, and
Central Area each appeared in the three highest town MAEs in three of the four
years. EXECUTIVE, 5 ROOM, and 4 ROOM were among the three highest flat-type
MAEs in all four years; 2 ROOM had the lowest supported flat-type MAE in all
four. The most frequent lowest-error towns were Clementi or Choa Chu Kang in
2022, 2023, and 2025, and Bukit Batok in 2024. These are descriptive group
comparisons, not explanations of price differences.

The existing support marker is fewer than 30 rows. 1 ROOM had only 5–11
transactions per year and MULTI-GENERATION had 3–12, so their group errors are
noisy and should not be overinterpreted. Complete group results, including
these rows, are printed by `scripts/evaluate_model_robustness.py`.

Monthly MAE increased across most of the year in 2022 (January $29,616 to
December $46,746; slope +$1,761/month), 2023 ($27,284 to $31,364; +$270/month),
and 2024 ($23,737 to $54,035; +$2,961/month). 2025 was broadly flat to slightly
lower ($30,804 to $30,767; -$419/month). For January–September 2026, MAE rose
from $25,210 to $35,069 (+$994/month). Year-level mean prediction bias
(predicted minus actual) was -$38,872 in 2022, -$22,970 in 2023, -$32,303 in
2024, -$25,769 in 2025, and +$5,765 in 2026. These trends are descriptive;
they do not establish a cause, and the model was intentionally not updated
within a year.

The GPU run used device 0 on the NVIDIA GeForce RTX 3080 Ti Laptop GPU and
passed the existing CatBoost/XGBoost GPU preflight. CatBoost reported that GPU
MAE evaluation used its default metric period of five. A direct run exited
successfully in 602.52 seconds. A second run printed its complete report in
345.93 seconds, although the PowerShell output-capture wrapper returned status
1 without a Python traceback. Runtime varied between invocations. Exact
per-year and repeat-fit times are printed by the script. That evaluation stage
does not persist its candidate models or processed datasets.

The matched comparisons and four annual MAE wins supported the follow-on
uncertainty and persistence research stages documented below. This does not
establish production readiness or justify application integration. Temporal
drift, recurrent group error, low-support groups, GPU variation, and the
retrospective nature of earlier backtests still matter to any uncertainty range.

## CatBoost uncertainty ranges

`scripts/evaluate_uncertainty.py` evaluates symmetric conformal intervals around
the frozen CatBoost point predictions. It does not tune the point model. For
each nominal coverage `p`, the radius is the 1-indexed absolute-residual order
statistic at `ceil((n + 1) * p)`, with an infinite interval if that rank exceeds
the available calibration count. This is the finite-sample split-conformal
index; ordinary interpolated percentiles are not used.

Annual CatBoost fits produce genuinely out-of-sample residuals for 2021–2025.
The 2021 model fits through 2020 and supplies calibration evidence for 2022.
For each historical interval evaluation year (2022–2025), calibration is frozen
from earlier residual years only; that evaluation year's labels are used only
after its intervals are formed. The five compared strategies are all prior
years, the most recent two years, the most recent year, town-specific
calibration, and flat-type-specific calibration. Group strategies fall back to
the global quantile from the same prior-year pool when that group has fewer
than 30 calibration residuals. Coverage is reported for 80%, 90%, and 95%.

Selection used only 2022–2025 results. The rule first minimizes the worst
annual undercoverage over all three nominal levels, then pooled absolute
coverage error, row-weighted interval width, and a fixed simplicity order. The
selected strategy was town-specific calibration over all prior out-of-sample
years because it ranked best under that coverage-first ordering. Its historical
results were:

| Evaluation year | 90% empirical coverage | Mean interval width | Median interval width | Rows |
|---|---:|---:|---:|---:|
| 2022 | 89.61% | $162,021.64 | $163,855.59 | 26,720 |
| 2023 | 95.17% | $161,756.19 | $160,273.97 | 25,754 |
| 2024 | 89.82% | $152,994.78 | $151,264.97 | 27,832 |
| 2025 | 92.98% | $155,052.23 | $152,166.31 | 25,085 |

The row-weighted pooled historical results were 84.71% coverage and $124,425.00
mean width at 80%; 91.83% and $157,914.08 at 90%; and 95.65% and $192,965.43
at 95%. The predeclared 90% gate passed: pooled coverage was at least 90%, and
each annual evaluation was at least 85%. Prior-residual calibration counts
were 29,087 rows for 2022, 55,807 for 2023, 81,561 for 2024, and 109,393 for
2025. The final 2026 calibration pool includes all five residual years,
2021–2025, or 134,478 rows.

Only after this selection was frozen, the final model was fit through 2025-12
and evaluated on 19,641 transactions from 2026-01 through 2026-09. The selected
method achieved 88.46%
coverage with $116,730.90 mean / $114,631.23 median width at 80%; 94.24% with
$152,558.85 / $149,045.60 at 90%; and 97.13% with $189,989.70 / $176,504.59 at
95%. Each interval is symmetric around the point prediction. The 2026 results
did not select or adjust the method.

The 2026 90% town coverage ranged from 88.96% (Queenstown, n=616) to 97.40%
(Woodlands, n=1,459); Bukit Merah (89.06%, n=722) and Marine Parade (89.80%,
n=98) were also below nominal coverage. Flat-type coverage was 88.92% for
5 ROOM (n=4,613) and
84.91% for EXECUTIVE (n=1,272); MULTI-GENERATION was 50% at n=6, which is too
small for a reliable group conclusion. By actual-price quartile, the highest
quartile covered 86.07% (n=4,911), compared with 97.94% in the lowest quartile.
Actual prices were used for that post-prediction diagnostic only, never for
calibration or selection. Exchangeability and stable future error distributions
are not guaranteed; town-specific calibration did not remove all flat-type or
high-price undercoverage. The final GPU run used CatBoost 1.2.10 and an NVIDIA
GeForce RTX 3080 Ti Laptop GPU; total runtime was 383.09 seconds. The run also
reported Python 3.11.9, pandas 3.0.6, and NumPy 2.4.6.

The 90% method passes the historical research gate and exceeds 90% pooled
coverage in this single later test, but the high-price and flat-type results
show meaningful subgroup undercoverage. Keep the interval as a research
candidate; it is not yet an approved production valuation range. Validate a
predeclared subgroup-calibration approach on a later chronological holdout.

## Persisted local valuation bundle

`scripts/build_valuation_bundle.py --device gpu` builds the immutable local
research bundle `hdb-catboost-2025-12-v1` under `artifacts/`. It uses the frozen
CatBoost feature contract and 1,998 rounds, fitted on 222,067 rows through
2025-12. Calibration uses only 134,478 out-of-sample absolute residuals from
2021–2025. Rows and targets from 2026 are excluded from model fitting and
calibration. GPU preflight is mandatory by default; `--device cpu` is an
explicit development option. An existing version is never overwritten.

The bundle contains the native `model.cbm`, compact global and eligible-town
thresholds in `uncertainty.json`, provenance and feature/version metadata in
`metadata.json`, and a SHA-256 `manifest.json` covering the other three files.
The loader verifies hashes, metadata, exact ordered feature names, cutoff,
model feature names, and supported coverage levels before exposing prediction.
Prediction defaults to 90% and accepts 80%, 90%, or 95%. It returns a point
estimate and symmetric lower/upper bounds. Town lookup trims whitespace and
uppercases the town; unknown or ineligible towns use the global threshold.
Groups need at least 30 calibration residuals for town-specific thresholds.

The build round-tripped eight pre-2026 feature rows through the fitted and
reloaded CBM at `rtol=1e-12`, `atol=1e-8`; stored thresholds matched exactly.
The built global conformal radii (half-widths) are:

| Nominal coverage | Global half-width | Global full width |
|---|---:|---:|
| 80% | $57,801 | $115,602 |
| 90% | $75,689 | $151,379 |
| 95% | $94,409 | $188,817 |

Eligible town-specific 90% calibration radii and supports are:

| Town | Calibration rows | Half-width | Full width |
|---|---:|---:|---:|
| Ang Mo Kio | 5,157 | $81,957 | $163,913 |
| Bedok | 6,812 | $74,976 | $149,953 |
| Bishan | 2,173 | $108,164 | $216,328 |
| Bukit Batok | 6,084 | $62,484 | $124,968 |
| Bukit Merah | 5,093 | $86,708 | $173,415 |
| Bukit Panjang | 4,432 | $75,462 | $150,925 |
| Bukit Timah | 306 | $126,890 | $253,779 |
| Central Area | 1,020 | $122,516 | $245,032 |
| Choa Chu Kang | 6,422 | $66,944 | $133,888 |
| Clementi | 2,953 | $77,793 | $155,586 |
| Geylang | 3,366 | $77,725 | $155,450 |
| Hougang | 6,990 | $78,417 | $156,833 |
| Jurong East | 2,565 | $67,612 | $135,224 |
| Jurong West | 8,268 | $64,041 | $128,081 |
| Kallang/Whampoa | 4,309 | $95,586 | $191,173 |
| Marine Parade | 846 | $83,790 | $167,579 |
| Pasir Ris | 3,709 | $79,538 | $159,076 |
| Punggol | 10,396 | $63,188 | $126,375 |
| Queenstown | 3,643 | $94,405 | $188,809 |
| Sembawang | 4,514 | $71,347 | $142,693 |
| Sengkang | 11,026 | $76,204 | $152,407 |
| Serangoon | 2,209 | $92,039 | $184,079 |
| Tampines | 9,369 | $72,140 | $144,280 |
| Toa Payoh | 4,353 | $101,528 | $203,056 |
| Woodlands | 9,353 | $74,100 | $148,200 |
| Yishun | 9,110 | $67,726 | $135,452 |

Across the 26 eligible towns, 90% half-widths had a minimum of $62,484,
median $77,759, mean $82,434, and maximum $126,890. Corresponding full-widths
were minimum $124,968, median $155,518, mean $164,868, and maximum $253,779.
Bukit Batok had the narrowest town interval; Bukit Timah had the widest. These
are calibration widths, not guaranteed individual coverage. Historical and
2026 diagnostics still showed undercoverage for some groups, especially
Executive flats and the highest actual-price quartile.

The measured build used Python 3.11.9, CatBoost 1.2.10, pandas 3.0.6, NumPy
2.4.6, and an NVIDIA GeForce RTX 3080 Ti Laptop GPU. The model file was
148,656,560 bytes (141.77 MiB); the complete bundle was 148,665,872 bytes
(141.78 MiB). Build runtime was 249.92 seconds. These are local measurements;
rebuilds may vary with library/device versions and CatBoost GPU behavior.
`artifacts/` is ignored by Git: the local bundle is not committed, uploaded, or
automatically synchronized. Rebuilding this immutable version fails if it
already exists. Version changes require an explicitly reviewed new semantic
version and compatible loader policy.

This bundle is a research candidate, not an approved or authoritative
valuation. It is not integrated into SG Homie and does not establish
production readiness. The next recommended step is a narrow local FastAPI
inference service that loads this verified artifact without retraining.

The legacy `MLPricePredictor/` experiments contain target leakage, including
features derived from the transaction price being predicted. Their model
metrics and generated outputs therefore must not be trusted as evidence of
future performance or used as production evidence. The V2 linear models are
also research candidates only and do not establish production readiness.

## Intended future purpose

The eventual purpose is to evaluate an HDB resale price estimate using only
information available at prediction time, with chronological validation,
appropriate baseline comparisons, and documented provenance. Historical
baselines, linear and Ridge models, nonlinear tree benchmarks, a research
uncertainty evaluation, and a local research bundle are implemented. A narrow
FastAPI inference interface remains future work.

## Setup and commands

From this directory, install dependencies and run:

```powershell
python -m pip install -r requirements.txt
python scripts/profile_data.py
python scripts/prepare_data.py
python scripts/evaluate_baselines.py
python scripts/evaluate_linear_models.py
python scripts/evaluate_tree_models.py
python scripts/evaluate_boosted_models.py --device gpu
python scripts/evaluate_model_robustness.py --device gpu
python scripts/evaluate_uncertainty.py --device gpu
python scripts/build_valuation_bundle.py --device gpu
python -m pytest
```

The profiler, preparation script, and baseline evaluation script load the raw
CSV without modifying it. Preparation reports partition shapes/date ranges and
quality screening without writing processed artifacts. Evaluation scripts
print metrics and diagnostics without persisting candidate models. The bundle
builder is the exception: it writes one immutable version under ignored
`artifacts/` after training, calibration, integrity, and round-trip checks.
