# NCS AI-Native Builder assessment: overview

This folder records the planning, handoffs, evidence and reviews for the assessment work on SG Homie. The work is on the branch `assessment/ncs-opspilot`, from 16 to 17 November 2026.

Status words used throughout:

| Word | Meaning |
| --- | --- |
| Existing | In the repository before the assessment began |
| Implemented | Code is committed on the assessment branch |
| CI verified | The GitHub Actions run for that commit passed |
| Browser verified | Seen working in a real browser, by the person or tool named |
| Hosted verified | Seen working against the hosted Supabase project or the live site, by the person named |
| Planned | Not built |

Security findings are described in general terms until the fixes are live on the hosted project.

## Where to find things

| Document | Contents |
| --- | --- |
| [00-baseline.md](00-baseline.md) | What existed before the assessment, and the baseline test run |
| [01-scope-and-decisions.md](01-scope-and-decisions.md) | Scope, how it changed, and decisions D1 to D28 |
| [02-implementation-plan.md](02-implementation-plan.md) | The first implementation plan. Historical: written before implementation. Later decisions in 01 take precedence. |
| [03-auth-and-security-plan.md](03-auth-and-security-plan.md) | The authentication and security plan. Historical: its account of the chatbot check predates the hosted evidence in 04. |
| [04-test-evidence.md](04-test-evidence.md) | Every test run, who ran it and what it showed |
| [05-review-findings.md](05-review-findings.md) | The planning model's independent review of each slice |
| [06-retrospective.md](06-retrospective.md) | What worked, what went wrong, the weakest part, future work |
| [handoffs/](handoffs/) | One focused brief per slice, written by the planning model for the implementing model |

## What SG Homie already did

SG Homie is a Singapore HDB resale companion built for a university software engineering course. Before the assessment it had buyer search, listings, enquiries, seller and admin workflows, email sign-up with verification, HDB address verification, a research valuation service, a chatbot with quotas and telemetry, and an Admin Monitoring dashboard with on-demand checks. [00-baseline.md](00-baseline.md) lists this in full. The baseline test run was 439 passing Node tests.

## The problem chosen

Two gaps in an otherwise working application:

- **Nothing watched the services from outside.** The dashboard's checks ran only when an administrator clicked them, and one of them, the chatbot synthetic check, was failing on hosted with an unexplained authentication error.
- **Account and data safety had gaps.** There was no way to recover or change a password, and a source review found two places where the listings data needed tighter rules in the database.

## What was built

| Slice | What it does | Implemented | CI verified | Browser verified | Hosted verified |
| --- | --- | --- | --- | --- | --- |
| S1 HDB verification integrity | A verified listing's location fields can change only together, through a valid verification | Yes | Yes | Not applicable | No. Migration not applied. |
| L0 Home page column list | The home page requests named columns only | Yes | Yes | No | No. Frontend not deployed. |
| S2 Public listing column contract | Visitors who are not signed in can read only an explicit list of listing columns | Yes | Yes | Not applicable | No. Migration not applied. |
| S3 Service monitor | A script and workflow that check the frontend, the model service and the chatbot function from outside | Yes | Yes, with all three targets unconfigured | Not applicable | No configured live run recorded |
| S4 Sign-up password fields | Confirm password and show or hide | Yes | Yes | Owner, on a local build | Owner, against hosted Auth |
| A1 Password policy and strength estimate | A rule checklist and an advisory strength meter | Yes | Yes | Planner with Playwright, and owner, on a local build | Owner, against hosted Auth |
| S5 Forgot and reset password | Reset by emailed link, with expired and invalid link states | Yes | Yes | Planner with Playwright for link states; owner end to end | Owner, with a real recovery email |
| S6 Change password | A form on the Profile page that requires the current password | Yes | Yes | Owner, on a local build | Owner, against hosted Auth |
| B1 Honest check evidence | The existing dashboard claims the chatbot function ran only when the response proves it | Yes | Yes | No | Function deployed. The reworded dashboard line needs the frontend deployed. |
| B2 Check authorization | The existing chatbot check is authorized by the administrator's verified session | Yes | Yes | Not applicable | Owner: the check reached the function and the provider |
| B3 Check validation and diagnostics | A clearer fixed prompt, acceptance of cosmetic wrapping only, and safe diagnostics | Yes | Yes | Not applicable | Owner: the chatbot check and the valuation check each passed one run |

The Admin Monitoring dashboard and both synthetic checks existed before the assessment. B1 to B3 repaired and tightened the chatbot check. They did not create it. The valuation check was not changed.

"Owner, on a local build" means the repository owner ran the frontend locally, connected to the hosted Supabase project, with a synthetic account. None of the frontend work is on the live Netlify site yet, because Netlify deploys from `main`.

## Scope decisions and cuts

The scope changed twice on the first day, each time at the owner's direction. See "How the scope changed" in [01-scope-and-decisions.md](01-scope-and-decisions.md).

- **Cut: an AI incident investigator, Telegram alerts and stored alert state.** This was the original primary idea. With about a day available, deterministic checks were easier to test and explain (D1).
- **Cut: a runtime LLM anywhere in the new work** (D1).
- **Kept small: monitoring at "Level 1".** Outside-in reachability and readiness only. No real valuation or AI call on a schedule.
- **Deferred:** listing approval integrity, rate limits on valuation and address lookup, admin action auditing, multi-factor authentication, scheduled deep canaries.
- **Accepted limitation:** the listing data fix covers visitors who are not signed in. Signed-in accounts keep their current access (D7).

## Architecture and security choices

- **No new infrastructure.** The existing React and Vite frontend, Supabase (Auth, Postgres, Edge Functions), the FastAPI service on Render and GitHub Actions are unchanged. No new dependency was added.
- **Database rules live in the database.** Both data fixes are new migrations with pgTAP tests. No application code is trusted to enforce them.
- **Supabase Auth stays the authority on passwords.** The frontend mirrors the minimum policy for early feedback. The strength rating is labelled an estimate (D13, D14).
- **The monitor stores nothing and sends no credentials** except one optional token to the model service it belongs to (D8).
- **Uncertain is not failed.** Timeouts, network errors and a waking free-tier service are reported as unknown.
- **The chatbot check is authorized by who asked.** The administrator's session is verified inside the chatbot function before any provider call. A privileged key no longer travels between functions (D22 to D24).
- **Evidence is not overstated.** A flag that said "the function was reached" for every response was corrected (D19).

## How the work was done

Three roles, set out in `CLAUDE.md` at the repository root:

| Role | Who | Did |
| --- | --- | --- |
| Owner | The repository owner | Chose the problem and scope, set the working method, approved or rejected each plan, made every commit and deployment, ran every hosted check, and tested the authentication flows by hand |
| Planner and reviewer | Claude Fable, in Claude Code | Investigated the repository, wrote one handoff per slice, reviewed every diff independently and re-ran the checks |
| Implementer | Claude Sonnet at medium effort, started from each handoff | Wrote the tests first, then the code, and reported real command output |

Rules that held throughout: no agent staged, committed, pushed, deployed or changed a hosted setting. Each slice was written test-first. A slice that hit an unexpected condition stopped and reported.

### The owner's engineering judgment, with the record of each

The agents wrote the plans, code and tests. The direction, the boundaries and the acceptance of each result were the owner's. The first table groups that by kind of judgment. The second lists the individual decisions.

| Judgment | What the owner did | Record |
| --- | --- | --- |
| Chose the problem | Named operational monitoring and security as the priorities for a working application, and brought the failing hosted chatbot check into scope | [00](00-baseline.md), "Hosted state"; [01](01-scope-and-decisions.md), "Final scope" |
| Challenged the first proposal | Asked for a critical comparison of the large AI operations assistant against security and monitoring work without a runtime model, then cut the assistant | [01](01-scope-and-decisions.md), "How the scope changed" |
| Narrowed the scope | Kept monitoring at Level 1, limited the data fix to visitors who are not signed in, and deferred alerting and deep canaries | D1, D7, D9, D21 |
| Reused the existing stack | No new service, framework or dependency. The monitor is a plain Node script on GitHub Actions. | D8; the diff adds no dependency |
| Put authorization on the server | Enabled the hosted current-password requirement so the server enforces what the form checked. Required the chatbot function to verify the administrator itself before any provider call. Required proof that the administrator flag is protected in the database before relying on it. | D17, D18, D22; [handoff 10](handoffs/10-b2-canary-authorization.md), "Owner requirements added on approval" |
| Set the working method | One model plans and reviews, the other implements and tests, from one focused handoff per slice, tests first, with an independent review | `CLAUDE.md`; every file in [handoffs/](handoffs/); [05](05-review-findings.md) |
| Tested on hosted personally | Sign-up, a real recovery email, password reset and change, Supabase settings, function versions and logs, and every synthetic check run | [04](04-test-evidence.md), the owner-observed and owner-reported updates |
| Kept CI and hosted apart | Required hosted results to be recorded as owner-observed and never as automated runs, and required that no hosted repair be claimed before a real check succeeded | [04](04-test-evidence.md), "Update: Phase A committed and hosted Auth checks"; D25 |
| Challenged assumptions | Ruled out the planner's first explanation with hosted evidence, refused to accept the next one as proven, and rejected a rollback plan that assumed a Git commit matched the deployed code | [04](04-test-evidence.md), "Phase B"; D20; [handoff 12](handoffs/12-b2-deployment-and-rollback.md) |
| Controlled deployment | Every commit, push, function deployment and hosted setting change was made by the owner after reviewing the evidence | D10, D15 |
| Accepted limits | Accepted that an administrator can call the check directly without a stored record, set a stopping rule for troubleshooting, and left the remaining listing privacy work as a product decision | D23, D27, D7 |

The individual decisions:

| Decision or action | Record |
| --- | --- |
| Replaced the original "OpsPilot" idea with security fixes plus Level 1 monitoring, after asking for a critical comparison | [01](01-scope-and-decisions.md), "How the scope changed", D1 |
| Chose CI-only database testing over installing Docker | D2 |
| Approved limiting the push-notification workflow before the first push, so security diffs were not sent to an external provider | D6 |
| Chose how a waking free-tier model service is classified, for that service only | [05](05-review-findings.md), S3 finding 1 |
| Ran the read-only data check and the migration dry run on hosted before any database change was considered | [04](04-test-evidence.md), "Update: owner-reported results from 16 November not recorded earlier" |
| Added the strength-meter requirement with ten interface rules, and kept Supabase as the authority | D13, D14, [handoff 06](handoffs/06-a1-password-policy-and-strength.md) |
| Corrected a misleading error message and ruled out password history | D16 |
| Tested sign-up, password reset with a real email, and password change by hand against hosted Auth | [04](04-test-evidence.md), the two owner-reported updates on the authentication flows |
| Enabled the hosted "Require current password" setting after reviewing the planner's recommendation | D17, D18 |
| Supplied the hosted setting and logs that ruled out the planner's first explanation of the chatbot failure | [04](04-test-evidence.md), "Phase B" |
| Sent the Phase B plan back twice with refinements: what the evidence flag may claim, not to assume the cause, to compare authorization options, to verify the administrator flag is protected, and not to assume a rollback source | D19 to D21, [handoff 10](handoffs/10-b2-canary-authorization.md) |
| Chose the authorization design and added eight requirements to it | D22 to D25 |
| Deployed two functions and ran one hosted check, then set a stopping rule for further troubleshooting | [04](04-test-evidence.md), "Update: B2 committed, CI, deployed, one hosted check" |
| Approved a narrow validation tolerance, kept the check on the chatbot's own model, deployed once more and observed both checks pass | D26, D27; [04](04-test-evidence.md), "Final hosted verification" |

Two items come from the owner's own account and have no separate record in this folder: the original motivation for SG Homie, and the review of the CI run for B2 that passed on its second attempt.

### Where the AI was wrong or incomplete

Each of these is recorded in [05-review-findings.md](05-review-findings.md) or [04-test-evidence.md](04-test-evidence.md). They are summarized in [06-retrospective.md](06-retrospective.md).

- The planner's monitor handoff classified every server error as a failure, which would have reported a waking service as an outage.
- The planner's strength rules contained a condition that could never fail, and its design hid the rule checklist when the field was empty.
- The planner's reset-password handoff said a network failure is thrown. The implementer found it is returned.
- The planner's change-password handoff missed a third test harness, and three existing tests failed.
- The implementer's survey for the home-page slice wrongly said the chatbot search runs for visitors who are not signed in.
- The planner's leading explanation for the chatbot failure, a hosted setting that differed from the repository, was ruled out by the owner's evidence.
- The original cause of that failure is still not established.

## Milestones

| Commit | Date | Slice |
| --- | --- | --- |
| `22d416d`, `5ef7cf7` | 16 Nov | S1 tests, then migration |
| `1133f92` | 16 Nov | L0 |
| `ed2921c` | 16 Nov | S2 |
| `5062d10` | 16 Nov | S3 |
| `0c12329` | 16 Nov | S4 |
| `bd6eb6e` | 16 Nov | A1 and S5 |
| `1f8904f` | 17 Nov | S6 |
| `247fa6b` | 17 Nov | B1 |
| `450d02b` | 17 Nov | B2 |
| `b49f4ec` | 17 Nov | B3 |

## Testing

Every slice was written test-first. The red run and the green run for each are in [04-test-evidence.md](04-test-evidence.md), with who ran them. The Node suite grew from 439 tests at the baseline to 619 at B3. Database tests run only in CI, because Docker is not installed on the development machine.

What the tests do not show: the Node tests use stubbed network calls and a component harness, so they do not prove browser or hosted behaviour. Hosted results are recorded separately and labelled with who observed them.

### Running the checks

From `SGHomie/FrontEnd/`:

```bash
npm test
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

One test file, from the repository root:

```bash
node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/service-monitor.test.mjs
```

The service monitor, from the repository root:

```bash
# No network: a recorded scenario
node SGHomie/scripts/service-monitor.mjs --fixtures all-healthy
node SGHomie/scripts/service-monitor.mjs --fixtures render-not-ready

# Live: set the MONITOR_* variables listed in the workflow file first
node SGHomie/scripts/service-monitor.mjs --json monitor-report.json
```

Unset targets report `unknown` with `NOT_CONFIGURED`. The script exits 1 only when a target is `failed`.

Database tests run in the `database` job of `.github/workflows/tests.yml` on every push.

## Deployment status

| Part | Status |
| --- | --- |
| Frontend changes | Not on the live site. Netlify deploys from `main`. |
| S1 and S2 migrations | Not applied to the hosted database |
| `chatbot` and `admin-monitoring` functions | Deployed by the owner with B1, B2 and B3. Both synthetic checks passed one hosted run each. |
| Hosted Auth setting "Require current password when updating" | Enabled by the owner |
| Scheduled monitoring | Not active. GitHub runs schedules only from the default branch. |

## Limitations and future work

- The two synthetic checks passed on hosted as single runs. That shows those executions, not continuous reliability. The chatbot's configured model is a free router, and the original cause of its earlier rejection was never established.
- A passing valuation check shows the service returned a well-formed prediction from the expected model version. It says nothing about the accuracy of the estimates, which remain research output.
- The two database fixes protect nothing on hosted until the migrations are applied.
- The listing data fix covers visitors who are not signed in. Listing privacy for signed-in accounts is unchanged and needs a product decision.
- The new monitor checks reachability and readiness only. It makes no valuation request and no AI call. Its 30-minute schedule is defined in the workflow but does not run from this branch, because GitHub runs schedules only from the default branch. Its results appear in GitHub Actions, not in the Admin Monitoring dashboard.
- A `system_alerts` table and on-demand incident records already existed. Nothing new writes to them. Automatic incident detection from scheduled checks, stored scheduled observations, repeated-failure thresholds, operational notifications and any AI investigator are future work.
- The strength rating is a small in-house estimate, not a breach check.
- Next steps, in order of value: apply and verify the two migrations, schedule deep canaries with a narrowly scoped credential and quota limits ([handoff 11](handoffs/11-c-monitoring-preparation.md)), store scheduled results and alert on repeated failures, and decide the remaining listing privacy rules.
