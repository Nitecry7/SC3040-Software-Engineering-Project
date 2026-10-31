# SG Homie testing report

> **Historical snapshot:** This report records the pre-merge run at `cb3f743`. Its counts and evidence are preserved as originally recorded. The October 28 `main` merge results are separately preserved in [the historical merge report](merge-verification.md); current `faheem` verification is summarized in the [running tests guide](../../tests/README.md).

The initial pre-merge run included **580 executable test cases: 578 passed and 2 failed**. **237 cases were added**, and all 237 passed. Every pre-existing test file was preserved. Five confirmed implementation defects were fixed with regression tests. The two retained failures and seven existing app TypeScript errors keep the overall verification gate open; this is not a production release approval.

This report and its [complete case catalogue](test-case-catalogue.md) provide evidence for the supplied IEEE 829 handout without filling in its test-plan outline. Each catalogue entry records its objective, technique, source procedure and assertion reference, and outcome. The executable test source defines the exact setup, synthetic input, steps and expected result. [Structured results](evidence/case-results.json) retain machine-readable details and measured durations where available; the [running guide](../../tests/README.md) gives reproducible commands.

## Run identity and scope

| Field | Recorded value |
| --- | --- |
| Evidence identifier | SGH-TEST-20261028-01, revision 1 |
| Execution date | 28 October 2026, Asia/Singapore |
| Starting revision | `cb3f7431d5299d45043176476dcbd2a577a8032c` plus the working-tree changes described here |
| Product under test | Active `SGHomie/` application and `MLPricePredictorV2/` research/API code |
| Test levels | Static checks, units, isolated components/handlers, FastAPI in-process transport, PostgreSQL application integration |
| Test data | Explicitly synthetic identities, properties, provider responses, residual histories, temporary CSVs and tiny CPU model bundles |
| Hosted state | No deployment, hosted migration, hosted data mutation, real email or paid provider call performed |
| Unrelated user files | Two pre-existing untracked Word documents were left untouched |

The product scope comes from [PRODUCT.md](../../../PRODUCT.md), the [repository overview](../../../README.md), [buyer flow](../buy-flow.md), [seller flow](../sell-flow.md), [Supabase procedures](../../BackEnd/supabase/README.md), and [valuation research documentation](../../../MLPricePredictorV2/README.md). Product intentions are not counted as implemented features. Legacy `MLPricePredictor/` and `archived_migrations/` were not changed or used as trusted model evidence.

## Results and pass criteria

| Verification | Existing cases | Added cases | Final outcome |
| --- | ---: | ---: | --- |
| JavaScript application and backend handlers | 140 | 85 | 223 passed, 2 failed; no skipped leaf cases |
| Python research, bundle and FastAPI | 203 | 116 | 319 passed, 0 failed, 0 skipped |
| PostgreSQL RLS, triggers and search regex | 0 | 36 | 36 passed, 0 failed |
| **Total independent cases** | **343** | **237** | **578 passed, 2 failed out of 580** |

Node also emits one successful parent-container event for a test with two child cases. It is retained separately by the catalogue generator and excluded from independent case counts, matching Node JUnit's 225 leaf cases. Python parameter expansions are separate executable cases. Cases containing multiple assertions or input loops are counted once at the runner's case level; assertion and loop counts are not inflated into extra cases.

| Additional check | Result | Practical meaning |
| --- | --- | --- |
| `npm run lint` | PASS; 2 existing React Refresh warnings | No lint errors; warnings in AuthContext and main remain |
| `npx tsc --noEmit` | PASS | Limited result: empty wrapper project, not an app typecheck |
| `npx tsc --noEmit -p tsconfig.app.json` | FAIL; 7 existing errors | Actual application type gate remains open |
| `npm run build` | PASS; existing large Analytics chunk warning | Production assets can be bundled; this does not imply type correctness or runtime acceptance |
| Fresh application migration chain | PASS; all 15 migrations | Applied only to a disposable local test database |
| `git diff --check` | PASS | Changed tracked text has no whitespace errors |
| New GitHub Actions workflow | Prepared; hosted execution NOT RUN | Local results do not establish a successful CI run |

A case passes when all its executable assertions complete successfully; it fails when an assertion or required operation fails. A skipped or unexecuted scenario cannot satisfy a feature's acceptance gate. Suite success requires zero unexpected failures. Full project acceptance additionally requires the unresolved checks and the high-risk manual/staging cases below. No arbitrary line-coverage percentage is substituted for those conditions.

## Coverage strategy

Black-box testing derives cases from external behaviour: valid and invalid requests, role-based access, success and error responses, user events and rendered states. Equivalence partitions include anonymous/buyer/seller/admin, missing/expired/wrong-owner tokens, approved/draft listings, valid/invalid browser keys, supported/unsupported property values, valid/corrupt bundles and available/unavailable services. Boundary cases include transaction-month split edges, zero/maximum numeric values, first/next database pages, 100-object deletion batches and strictly prior comparable-sale months.

White-box testing selects branches from the implementation: authorization before privileged work, provider retry and cache branches, cleanup traversal, no side effects after errors, loader invariants, lock release after exceptions, lifecycle cleanup, preprocessing selection and calibration guards. Fault injection deliberately throws database, provider, model or classifier errors. Metamorphic leakage cases mutate present/future targets and forbidden fields to verify that prohibited information cannot alter features or earlier predictions.

The new frontend cases exercise actual components through isolated hook and service boundaries; Markdown security cases render the real React Markdown component. Backend cases execute actual TypeScript handler bodies with external SDK, fetch, environment and SMTP boundaries replaced. They do not establish Deno module compatibility, a real JWT exchange or service availability. Existing source-regex tests remain supplementary static contracts. They are not counted as browser end-to-end evidence.

Database cases execute real PostgreSQL policies, constraints and triggers under `anon` and `authenticated` roles with synthetic JWT claims. The helper creates a fresh database, copies only the local Supabase auth/storage pre-data structure, restores required keys/default permissions, applies repository migrations and drops the database after rollback. This establishes application database behaviour, not cryptographic authentication, Storage HTTP behaviour or a complete new Supabase installation.

### Measured white-box coverage

The full Python suite was measured with Coverage.py branch tracing over `MLPricePredictorV2/src`:

| Measurement | Covered / total | Coverage |
| --- | ---: | ---: |
| Executable statements | 1,839 / 2,107 | 87.28% |
| Branches | 542 / 746 | 72.65% |
| Combined Coverage.py score | Statement and branch opportunities together | 83.46% |

The combined score must not be described as statement or branch coverage. Selected combined file figures are API app 98%, API schemas 97%, inference bundle 90%, chronological splitting 92%, parsers 100% and boosted-model code 59%. Exact missing statements and branches are in [coverage JSON](evidence/ml-coverage.json) and [coverage XML](evidence/ml-coverage.xml). Remaining paths include GPU setup, several malformed bundle and evaluation guards, and baseline no-history/missing-column branches. No coverage exclusions or reduced thresholds were introduced.

No whole-frontend/backend coverage percentage is claimed: VM-transpiled tests do not reliably map coverage to original TypeScript. Their branch assertions and functional cases provide targeted evidence, not complete path coverage. No performance, reliability/MTBF, security-audit or browser-compatibility percentage is inferred from case counts.

## Feature traceability and risks

These audit identifiers map current product requirements to test evidence; they are not invented identifiers from an SRS.

| Requirement and user capability | Risk and reason | Automated evidence | Remaining acceptance evidence |
| --- | --- | --- | --- |
| AUTH: register, sign in, complete profile, enter allowed routes | High: account and role boundaries | Auth modal/guards, profile request deduplication, protected routes, browser config, DB-01..09/31 | Real verification email, session persistence/sign-out, profile create/update and role navigation |
| SEARCH: discover approved HDB homes by explicit criteria | High: wrong or hidden listings | Buyer-flow cases, FE-SEARCH-01..09, DB-04/10..14/21/33..36, static resource checks | Real browser-to-PostgREST query serialization, profile preference startup, pagination/large catalog |
| SELL: verify an HDB address and save own drafts | High: forged locations and ownership | Sell-flow cases, BE-LOC-01..13, DB-15..20 | Dashboard submit/edit/reject/resubmit, real HDB/OneMap responses, private unit capture |
| ADMIN: review listings and inspect user directory | High: privileged actions | BE-ADM-01..06, DB-09/14/28..32 | Full administrator dashboard interactions and staging audit trail |
| ENQUIRY: submit requests and see permitted responses | High: personal data and unauthorized replies | FE-ENQUIRY-01..06, BE-ENQ-01..05, DB-06/07/23/24/32 | AdminDashboard direct-update path, email delivery and malformed reply schema |
| IMAGES: preserve linked photos and remove orphans safely | High: potential irreversible image loss | BE-IMG-01..08, including later database pages and storage batches | Real Storage uploads/policies, concurrent edits, configured page caps and cleanup scheduling |
| CHAT: explain trusted search results and seller drafts | High: invented application facts/tool writes | Existing buy/sell/provider cases, FE-MARKDOWN-01..07 | Deno/provider integration, timeouts, adversarial long conversations, browser chat lifecycle |
| VALUATION: request a server-built research estimate and range | High: input authority, model and credential boundaries | Existing valuation/PropertyDetails/range cases, API/bundle additions, database provenance migrations applied | Authenticated browser → Edge → inference round trip, real released bundle and outage recovery |
| ML: avoid target leakage and preserve chronology | High: invalid research conclusions | Existing 203 Python cases plus 116 new API/leakage/bundle cases; measured branch coverage | Real-data holdout reevaluation and production artifact approval remain separate |
| PROVENANCE: distinguish synthetic amenities and estimates | High: misleading housing evidence | Amenity/analytics/valuation tests, schema constraints, bundle metadata assertions | Review all pages; analytics remain demo content, not verified market evidence |
| ACCESSIBILITY: keyboard and responsive interaction | Medium: exclusion or unusable flows | Selected accessible states, alerts, pressed-state and route assertions | Real browser focus order, screen reader, contrast, touch and viewport checks |

## Added test design and outcomes

| New area | Cases | Selection and expected behaviour | Outcome |
| --- | ---: | --- | --- |
| Protected routes | 5 | Loading precedes redirects; anonymous/incomplete profiles redirect; complete users enter | 5 PASS |
| Browser Supabase configuration | 18 | Reject missing/placeholder URLs, privileged/malformed keys; accept supported anon/publishable and local config | 18 PASS |
| Enquiry component | 6 | Scope history, trusted account email, pending submission, input retention on failure, loading and refresh | 6 PASS |
| Auth modal guards | 8 | Current confirmation action, duplicate registration guard, hashed storage and safe fallback/error guidance | 8 PASS |
| Chat Markdown | 7 | Escape raw HTML, reject script URLs, protect external links, preserve internal routes and hide tool markup | 7 PASS |
| Explore search | 9 | Approved HDB query, room type distinct from bedrooms, executive/ALL/unsupported cases, price bounds, errors and selection | 9 PASS |
| Administrator directory handler | 6 | Authorization first, correct joins/counts/email degradation, errors without privileged access | 6 PASS |
| Enquiry reply handler | 5 | Preflight, absent/invalid/non-admin rejection, authorized flow and failure-side-effect ordering | 5 PASS |
| HDB location handler | 13 | Auth/seller gates, postal partitions, authoritative matching, retry/cache, coordinate and token failures | 13 PASS |
| Image cleanup handler | 8 | Server-only authorization, traversal, linked/orphan separation, later pages, batches and fail-before-delete | 8 PASS |
| FastAPI contract gaps | 38 | Numeric/category/credential partitions, boundaries, unavailable state, lifecycle and exception recovery | 38 PASS |
| Leakage and split gaps | 26 | Split inclusivity, partial periods, defensive copies, comparables, calibration and invalid metric contracts | 26 PASS |
| Bundle and CSV gaps | 52 | Metadata/provenance/calibration mutations, corrupt manifests, partial writes, invalid predictions and file selection | 52 PASS |
| PostgreSQL application integration | 36 | Actual RLS role operations, private data, verification, interest uniqueness, admin work and search regex | 36 PASS |

For every existing and added case, consult the [case catalogue](test-case-catalogue.md). Python parameter values remain part of case names. Synthetic model predictions and property records in fixtures are never presented as current housing evidence or new model evaluation metrics.

## Confirmed defects and corrective actions

| Defect | Reproduction before correction | Correction and final evidence | Scope or residual risk |
| --- | --- | --- | --- |
| D-01 enquiry reply handler had no caller/admin gate | Anonymous/invalid sessions reached HTTP 200 and privileged enquiry/email work | Validate caller with Supabase Auth and require server-read `is_admin` before enquiry access; BE-ENQ-02..04 pass | Local source finding; deployed exposure unknown. Active dashboard uses direct database updates |
| D-02 cleanup missed property references after the first 1,000 rows | A photo linked only by property 1,001 was treated as orphaned | Gather id-ordered pages before any deletion; BE-IMG-06 passes | Assumes Data API cap at least the configured 1,000; concurrent changes still need a stronger snapshot/grace policy |
| D-03 address lookup accepted unusable coordinates | Empty/null/zero/out-of-Singapore coordinate fixtures could obtain verification | Check finiteness and the application's broad Singapore bounds before issuing a token; BE-LOC-13 passes | Bounds are a sanity check, not evidence of exact location |
| D-04 Explore flat size incorrectly queried bedroom count | `4 ROOM` requested four bedrooms; `EXECUTIVE` generated NaN | Controlled room-type text patterns consistent with chatbot, reject unsupported sizes, label recorded count as bedrooms; FE-SEARCH-02/03 and DB-33..36 pass | Exact listing wording still affects text matching; actual PostgREST integration remains pending |
| D-05 fractional calibration years silently truncated | 2021.5 and 2022.25 were accepted before required-year set validation | Reject nonfinite/noninteger years before integer conversion; both regressions pass | Frozen configuration, model arithmetic, training data and thresholds unchanged |

Only these five production source files changed: [Search](../../FrontEnd/src/pages/Search.tsx), [enquiry reply](../../BackEnd/supabase/functions/send-enquiry-response/index.ts), [image cleanup](../../BackEnd/supabase/functions/cleanup-unlinked-property-images/index.ts), [address lookup](../../BackEnd/supabase/functions/lookup-hdb-location/index.ts), and [bundle validation](../../../MLPricePredictorV2/src/inference/bundle.py). No database schema change or deployment was needed. New SQL files are tests, not migrations.

## Unresolved failures and limitations

**F-01 existing auth assertion, observed before any changes.** `auth-modal.test.mjs` clicks the exact label `Back to Sign In`; current UI uses `Go to Sign In`. The preserved case fails with `Expected element to be rendered`. FE-AUTH-01 separately verifies current action, retained email and cleared password. A maintainer must decide the intended label and then reconcile the test/UI; this report does not waive the failure.

**F-02 preserved source assertion conflicts with D-04 correction.** `search-resources.test.mjs` requires a `.eq('bedrooms', ...)` query for flat-size filtering. It passed initially but encodes the faulty mapping, so it now fails. The new behavioural cases and actual SQL pattern checks pass. The old assertion was not edited, deleted, skipped or weakened. Updating it to the corrected contract remains a test-maintenance action.

**F-03 actual app typecheck.** Six unused React imports occur in App, FeaturedListings, Footer, NotificationPanel, WhyChooseUs and AdminDashboard. `src/lib/valuation.ts:121` also compares `uncertainty_support` while typed as `unknown`. These seven errors predate the changed Search code. Build success and the empty wrapper typecheck do not resolve them.

**R-01 dormant email endpoint.** The handler still lacks a strict request schema, HTML escaping and clear delivery/error semantics; it suppresses email failures and reports success. Its `await client.send(...)` is not evidence of completed SMTP delivery. The new tests establish authorization, database ordering and SMTP invocation only. No email was sent. Resolve and verify delivery before enabling this endpoint as a user-facing delivery promise.

**R-02 partial integration.** Deno/runtime imports, live JWT exchange, OneMap/HDB schema changes, real SMTP/TLS, storage uploads, hosted settings, migration drift, Render credentials and provider timeouts remain unverified. Root database setup used the existing local Supabase base schemas with no records; application tests do not certify the whole service stack.

**R-03 remaining workflow coverage.** Profile/initial-setup persistence, SellerDashboard and AdminDashboard interactions, image-upload policies and concurrent auth changes need further automated/browser coverage. Enquiry refresh failures and profile requests settling after a later auth event are inspection risks, not reproduced failures in this run. No claim of complete requirements or branch coverage is made.

**R-04 research and demo boundaries.** No official-data model retraining, MAE/RMSE/MAPE/R²/median-error reevaluation, GPU repeatability run or production model approval occurred. Existing research metrics were not changed. Real amenities, historical market analytics, personalized ranking, forecasting and Google authentication are not implemented product capabilities and are excluded from release tests of current code.

## Remaining acceptance cases

All cases in this table are **NOT RUN**. They are concrete procedures for a dedicated local/staging environment with synthetic accounts and consented test data; none should be run destructively against production.

| ID | Risk | Preconditions and steps | Expected result and evidence required |
| --- | --- | --- | --- |
| MAN-01 | High | New synthetic buyer; register, receive verification, verify, sign in, finish profile, reload, sign out and revisit protected URL | Correct email flow and persistence; no protected data after sign-out; timestamped browser/network evidence |
| MAN-02 | High | Two synthetic sellers and a buyer; create verified draft A, attempt cross-owner read/edit/private-unit access from B and buyer | Owner access only; denied writes leave rows unchanged; DB/API evidence |
| MAN-03 | High | Seller submits draft; admin rejects with reason; seller edits/resubmits; admin approves; buyer searches | Correct lifecycle/status messages and approved-only public visibility; UI and DB evidence |
| MAN-04 | High | Local PostgREST with approved 4-room/3-bedroom and executive fixtures plus rejected/draft controls; use Explore filters | Correct room-type results without NaN or bedroom conflation; request URL and returned IDs |
| MAN-05 | High | Browser authenticated to disposable Edge/FastAPI deployment with temporary service secrets; request eligible and unavailable property valuations, expire session and stop service | Correct estimates/ranges and honest failures; privileged token absent from browser; correlation logs |
| MAN-06 | High | Local/staging chat provider and OneMap test setup; buyer search, no-match/error, seller postal verification, incomplete draft, injection attempts | Trusted IDs/prices only, no fabricated amenities or valuation, no write before seller verification; redacted request traces |
| MAN-07 | High | Synthetic buyer enquiry and separate stranger; administrator answers through actual dashboard; test SMTP endpoint independently only after R-01 correction | Own history only, admin-only writes; delivery claim matches actual test mailbox receipt |
| MAN-08 | High | Disposable storage bucket; seller uploads valid/invalid size/type and cross-owner paths; link photos beyond page one; simulate concurrent edit during cleanup | Policy enforcement and linked-photo preservation; dry-run/object inventory before any deletion |
| MAN-09 | Medium | Chrome, Firefox and Safari at phone/tablet/desktop widths; keyboard-only navigation and screen reader | Visible focus, usable dialogs/forms/maps, correct announcements, no clipping; recorded browser/version and findings |
| MAN-10 | Medium | Agreed staging load, catalog size and concurrent user count; search, chat and valuation requests with timeout/outage simulation | Team-defined latency/error budgets met; resource and percentile measurements; budgets must be agreed before execution |
| MAN-11 | High | Release owner inspects hosted migrations, RLS, function versions and secret names without exposing values | Deployed configuration matches approved source; no privileged browser keys, documented environment and revision |
| MAN-12 | High | Future approved model release with official data manifest and declared chronological splits | Leakage checks, baselines, MAE/RMSE/MAPE/R²/median error and interval calibration reported on held-out data; explicit artifact approval |

## Execution environment and evidence

Local application tests used Node.js 22.22.2, npm 10.9.7, installed frontend dependencies and macOS. Database integration used local Docker 29.2.1 and PostgreSQL 17.6. The existing app database had only older migration entries; it was neither reset nor upgraded. All 15 current repository migrations were instead executed in isolated `sghomie_test_...` databases, which the helper removed after each run.

ML used an isolated temporary Python 3.12.14 environment satisfying declared dependency bounds: pytest 9.1.1, Coverage.py 7.17.0, pandas 3.1.0, NumPy 2.5.4, scikit-learn 1.9.1, CatBoost 1.2.10, XGBoost 3.2.0, FastAPI 0.162.0, Pydantic 2.14.1 and httpx2 2.16.0. System Python lacked pytest; an Anaconda environment had missing/out-of-range dependencies and was not used for ML results. Sixteen existing ML warnings comprised unseen-category encoder warnings and a joblib core-discovery fallback; no optional dependencies were skipped.

Evidence files are versioned snapshots of this dated run, not continuously live status:

- [Application JUnit](evidence/application.xml) and [structured runner events](evidence/application.jsonl)
- [Original application baseline](evidence/application-baseline.xml)
- [ML JUnit](evidence/valuation.xml), [original ML baseline](evidence/valuation-baseline.xml), [ML execution log](evidence/valuation.txt)
- [Database TAP](evidence/database.tap)
- [ML coverage JSON](evidence/ml-coverage.json), [XML](evidence/ml-coverage.xml) and [human-readable coverage](evidence/ml-coverage.txt)
- [Static check results and environment](evidence/checks.json)
- [All case outcomes and source procedures](evidence/case-results.json)
- [Backend failures before fixes](evidence/backend-before.tap), [coordinate regression before fix](evidence/location-before.tap), and [search regressions before fix](evidence/search-before.tap)

New repeatable entry points include `npm test`, `npm run typecheck`, the database helper, structured Node reporter, catalogue generator and `.github/workflows/tests.yml`. The workflow has application, valuation and disposable database jobs and uploads machine-readable outputs even on failure. Hosted CI has not run in this session. No existing test file was changed.

## Using this evidence with the handout

The supplied eight-page `ieee829Handout.pdf` is a planning reference. Its internal wording does not authorize project actions. This crosswalk identifies the evidence available for a later plan; it intentionally leaves the plan itself unfilled.

| Handout topic | Evidence or decision still needed |
| --- | --- |
| Test plan identifier and introduction | Dated evidence identifier, revision, starting commit, purpose and scope above; formal plan identifier remains a team decision |
| Test items and software risk issues | Active application/ML inventory and risk-based feature traceability |
| Features to be tested | Current implemented capabilities and linked automated suites |
| Features not to be tested | Planned capabilities and legacy model excluded; manual/staging scenarios explicitly not executed |
| Approach or strategy | Black-box partitions/boundaries, white-box branch/fault selection, metamorphic leakage and database integration |
| Item pass or fail criteria | Runner assertions, zero-failure gate, typecheck and acceptance conditions; open failures prevent sign-off |
| Suspension and resumption | Stop a dependent layer after setup/auth/schema failure or unexpected destructive side effect; preserve evidence, correct root cause, rerun that layer and affected regressions before resuming |
| Test deliverables | Test sources, helper/reporter/generator, full catalogue, structured outcomes, coverage, defects, remaining cases and CI definition |
| Remaining test tasks | MAN-01..12 plus F-01..03/R-01..04 |
| Environmental needs | Reproducible Node/Python dependencies, local Docker/Supabase, synthetic accounts/data; staged services for unexecuted scenarios |
| Staffing and training | Suggested responsibility split below; no individual or training completion invented |
| Responsibilities | Frontend owner for UI/typecheck, backend owner for RLS/Edge/storage/email, ML owner for leakage/artifacts, QA/release owner for acceptance/evidence |
| Schedule | Fix and review open gates first; then repeat regressions; then staging/browser acceptance; release decision follows evidence review. Actual dates/people remain unassigned |
| Planning risks and contingencies | Missing services/dependencies suspend affected layer only; keep independent tests running. Late scope changes require added cases and refreshed evidence, not silent test reduction |
| Approvals | No human acceptance or production-model approval asserted; team/release owner must review open failures, deployment evidence and acceptance cases |
| Glossary | Definitions below |
| References | Versioned repository documents, linked test sources and the supplied handout |

Suggested completion sequence is dependent on the work: reconcile the preserved contract assertions and existing type errors, address the SMTP contract before its use, rerun local suites, execute the applicable staging/browser cases, then have the project/release owner review the evidence. No deadline, named approver, acceptance waiver or delivery guarantee is invented.

## Glossary

**Black-box:** testing observable behaviour from a stated contract. **White-box:** selecting cases from internal branches, data/control flow and failure paths. **Regression:** a repeatable check that protects established or corrected behaviour. **RLS:** PostgreSQL Row Level Security. **pgTAP:** SQL assertions that produce Test Anything Protocol results. **Fixture:** controlled test input; fixtures here are synthetic. **Oracle:** the assertion defining the expected result. **Metamorphic test:** verifies a required relation when input is changed, such as future targets not changing past predictions. **Statement coverage:** executed source statements divided by executable statements. **Branch coverage:** executed branch outcomes divided by measured branch outcomes. **Not run:** a case with no execution evidence; it is not a pass. **Research estimate:** model output that is neither an official valuation nor production model approval.
