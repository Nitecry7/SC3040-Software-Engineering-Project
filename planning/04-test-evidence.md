# Test evidence

Results that were actually observed, with their source. Predictions and unverified behaviour are labelled as such.

## Baseline, before any change

Run locally on 16 November 2026 at `1986c1f`. See `00-baseline.md`.

| Check | Result |
| --- | --- |
| Full Node suite | 439 passed, 0 failed |
| Lint | 0 errors, 2 existing warnings |
| Typecheck | Passed |
| Build | Passed |

## S1 step 1: tests only (expected failing run)

**Source:** GitHub Actions `database` job, output supplied by the repository owner on 16 November 2026. The job applies all 24 repository migrations to a disposable database and runs every pgTAP file.

| File | Planned | Passed | Failed |
| --- | --- | --- | --- |
| `access-control.test.sql` | 47 | 47 | 0 |
| `hdb-verification-integrity.test.sql` (new) | 38 | 31 | 7 |
| `monitoring.sql` | 65 | 65 | 0 |
| `synthetic_canary.sql` | 16 | 16 | 0 |

The job exited with code 1, as intended for this step.

The seven failing assertions in the new file:

| Label | Reported |
| --- | --- |
| HV-01a | caught: no exception; wanted: P0001 |
| HV-01b | caught: no exception; wanted: P0001 |
| HV-01c | caught: no exception; wanted: P0001 |
| HV-01d | caught: no exception; wanted: P0001 |
| HV-04c | have: `Client supplied text`; want: `Block 11 ALPHA ROAD` |
| HV-06c | have: `22 BETA AVENUE 1`; want: `Block 22 BETA AVENUE` |
| HV-08b | failed |

**Assessment by the planning model**

- The seven failures are exactly the seven predicted before the run, by the implementation agent and independently in the review.
- The file ran to completion. There was no syntax or fixture error, and the fixture insert passed.
- All 128 existing assertions still passed.
- This is a valid failing run for the intended reasons. It shows the new invariant is not yet enforced. It says nothing about hosted data.

## S1 step 2: migration

Not yet run.
