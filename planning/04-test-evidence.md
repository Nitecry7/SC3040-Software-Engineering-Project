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

## S1 step 2: migration (passing run)

**Source:** GitHub Actions run of `tests.yml` on push of commit `5ef7cf7` to `assessment/ncs-opspilot`, 16 November 2026. Screenshot of the run summary supplied by the repository owner.

| Job | Result | Duration |
| --- | --- | --- |
| `application` | Success | 36s |
| `valuation` | Success | 42s |
| `database` | Success | 2m 27s |

Commit `5ef7cf7` contains the migration, the test file with 40 planned assertions, and the evidence and review documents.

**What this shows**

- The migration applied on top of the 24 earlier migrations in a disposable database.
- The `database` job passed. The same job exited with code 1 on the previous run because of failed assertions, so a success here means no assertion failed in any of the four pgTAP files.
- The Node suite, lint, typecheck, build and valuation tests also passed in CI on Node 22.

**What this does not show**

- The per-assertion output of this run was not reviewed line by line. Only the job summary was seen. The TAP artifact attached to the run holds the detail.
- Nothing about the hosted database. CI uses synthetic rows only, and the migration has not been applied to any hosted project.

**Status:** S1 is implemented and CI-verified in the repository. Not deployed.

**How the two S1 runs relate.** The failing run and the passing run were separate CI runs. Each started its own Supabase stack and created its own throwaway database, applied the migrations present in that commit, ran the tests and dropped the database. They did not share a database. The comparison is between two fresh databases that differ by the one new migration and two added assertions.

## L0: home page explicit column list

**Local, run by the implementation agent on 16 November 2026 and reported to the planner. Not re-run by the reviewer.**

| Check | Result |
| --- | --- |
| Focused test before the change | Failed: "select must not request every column" |
| Focused test after the change | Passed |
| Full Node suite | 440 passed, 0 failed (439 baseline plus the new test) |
| Lint | 0 errors, the same 2 existing warnings |
| Typecheck | Passed, after the component state type was narrowed |
| Build | Passed |

**CI:** the repository owner reports that GitHub run "Repository tests" #32, on the L0 commit `1133f92`, passed. The planner did not see the run output.

**Status:** implemented and CI-verified in the repository. Not deployed.

## S2: public listing column contract

**Source:** reported by the repository owner on 16 November 2026. GitHub run "Repository tests" #33 on commit `ed2921c` passed all three jobs: `application`, `database` and `valuation`. The planner did not see the run output or the TAP artifact.

Commit `ed2921c` contains the migration, the pgTAP file with 29 planned assertions and the slice handoff. The planner confirmed the commit contents from the local repository.

**What this shows**

- The migration applied on top of the 25 earlier migrations in a fresh disposable CI database.
- The `database` job fails when any pgTAP assertion fails, so a passing job means none of the 29 new assertions failed, and none of the 168 assertions in the other four files failed.
- In that database, after the migration: the anonymous role had no table-wide read on the listings table, its readable columns equalled the allow-list, the three anonymous query shapes still returned the approved row, and private columns were refused.
- The two points that could not be checked before the run held in CI: anonymous queries still work although the row policy refers to a column the anonymous role can no longer read, and revoking from the anonymous role was enough to remove its table-wide read.

**What this does not show**

- No failing run was recorded for S2. Tests and migration were pushed together by design, so there is no red-then-green pair as there is for S1.
- Nothing about the hosted database, where the grant state may differ from a fresh CI database.
- Realtime behaviour for visitors who are not signed in.
- Any change for signed-in accounts. They can still read seller contact and address fields of approved listings.

**Status:** S2 is implemented and CI-verified in the repository. Not deployed. The hosted site is unchanged.

## S3: Level 1 service monitoring runner

**Local only, 16 November 2026. No request was made to any real service.**

| Check | Result | Run by |
| --- | --- | --- |
| Focused test before the modules existed | Failed: module not found | Implementation agent |
| Focused test, `service-monitor.test.mjs` | 17 passed, 0 failed | Implementation agent, then re-run by the reviewer |
| Fixture `render-not-ready` | Table printed, model service `failed` with `NOT_READY`, exit code 1 | Reviewer |
| Fixture `nothing-configured` | Three targets `unknown` with `NOT_CONFIGURED`, exit code 0 | Reviewer |
| Full Node suite | 457 passed, 0 failed (440 plus 17) | Implementation agent |
| Lint | 0 errors, the same 2 existing warnings | Implementation agent |
| Typecheck and build | Passed | Implementation agent |

After the classification change for the model service's 502, 503 and 504 responses:

| Check | Result | Run by |
| --- | --- | --- |
| Focused test with the new cases, before the change | 22 tests: 17 passed, 5 failed | Implementation agent |
| Focused test after the change | 22 passed, 0 failed | Implementation agent, then re-run by the reviewer |
| Fixture `render-waking` | Model service `unknown` with `UPSTREAM_UNAVAILABLE`, exit code 0 | Reviewer |
| Full Node suite | 462 passed, 0 failed | Reviewer |
| Lint | 0 errors, the same 2 existing warnings | Reviewer |

Typecheck and build were not re-run after this change. It touched only `.mjs` and JSON files, which neither covers.

**Not verified:** the GitHub Actions workflow has not run. No live check has been made. The schedule is not active.

**Status:** implemented and locally tested. Not pushed, not run in CI, not run against hosted services.

## S4: sign-up password experience

**Local only, 16 November 2026. Component tests in a virtual harness, not a browser.**

| Check | Result | Run by |
| --- | --- | --- |
| Focused tests before the implementation | 23 tests: 1 passed, 22 failed | Implementation agent |
| Focused tests after the implementation | 23 passed, 0 failed | Implementation agent, then re-run by the reviewer |
| Full Node suite | 472 passed, 0 failed (462 plus 10) | Implementation agent, then re-run by the reviewer |
| Lint | 0 errors, the same 2 existing warnings | Both |
| Typecheck | Passed | Both |
| Build | Passed | Implementation agent |

In the failing run, the existing sign-up tests failed because their helpers now fill a confirm field that did not exist yet, and the new tests failed on missing behaviour.

**Not verified:** behaviour in a real browser, with a keyboard, or with a screen reader. Not run in CI. Not deployed.

**Status:** implemented and locally tested.

## S1 hosted data check (not yet run)

A read-only query for the repository owner to run on the hosted database before any deployment decision. It has not been run.

```sql
select
  count(*) filter (where hdb_verified)                                   as verified_total,
  count(*) filter (where hdb_verified and (postal_code is null
        or block_number is null or street_name is null))                 as missing_address,
  count(*) filter (where hdb_verified and (latitude is null
        or longitude is null))                                           as missing_coordinates,
  count(*) filter (where hdb_verified and town is not null
        and town <> location)                                            as town_differs_from_location,
  count(*) filter (where hdb_verified and location_verified_at is null)  as missing_verified_time
from public.properties;
```

**Limits of this check**

- It detects a few obvious inconsistencies in stored rows. It is not proof that verified listings are consistent.
- It cannot tell whether a stored address, town or coordinate is the one the original verification returned. No record of past verifications is kept beyond their short expiry.
- Zero counts mean only that these particular patterns were not found.
- The migration prevents new inconsistencies through signed-in writes. It does not repair existing rows.

## A1. Password policy and strength estimate (16 November 2026, phase 2)

Status: implemented in the repository, verified locally. Not committed at the time of writing, not run in CI, not deployed.

| Check | Run by | Result |
| --- | --- | --- |
| Red run, new test files before the modules existed | Sonnet | 4 files failed at import (module not found) |
| Red run, modal tests before the modal change | Sonnet | 55 tests, 48 pass, 7 fail (the new modal tests) |
| Full Node suite after first implementation | Sonnet | 504 tests, 503 pass, 1 fail (an existing mismatch test, see review findings) |
| Red run for the review fixes | Sonnet | 3 new tests failed before the change |
| Focused: policy, meter, both modal files | Sonnet | 57 of 57 pass |
| Full Node suite (`npm test`) | Planner | 506 of 506 pass (472 baseline plus 34) |
| `npm run lint` | Planner | 0 errors, the same 2 existing warnings |
| `npx tsc --noEmit -p tsconfig.app.json` | Planner | exit 0 |
| `npm run build` | Sonnet only | passed |

Browser check, by the planner, with Playwright against a local dev server at `localhost:5173` (unauthenticated, the form was never submitted, no account or email was created):

- Empty password: the four rules show as "not met", the status region is empty, no bar.
- `abc`: Weak, one red segment, only the lowercase rule met.
- `Password1`: all four rules met, rated Weak.
- `Zebra4Lamp` and the 8-character `Kq7mWx2p`: Fair, two amber segments.
- `Cobalt-Heron-Quilt-47`: Strong, three green segments.
- Tab order from the password field: show/hide button, confirm password, Register, mode switch.
- Space on the show/hide button reveals both fields and does not submit or close the dialog.
- Label and checklist text are `rgb(55, 65, 81)` on white.
- At 375 px wide the page has no horizontal scroll and the dialog is 343 px wide.

Limits: no screen reader was used, so the live-region announcement is unverified. Contrast was read from computed colours, not measured with an audit tool. The hosted Auth setting was reported by the owner and not observed.

## S5. Forgot and reset password (16 November 2026, phase 2)

Status: implemented in the repository, verified locally. Not committed at the time of writing, not run in CI, not deployed. No reset email has been requested and no real recovery link has been opened.

| Check | Run by | Result |
| --- | --- | --- |
| Red run, new tests before any source file | Sonnet | 99 tests, 52 pass, 47 fail (the new tests) |
| Red run for the review fixes | Sonnet | 39 tests, 37 pass, 2 fail (the two new behaviours) |
| Focused auth and recovery files | Sonnet | 104 of 104 pass |
| Full Node suite (`npm test`) | Planner | 559 of 559 pass (506 plus 53) |
| `npm run lint` | Planner | 0 errors, the same 2 existing warnings |
| `npx tsc --noEmit -p tsconfig.app.json` | Planner | exit 0 |
| `npm run build` | Sonnet only | passed |

One test, for the helper that tells a fresh redirect from a restored state, was written together with its implementation and has no red run.

Browser check, by the planner, with Playwright against a local dev server, signed out, using hand-built link fragments. No request to the Auth recover, user, sign-up or token endpoints was observed during the first pass.

- `/reset-password` with an expired-link error: "This link has expired", with a button that opens the reset request view in the sign-in dialog.
- `/reset-password` with another auth error: "This link is not valid".
- `/reset-password` with no link: instructions only, no password field.
- The same error fragment on the home page: no redirect and nothing stored.
- A recovery marker with no session: "This link is not valid", no password field.
- Leaving the reset page by a navigation link clears the stored state for both the error and the recovery marker. Going back shows the no-link page.
- "Forgot password?" appears in sign-in mode and not in sign-up mode. "Back to sign in" returns to the sign-in form.
- At 375 px wide the expired page has no horizontal scroll.

Not verified in a browser: the new-password form, the success page, the redirect of a real recovery link that lands on another path, the neutral confirmation after a real request, and the profile overlay during recovery. Each needs a real recovery session. They are covered by harness tests only. The route wiring and the redirect component are checked by source pattern, plus the browser checks above.

Planner test-script errors, corrected in a second pass: a hash-only navigation did not reload the page, and a link lookup missed, so two first-pass readings were artefacts and were discarded.
