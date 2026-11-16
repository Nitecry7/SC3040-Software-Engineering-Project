# Implementation plan

Security slices are described generically here. Their detailed handoffs are added in the same push as their fix. See decision D11 in `01-scope-and-decisions.md`.

## Roles

| Step | Owner | Output |
| --- | --- | --- |
| Slice brief | Planning model | Handoff file under `planning/handoffs/` |
| Tests first, then code | Sonnet Medium | Diff and pasted test output |
| Review | Planning model, in a fresh context | Findings in `05-review-findings.md` |
| Commit, push, deploy | Repository owner | CI run |

One slice is in flight per lane. Decisions, mistakes and scope changes are recorded when they happen.

## Slices

Budgets are checkpoints, not deadlines.

| ID | Slice | Lane | Priority | Budget |
| --- | --- | --- | --- | --- |
| P0 | Push-notification branch filter | Both | Mandatory | 10 min |
| M0 | Baseline run and planning documents | Both | Mandatory | 45 min |
| S1 | HDB verification integrity (SGH-02) | Database | Mandatory | 1.5 h |
| S2 | Public listing column contract (SGH-01) | Database | Mandatory | 2 h |
| L0 | Home page requests an explicit column list | Local | Mandatory | 30 min |
| S3 | Level 1 monitoring runner and workflow | Local | Mandatory | 2.5 h |
| S4 | Sign-up: confirm password, show or hide | Local | Mandatory | 45 min |
| S5 | Forgot and reset password | Local | Conditional | 2 h |
| S6 | Authenticated password change | Local | Conditional | 1 h |
| E | Chatbot synthetic check authentication repair | Local | Conditional | 1.5 h |
| M9 | Review, evidence, README, recording | Both | Mandatory | 1.5 h |

## Files each slice may affect

| Slice | Files |
| --- | --- |
| P0 | `.github/workflows/telegram-notify.yml` |
| S1 | One new migration and one new pgTAP file |
| S2 | One new migration and one new pgTAP file |
| L0 | `SGHomie/FrontEnd/src/components/FeaturedListings.tsx`, `SGHomie/BackEnd/supabase/functions/_shared/listings.ts` if needed, matching tests |
| S3 | New: `SGHomie/scripts/monitor/*.mjs`, `SGHomie/scripts/service-monitor.mjs`, `SGHomie/scripts/monitor/fixtures/*.json`, `SGHomie/tests/service-monitor.test.mjs`, `.github/workflows/service-monitor.yml` |
| S4 | `SGHomie/FrontEnd/src/components/AuthModal.tsx`, `SGHomie/tests/auth-modal.test.mjs`, `SGHomie/tests/auth-modal-guards.test.mjs` |
| S5 | `AuthModal.tsx`, `App.tsx`, `contexts/AuthContext.tsx`; new `pages/ResetPassword.tsx`, `lib/authRecovery.ts`, `SGHomie/tests/reset-password.test.mjs` |
| S6 | `SGHomie/FrontEnd/src/pages/Profile.tsx`, `SGHomie/tests/profile-workflows.test.mjs` |
| E | `admin-monitoring/index.ts`, `chatbot/index.ts`, `SGHomie/tests/admin-monitoring.test.mjs`, one new chatbot route test |

Database slices add new files only. No applied migration and no existing database test is edited.

## S1 and S2 in outline

- **S1.** A listing marked as HDB-verified must keep location fields consistent with its verification after any edit by a signed-in user, including a legitimate reverification to a new address. Database-level regression tests cover edits, bypass attempts and reverification.
- **S2.** Anonymous callers receive only an explicit allow-list of listing fields. Access for signed-in accounts is unchanged, which leaves the limitation recorded in `01-scope-and-decisions.md`. Database-level regression tests assert the allow-list exactly, so a newly added field is private unless granted.
- **L0** must be live before the S2 migration is applied to any hosted database, because the home page currently requests every field as an anonymous caller.

## S3. Monitoring runner

| Module | Responsibility |
| --- | --- |
| `checks.mjs` | One read-only request per target with a timeout. `fetch` and the clock are injected. |
| `classify.mjs` | Pure. Maps a raw result to `healthy`, `failed` or `unknown` with a reason code. |
| `report.mjs` | Pure. Builds the readable table and the JSON document. |
| `service-monitor.mjs` | Reads configuration from environment variables, runs checks or loads fixtures, prints output, sets the exit code. |

Targets:

- **Frontend:** the hosted site returns 200 with the app shell.
- **Render model:** the public health endpoint reports the model loaded. The expected model version is compared only when a token is configured.
- **Supabase application path:** the public chatbot onboarding reply, which makes no provider call and uses no quota. Subject to owner approval.

Rules:

- A timeout, network error or unrecognised response is `unknown`, never `failed`.
- A target with no configured URL is `unknown` with reason `not_configured`.
- The exit code is non-zero only when at least one target is `failed`.
- Output contains no keys, tokens, query strings or response bodies.

The workflow defines `schedule`, `workflow_dispatch` and a `push` trigger limited to the assessment branch and the monitor paths. It writes the table to the job summary and uploads the JSON as an artifact.

## S4 to S6. Authentication

See `03-auth-and-security-plan.md`.

## Acceptance criteria

**Mandatory**

- S1 and S2: new pgTAP files pass in the CI `database` job with all existing database assertions still passing. For S1, a failing run precedes the passing one.
- L0: the home page requests an explicit public column list, with a test.
- S3: tests pass locally and in CI. Fixture mode and one local live run produce the table and JSON.
- S4: confirm password and show or hide work, with tests.
- The full Node suite, lint, typecheck and build pass. Pre-existing failures are reported separately.
- Documentation states the S2 limitation and separates repository status from hosted status.

**Conditional**

- S5 and S6: only if the mandatory slices are passing and reviewed with time left.
- E: only after the owner's hosted check identifies the mechanism.
- Monitoring workflow observed running on the assessment branch: only after it is pushed.
- Any hosted verification: only after the owner deploys.

## Test and CI gates

| Slice | Local gate | CI gate |
| --- | --- | --- |
| S1 | None possible for SQL | `database` job: a failing push, then a passing push |
| S2 | None possible for SQL | `database` job: one push with tests and migration |
| L0 | Focused Node test, lint, typecheck | `application` job |
| S3 | `service-monitor.test.mjs`, fixture run | `application` job, then `service-monitor.yml` |
| S4 to S6, E | Focused Node tests, lint, typecheck, build | `application` job |

For S1, the failing run must fail on the intended assertions, not on a fixture or syntax error.

## Stopping rule

- Nothing is reverted, removed or discarded automatically. When a slice exceeds its budget or fails CI, the agent stops and records status, and the owner decides whether to continue, defer or discard.
- After three CI cycles without a passing run, a database slice pauses for the owner's decision.
- Conditional slices are dropped in this order: E, then S6, then S5.
- A security migration that is not passing is never reported as done.
- Nothing new starts in the final 1.5 hours.
- No test is weakened, skipped or deleted to make a run pass.

## Demonstrating the monitoring output

1. Fixture run locally: one scenario each for healthy, failed and unknown.
2. Live run locally against the public endpoints, after owner approval.
3. The GitHub Actions run on the assessment branch: job summary and JSON artifact.
4. The stated limit: the schedule is defined but not live.

## Approval gates

| Gate | Owner action | Blocks |
| --- | --- | --- |
| G0 | Approve P0 and confirm no notification run after the first push | Every later push |
| G1 | Read the hosted chatbot function's JWT verification setting and logs | E |
| G2 | Approve the monitored endpoint, supply the Render URL, add repository variables | S3 live run |
| G3 | Each commit and push | CI for every slice |
| G4 | Confirm the hosted redirect allow-list includes the reset route | S5 demonstration |
| G5 | S2 deploy order: frontend, then migration, then a home page check | Hosted SGH-01 fix |
| G6 | E deploy order: chatbot function, then `admin-monitoring` | Hosted synthetic check result |
| G7 | Merge to the default branch | Live scheduled monitoring |
| G8 | Run a supplied read-only count of affected hosted listings | Hosted SGH-02 fix |

Deployment rules:

- The CI `database` job must pass before any hosted database change is considered.
- Every deployment needs the owner's explicit approval at the time.
- CI uses synthetic rows only. A passing run does not show how hosted data behaves.
- If a deployment cannot be verified safely, it is not made, and the documentation records "implemented and CI-verified in the repository; not deployed".
