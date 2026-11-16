# Review findings

Independent reviews by the planning model of work produced by the implementation agent. Entries are added when a review happens.

## S1 step 1: database regression tests (16 November 2026)

**Reviewed:** `SGHomie/BackEnd/supabase/tests/database/hdb-verification-integrity.test.sql`, written by Sonnet at medium effort from handoff 01.

**Method:** read the full file against the handoff, the two existing trigger functions, the town centroid function and the conventions of `access-control.test.sql`. Nothing was executed. Docker is unavailable, so the file has not run anywhere yet.

**Result:** accepted for the first CI run. No changes requested.

| Check | Finding |
| --- | --- |
| Scope | One new file. No existing migration, test, frontend file or Edge Function was edited. |
| Plan count | `plan(38)` matches 38 assertions, counted by hand. |
| Conventions | Same transaction, role switching, claim settings and rollback as the existing database test file. New identifiers do not collide with it. |
| Coverage | All 13 tests in the handoff are covered, including one assertion per already-guarded column and three reverification cases. |
| Isolation | Writes that are expected to be rejected only after the fix each use their own row, so a write that succeeds today cannot disturb a later assertion. |
| Failure mode | Every write that may be rejected sits inside an assertion, so an unexpected result reports "not ok" and does not abort the file. |

**Expected first CI result, by reasoning only:** 7 assertions fail and 31 pass. The 7 are the ones that describe the new invariant. This is a prediction, not an observation.

**Unverified**

- Whether the file runs at all. A syntax or fixture error would appear only in CI.
- The fixture insert performed as a seller also fires the existing amenities trigger. The existing database tests never exercise a successful seller insert, so this path is untested. If it fails, later assertions fail for the wrong reason and the run is not a valid red result.
- How the trusted-write test resolves the signed-in user after the role reset. A wrong assumption would show as one failed assertion.

**Outcome:** the first CI run matched the prediction exactly. See `04-test-evidence.md`.

## S1 step 2: migration (16 November 2026)

**Reviewed:** `SGHomie/BackEnd/supabase/migrations/20261101120000_hdb_verification_location_integrity.sql`, written by Sonnet at medium effort.

**Method:** read the full migration against the handoff and the two functions it replaces, and checked the implementation agent's trace of every assertion. Nothing was executed.

| Check | Finding |
| --- | --- |
| Scope | Two `CREATE OR REPLACE FUNCTION` statements. No trigger, table, policy or grant is changed. |
| Preserved | Function signatures, security settings, the trusted-write bypass, all seven existing guarded columns and both error messages. |
| New behaviour | Matches the handoff: additional guarded columns on verified rows, canonical detailed location on a token write, no centroid replacement on verified rows. |

**Finding 1, fixed.** A verified listing with no stored detailed location would have every ordinary save rejected, because the seller edit form resends a missing value as an empty string and the new guard treated that as a change. The implementation agent raised this in its own report. Requested change: treat a missing and an empty detailed location as equal. Applied in the migration, with two added assertions (HV-14a and HV-14b). The test file now plans 40 assertions, confirmed by count.

**Unverified**

- Whether the migration applies and all 40 assertions pass. That needs the CI `database` job.
- Hosted data. Existing verified listings whose stored town differs from their location, or whose stored fields are otherwise inconsistent, would have ordinary saves rejected. A read-only count on the hosted database is required before any deployment (gate G8).

**Process note.** The detailed S1 handoff was included in the first push, earlier than the disclosure rule intended. The pushed test file describes the same invariant, so the added exposure is limited. No history was rewritten.

## L0: home page explicit column list (16 November 2026)

**Reviewed:** the diff to `SGHomie/FrontEnd/src/components/FeaturedListings.tsx` and the new `SGHomie/tests/featured-listings.test.mjs`, written by Sonnet at medium effort from handoff 02.

**Result:** accepted. No changes requested.

| Check | Finding |
| --- | --- |
| Scope | One component and one new test. Rendering is unchanged. |
| Change | The query requests nine named columns: the eight the component renders and the row identifier. |
| Type change | The component state type was narrowed to those nine columns. This was needed for the typecheck to pass and is correct. |
| Test | Fails before the change and passes after it. It rejects a request for every column, rejects any column outside the rendered set, and requires each rendered column. |
| Checks reported by the agent | 440 Node tests pass (439 baseline plus one), lint 0 errors with the same 2 warnings, typecheck and build pass. Not re-run by the reviewer. |

**Correction to the agent's survey.** The agent reported that the chatbot's listing search can run without a signed-in user. The reviewer read the request handler: a request without a signed-in user returns onboarding text before the search is reached, so the search runs only for signed-in users. The fallback to the public key inside the search helper is defensive and is not reached from the chatbot today.

**Unverified**

- Behaviour against a real database. The test checks the requested column list only.
- What the realtime new-listing notification delivers to a visitor who is not signed in.

## S2: public listing column contract (16 November 2026)

**Reviewed:** the migration `20261102120000_public_listing_column_contract.sql` and `public-listing-contract.test.sql`, written together by Sonnet at medium effort from handoff 03. Reviewed before the push. Nothing could be executed locally.

**Result:** migration accepted as written. One change requested to the test file, then accepted.

| Check | Finding |
| --- | --- |
| Scope | Two new SQL files. No existing file edited. |
| Migration | Two statements: revoke the anonymous role's read on the table, then grant read on twelve named columns. No row policy, other role or other privilege is changed. |
| Allow-list | Matches the columns used by the three anonymous queries and the realtime notice. Free-text description is excluded. |
| Coverage | Catalog check of the exact column set, each private column refused individually, refusal when filtering or ordering by a private column, unchanged row visibility, and unchanged access for a signed-in buyer, the owner and an admin. |

**Finding 1, fixed.** The test calls a helper function while acting as the anonymous role, outside a guarded assertion. If that role could not execute it, the whole file would abort. Requested change: grant execute on the helper inside the test. Applied.

**Risks recorded before the push, later resolved by CI**

- Whether anonymous queries still work when the row policy refers to a column that role cannot read.
- Whether the anonymous read was granted directly or through a shared grant that the revoke would not remove.

Both held in CI. See `04-test-evidence.md`.

**Still unverified**

- Hosted grant state and hosted behaviour.
- Realtime delivery for visitors who are not signed in.

**Remaining limitation.** The change closes anonymous access only. Signed-in accounts keep their current access.

## S3: Level 1 service monitoring runner (16 November 2026)

**Reviewed:** `SGHomie/scripts/monitor/checks.mjs`, `classify.mjs`, `SGHomie/scripts/service-monitor.mjs` and `.github/workflows/service-monitor.yml`, read in full. Written by Sonnet at medium effort from handoff 04. The reviewer also ran the focused test and two fixture scenarios locally. No request was made to any real service.

**Result:** accepted, with one classification rule left open for the repository owner.

| Check | Finding |
| --- | --- |
| Scope | New files only. No existing file edited. No new dependency. |
| Requests | One request per target, a timeout on each, no retries, redirects not followed. The optional model-version request is the only one that carries a credential, and it goes only to the configured model service. |
| Output safety | Checks return status, timing, host and a few booleans. Response bodies are parsed locally and dropped. The classifier copies only validated fields, so extra data in an observation or fixture cannot reach the report. |
| Classification | Pure and deterministic. Timeouts, network errors, redirects, unexpected statuses and missing configuration are `unknown`. |
| Exit code | 1 only when a target is `failed`. Confirmed locally: a not-ready fixture exits 1, an unconfigured run exits 0. |
| Workflow | Read-only permissions, no echo of variables or secrets, summary and artifact steps run even when the monitor exits 1, and a comment states that the schedule is inactive off the default branch. |

**Verified by the reviewer:** focused test, 17 of 17 passed. Fixture `render-not-ready` printed the table and exited 1. Fixture `nothing-configured` reported three `unknown` results and exited 0.

**Reported by the implementation agent, not re-run:** full Node suite 457 passed (440 plus 17), lint 0 errors with the same 2 warnings, typecheck and build passed.

**Finding 1, fixed.** Any 5xx response was `failed` for every target. The handoff asked for that, so this was a planning error, not an implementation error. On review it conflicted with the existing dashboard's rule that an uncertain probe stays unknown: a sleeping free-tier model service can answer 502, 503 or 504 from its proxy while waking, and with no stored state the runner cannot tell a wake-up from an outage.

The repository owner chose to change the rule for the model service only. A 502, 503 or 504 there, without the explicit not-ready message, is now `unknown` with reason `UPSTREAM_UNAVAILABLE`. The same statuses on the optional version request are `unknown` too. The explicit not-ready response, a 500, and every 5xx on the other two targets remain `failed`.

Re-reviewed after the change: the new branch sits after the explicit not-ready check and before the generic 5xx check, so the order gives the intended result. The reviewer re-ran the focused test (22 of 22 passed), the new `render-waking` fixture (model service `unknown`, exit code 0), the full Node suite (462 passed) and lint (0 errors, the same 2 warnings).

**Consequence of that choice.** A real outage of the model service that answers 502, 503 or 504 is also reported as `unknown` and does not fail the run.

**Limitations**

- The Supabase check uses a request the function answers from a constant. It shows the function runtime is reachable. It does not exercise the database.
- The frontend check looks for the app's root element in the HTML. It does not detect a client-side crash after load.
- A redirect is reported as `unknown`, so each configured URL must be the final one.
- The workflow has not run. Its YAML is unvalidated until pushed.
- No live run has been made. Hosted behaviour is unverified.
- Periodic monitoring is not active. The schedule runs only from the default branch.

## S4: sign-up password experience (16 November 2026)

**Reviewed:** the full diff to `SGHomie/FrontEnd/src/components/AuthModal.tsx` and the changes to the two `auth-modal` test files, written by Sonnet at medium effort from handoff 05. The reviewer re-ran the focused tests, the full Node suite, lint and the typecheck.

**Result:** accepted. One minor follow-up noted, not blocking.

**The implementation agent stopped before writing code.** Adding a required confirm-password field would have failed the existing sign-up tests, because their two shared helpers fill only the email and password. The handoff told the agent to stop in that case. It reported the affected tests and two options.

**Planner decision.** Update the two helpers with one added step each, filling the confirm field with the same synthetic password. The alternative, checking the confirm value only when it is non-empty, would have left every existing test untouched but made the new check bypassable. The helper change models a user completing the new required field. The reviewer confirmed from the diff that no existing line in either test file was removed or altered: the two files have 146 added lines and none removed.

| Check | Finding |
| --- | --- |
| Scope | One component and two test files. No dependency or new component file. |
| Unchanged | The arguments to the sign-up and sign-in calls, the duplicate-send guard and every existing message. |
| Confirm field | Shown in sign-up mode only. A mismatch, including an empty confirm value, blocks submission before any loading state or Supabase call and keeps the entered values. |
| Mismatch message | Text with an alert role, linked to the field and marked invalid. It does not rely on colour alone. It clears when either password is edited. |
| Show or hide | One non-submitting button controlling both fields, with a constant accessible name and its state exposed. Passwords are hidden by default and hidden again on close, mode switch and sign-in. |

**Verified by the reviewer:** focused tests 23 of 23 passed, full Node suite 472 passed (462 plus 10), lint 0 errors with the same 2 warnings, typecheck passed. The build was run by the implementation agent only.

**Minor follow-up, not fixed.** The show or hide button's clickable area is the size of its 20 pixel icon. A slightly larger target would be easier to tap on a phone.

**Unverified**

- Browser rendering, keyboard order, visible focus, and what a screen reader announces. The tests run in a virtual harness and check properties only.
- Colour contrast of the mismatch message.
- The hosted password rules. Supabase still decides password strength.

**Notes from step 1, carried into step 2**

- The migration must keep the two existing error messages word for word. The tests match on them.
- The seller edit form resends the stored verification time. It is the same instant, so it does not count as a change today. The migration must not alter that comparison.
