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

## A1: Password policy and strength estimate

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

## S5: Forgot and reset password

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

### Update: A1 and S5 committed, CI and hosted round trip (owner-reported)

Reported by the repository owner. The planner did not observe these runs.

- The A1 and S5 commit was pushed to `assessment/ncs-opspilot` and the GitHub CI run passed.
- S5 end to end, against the hosted Supabase project with the frontend on localhost: a real recovery email arrived, its link opened the reset form, the password was updated, the success page showed, and sign-in with the new password succeeded.

This covers the items listed above as not verified in a browser for the form, the success page and the confirmation after a real request. Still not exercised: an expired real link, a link that falls back to the site URL, and the profile overlay for an account that still needs profile setup. The frontend changes are not deployed to the hosted site.

## S6: Authenticated change password

Status: implemented in the repository, verified locally in the Node suite only. Not committed at the time of writing, not run in CI, not deployed, not seen in a browser.

| Check | Run by | Result |
| --- | --- | --- |
| Red run, new and changed tests before implementation | Sonnet | 39 tests, 20 pass, 19 fail |
| Focused: change-password, reset-password, profile-workflows, auth-recovery, both modal files | Sonnet | 95 of 95 pass |
| Full Node suite after implementation | Sonnet | 578 tests, 575 pass, 3 fail (existing Profile sign-out tests, harness import; see review findings) |
| Full Node suite after the one-line harness entry (`npm test`) | Planner | 578 of 578 pass (559 plus 19) |
| `npm run lint` | Planner | 0 errors, the same 2 existing warnings |
| `npx tsc --noEmit -p tsconfig.app.json` | Planner | exit 0 |
| `npm run build` | Sonnet only | passed |

The change from X to Y and back to X is covered by a test against a stub that refuses only the current password. It has not been run against hosted Supabase.

No browser check was made. The Profile page requires a signed-in session, and no authenticated browser session was used. Layout, focus order and the real Supabase error shapes for this form are unverified.

Statements about server behaviour (recovery sessions exempt from the current-password requirement, other sessions signed out on a password change, the 24-hour rule for secure password change, `current_password` ignored when the setting is off) come from Sonnet's reading of the upstream Supabase Auth source through a summarising fetch tool. They were not checked against the hosted project.

### Update: Phase A committed and hosted Auth checks (owner-observed)

Phase A is committed at `1f8904f`. The results below were observed by the repository owner by hand, against hosted Supabase Auth, with a synthetic account. They are not Playwright runs and the planner did not observe them.

| Check | Result (owner-observed) |
| --- | --- |
| Sign-up password guidance, confirmation and show or hide | Work |
| Forgot password | A real recovery email was sent |
| Reset password | The password was changed |
| Sign-in with the new password | Works |
| Change password on the Profile page | Works |
| Current-password and new-password validation | Behave correctly |

Hosted settings after these checks, owner-reported: "Require current password when updating" is on, "Secure password change" is off, and the policy of eight characters with lowercase, uppercase and a digit is unchanged.

Not covered by this report: which individual error messages were seen, an expired real link, and behaviour on the deployed site. The frontend is still not deployed.

## Phase B: Chatbot synthetic check

### Original observed failure

On the hosted Admin Monitoring dashboard, the Chatbot Synthetic Check showed Failed, result detail "AUTH FAILURE", duration 19 ms, provider and model unavailable, evidence "Request reached the Edge Function" (owner screenshot, run at 12:38 am SGT on 17 November 2026).

### Hosted evidence supplied by the owner (screenshots)

| Evidence | What it shows |
| --- | --- |
| Chatbot function settings | "Verify JWT with legacy secret" is off, matching `config.toml` |
| `admin-monitoring` logs, 00:35 to 00:40 | Two `synthetic_canary` events for the chatbot with `AUTH_FAILURE`, about 19 and 21 ms |
| `admin-monitoring` overview | 9 invocations at 12:38 am, none counted as errors |
| Chatbot overview | 0 invocations in a 15-minute window whose capture time is not known; deployed 16 days earlier |

### Planner's reading of the repository

- `admin-monitoring` reports `AUTH_FAILURE` only when the chatbot URL answers 401 or 403.
- The repository's chatbot code answers a wrong credential on this route with 404. Nothing in the function, its imports or the shared modules returns 401 or 403 before or inside that branch.
- The evidence flag was set to true for every non-OK response. The dashboard's "Request reached the Edge Function" was therefore not evidence.

### Root cause: not confirmed

The Verify JWT setting is ruled out. Open alternatives:

1. The request was rejected before the chatbot function ran, for a reason connected to the credential sent as the bearer.
2. The deployed chatbot or `admin-monitoring` code differs from the repository.

Still needed from hosted, read-only: the chatbot function's own log for the failed run, the deployed source of the two relevant code blocks, the deployed versions and dates, the state of the project's API key types, and whether the valuation check passes.

### B1: Evidence flag and route tests

Status: implemented in the repository, verified locally in the Node suite only. Not committed at the time of writing, not run in CI, not deployed. The hosted check still fails; this slice does not change its authorization.

| Check | Run by | Result |
| --- | --- | --- |
| Red run, focused files, new tests before implementation | Sonnet | 67 tests, 61 pass, 6 fail (five `edge_reached` assertions and the dashboard wording) |
| Focused files after implementation | Sonnet | 67 of 67 pass |
| Full Node suite (`npm test`) | Planner | 597 of 597 pass (578 plus 19) |
| `npm run lint` | Planner | 0 errors, the same 2 existing warnings |
| `npx tsc --noEmit -p tsconfig.app.json` | Planner | exit 0 |
| `npm run build` | Planner | passed |
| `git diff --check` | Planner | exit 0 |

The seven route tests for the chatbot function passed before any code change. They record the current authorization of the route; they did not find a defect in it.

All of these use a stubbed `fetch` and a stubbed provider. They show nothing about hosted behaviour. The validity of the stored rows against the table's constraints was checked by reading the migration, not by running it. The dashboard wording was checked in the component harness, not in a browser.

### Update: B1 committed, further hosted evidence (owner-reported)

B1 is committed at `247fa6b`.

Reported by the owner from the hosted dashboard. The planner did not observe these.

| Item | Owner-reported |
| --- | --- |
| Chatbot function logs and invocations around the failed checks | No matching invocation or execution entry |
| Deployed versions | `chatbot` version 42 and `admin-monitoring` version 8, both deployed 31 October 2026 |
| Deployed authorization blocks | Match the repository's original implementation |
| Chatbot Verify JWT | Off |
| Legacy `anon` and `service_role` keys | Enabled. Newer publishable and secret keys also exist. |
| Valuation synthetic check | Passes |
| Chatbot synthetic check | Still `AUTH_FAILURE` |

Planner's checks in the repository:

- Since the commit of 31 October that added the synthetic checks, the only change under the functions directory is the B1 edit to `admin-monitoring`.
- The official Supabase pages read on 17 November 2026 (function authorization headers, securing functions, the 401 troubleshooting page, migrating to new API keys) describe a platform 401 only for the built-in JWT check when it is enabled. They do not describe a rejection with that check off, and say nothing specific about one function calling another with a legacy service-role key.

### Root cause: still not confirmed

What the evidence supports: the request was answered with 401 or 403 before the chatbot function ran, while a request from the same function to the valuation function with an administrator's session token succeeded. What it does not establish: why. The legacy service-role key is a supported credential and is not shown to be invalid. The two requests differ in the bearer, the target function and its Verify JWT setting, and one custom header.

### B2: Synthetic check authorization

Status: implemented in the repository, verified locally in the Node suite only. Not committed at the time of writing, not run in CI, not deployed. The hosted check has not been rerun and still fails as far as is known.

| Check | Run by | Result |
| --- | --- | --- |
| Red run, the two changed test files before implementation | Sonnet | 54 tests, 40 pass, 14 fail |
| Focused files after implementation | Sonnet | 92 of 92 pass |
| Full Node suite (`npm test`) | Planner | 609 of 609 pass (597 plus 12 net) |
| `npm run lint` | Planner | 0 errors, the same 2 existing warnings |
| `npx tsc --noEmit -p tsconfig.app.json` | Planner | exit 0 |
| `npm run build` | Planner | passed |
| `git diff --check` | Planner | exit 0 |

Five of the denial tests (rejected bearer, non-administrator, profile read failure, anonymous user, expired token) already returned 404 under the old rule, so they passed in the red run. They pin the result, and the ordering test and the administrator success test are what show the new rule is in force.

Not verified:

- Hosted behaviour. No hosted or provider call was made. Whether the check passes after deployment is unknown.
- The Edge Function code is not type-checked by the frontend TypeScript run, and Deno is not installed locally. The functions were exercised only through the Node test harness.
- Browser preflight was checked at the handler level only.

### Update: B2 committed, CI, deployed, one hosted check (owner-reported)

B2 is committed at `450d02b`. The owner reports that GitHub CI passed on its second attempt; the reason for the first attempt's failure is not recorded here. The owner deployed `chatbot` and `admin-monitoring` and ran the Chatbot Synthetic Check once, at about 2:20 am SGT on 17 November 2026. The planner saw the screenshots and did not run or observe the check.

| Observation (owner screenshots) | Before B2 | After B2 |
| --- | --- | --- |
| Dashboard result | Failed, `AUTH_FAILURE`, 19 ms | Failed, `CANARY_VALIDATION_FAILURE`, 4.2 s |
| Chatbot function invocation | None recorded | One POST, HTTP 200 |
| Chatbot function log | Nothing | One `synthetic_chatbot_canary` event |
| Provider and model on the dashboard | Unavailable | OpenRouter, `openrouter/free` |
| Dashboard evidence line | "Request reached the Edge Function" (unproven at that time) | "Request reached the Edge Function" (now from a validated result) |
| Valuation synthetic check | Passes | Passes |

What this shows:

- The request is now authorized, reaches the chatbot function and reaches the provider. The authorization repair works on hosted.
- This supports the explanation that the bearer was the difference. It does not prove why the earlier request was rejected.
- The check as a whole still fails. The provider returned non-empty text that was not exactly the expected reply. The text is not logged or stored, so the reason is not known.

The hosted check is therefore not yet passing. The acceptance criterion (a Passed result with the expected reply validated) is not met.

### Update: owner-reported results from 16 November not recorded earlier

The owner reported these when authorizing phase 2 on 16 November 2026. They were used in planning but were not written into this file at the time. The planner did not observe them. The section "S1 hosted data check (not yet run)" above is left as written; this entry supersedes its status.

| Item | Owner-reported |
| --- | --- |
| S1 and S2 | Verified in CI. Not deployed. |
| Migration dry run against the hosted project | Exactly two migrations pending: S1 and S2 |
| Read-only data check on the hosted database | 54 verified listings. Zero matches for each of the four inconsistency checks. |
| S3 service monitor workflow | Passed in CI. The live step ran with three targets `NOT_CONFIGURED`. |
| Hosted password policy | At least 8 characters with a lowercase letter, an uppercase letter and a digit |

The data check should be repeated immediately before the migrations are applied, because listings may have changed since.

### B3: Synthetic check validation and diagnostics

Status: implemented in the repository, verified locally in the Node suite only. Not committed at the time of writing, not run in CI, not deployed. No provider call was made.

| Check | Run by | Result |
| --- | --- | --- |
| Red run before implementation | Sonnet | The unit test file failed to load because the classifier did not exist yet; the changed route tests failed on the prompt and the log fields. Sonnet did not capture pass and fail counts for the route file. |
| Focused files after implementation | Sonnet | 67 of 67 pass |
| Full Node suite (`npm test`) | Planner | 619 of 619 pass (609 plus 10) |
| `npm run lint` | Planner | 0 errors, the same 2 existing warnings |
| `npx tsc --noEmit -p tsconfig.app.json` | Planner | exit 0 |
| `npm run build` | Planner | exit 0 |
| `git diff --check` | Planner | exit 0 |
| Classifier probe, 13 extra inputs, run by hand | Planner | Exact and cosmetically wrapped tokens pass. A code fence with a language tag, two trailing full stops, mismatched quotes, extra characters after the token, text before the token, a different case and a repeated token all fail. |

Not verified: whether real free-tier models now return an accepted reply, and whether 128 output tokens is enough for them. Only a hosted run can show that, and one run cannot show reliability, because the configured router chooses a different model per request.

### Final hosted verification: both synthetic checks pass (owner-observed)

B3 is committed at `b49f4ec`, pushed, and the `chatbot` function was deployed by the owner. The owner then ran both synthetic checks from the Admin Monitoring dashboard on the hosted Supabase project. The planner did not run or observe them; the values below are as the owner reported them.

| | Chatbot Synthetic Check | Valuation Synthetic Check |
| --- | --- | --- |
| Status | Success | Success |
| Duration | 7.7 seconds | 52.9 seconds |
| Provider and configured model | OpenRouter, `openrouter/free` | Not applicable |
| Expected model version | Not applicable | `hdb-catboost-2025-12-v1` |
| Observed model version | Not applicable | `hdb-catboost-2025-12-v1` |
| Dashboard evidence line | Synthetic check passed | Synthetic check passed |

The owner also reports that the `chatbot` and `admin-monitoring` function logs confirm both executions. The deployed functions are current. No further deployment is needed for this work.

How the chatbot check got here:

| Slice | What it changed | Hosted result after it |
| --- | --- | --- |
| Before | | `AUTH_FAILURE` in 19 ms. No chatbot invocation. The dashboard claimed the function was reached. |
| B1 | Corrected the misleading evidence: the dashboard claims the function ran only when the response proves it | Not deployed on its own |
| B2 | Repaired the authorization path: the administrator's session is forwarded and verified inside the chatbot function | The function and the provider were reached. `CANARY_VALIDATION_FAILURE`. |
| B3 | A clearer fixed prompt, a larger output limit, acceptance of cosmetic wrapping only, and safe diagnostics | Success |

What these results show, and what they do not:

- Each is one point-in-time execution. It shows that, at that moment, the request was authorized, the function ran, the provider or model service answered, and the response passed validation.
- They do not show continuous reliability. The chatbot's configured model is a free router that chooses a different model per request, so a later run can fail for reasons unrelated to this work.
- The valuation check confirms that a prediction was returned in the expected shape from the expected model version. It says nothing about how accurate the model's estimates are.
- The original rejection of the chatbot check was never explained. The B2 repair working is consistent with the bearer being the difference. It is not proof.
- The valuation check's long duration is consistent with a free-tier model service waking from sleep. That was not measured.
