# Historical main merge verification — 28 October 2026

> **Historical evidence only:** This document records the 28 October 2026 `main` merge at `470748e508f8002f213cb48e0c05d4ead0fb44c7`. Its **640 independent cases: 638 passed and 2 failed** remain unchanged. These results are not the current `faheem` verification; see the [running tests guide](../../tests/README.md) for the supplied current snapshot.

Local `main` was fast-forwarded from `cb3f743` to **`470748e508f8002f213cb48e0c05d4ead0fb44c7`**, matching `origin/main`. The earlier testing work is preserved and compatible with the incoming changes. The merged local run contains **640 independent cases: 638 passed and the same 2 known assertions failed**. All **237 scenarios added in the earlier testing work remain covered**; all 85 added JavaScript scenarios pass by case name, all 116 added ML cases pass, and all 36 database cases pass under the current policy.

The [case catalogue for this run](test-case-catalogue-after-main.md) lists every merged-run case and outcome. The [initial report](test-report.md) and [original 580-case catalogue](test-case-catalogue.md) remain historical evidence of the pre-merge run. Available raw evidence and JSON were retained; the original valuation execution log was not retained in the repository. Catalogue links point to frozen source snapshots so upstream edits cannot change the procedures those results describe.

## Preservation and integration

The initial inspection found the earlier test files and reports still present, while the five source fixes and tracked test infrastructure edits were missing before the merge. A backup of untracked work was made before updating the branch. The following changes were restored after the fast-forward:

- Explore room type uses controlled listing-text patterns instead of treating `4 ROOM` as four bedrooms or `EXECUTIVE` as NaN.
- The enquiry reply handler validates the caller and administrator role before privileged enquiry or email work.
- Image cleanup gathers linked references from every ordered property page before deleting objects.
- Address verification rejects nonfinite or out-of-bounds coordinates before issuing a verification token.
- ML calibration validation rejects fractional years before integer conversion.
- Package test/typecheck commands, test-output ignore rules and README testing links are restored.

Incoming main also adds its own route tests and strengthens enquiry insertion. Both changes were retained:

| Integration point | Preserved result |
| --- | --- |
| Route filename collision | The five earlier `FE-ROUTE` scenarios live in `protected-route-contract.test.mjs`; main's `protected-route.test.mjs` remains intact |
| New route implementation | The five preserved cases use main's route harness and flush effect-based notifications; their loading, redirect, profile and content assertions remain |
| Stronger enquiry policy | `DB-07` now requires anonymous insertion to fail with `42501`; it follows main's authenticated-only policy instead of restoring the old anonymous-write expectation |
| Migration chain | All **16** repository migrations applied in the disposable test database |
| Upstream tests and changes | No incoming tracked test or upstream feature file was edited; restoration is limited to the earlier five source fixes and three tracked infrastructure files |
| Other user files | Both unrelated Word documents retain their backup hashes |

The working changes remain **uncommitted**, and nothing was pushed or deployed. No hosted data or service was changed. Temporary test databases were removed; the pre-existing local database migration history was left unchanged.

## Results after the merge

| Verification | Result |
| --- | --- |
| Application and backend JavaScript | **285 leaf cases: 283 PASS, 2 FAIL** |
| ML research, bundles and FastAPI | **319 PASS**, no failures or skips |
| Database RLS, triggers and SQL patterns | **36 PASS** after 16 fresh migrations |
| **Total** | **640 cases: 638 PASS, 2 FAIL** |
| Targeted preserved frontend plus incoming route cases | **69 PASS**, no failures |
| Lint | PASS, with the two existing React Refresh warnings |
| Wrapper `npx tsc --noEmit` | PASS; the wrapper has an empty file list and does not establish app type correctness |
| Actual `npm run typecheck` | FAIL with the same seven existing app errors |
| Production build | PASS, with the existing Analytics chunk-size warning |
| Whitespace and documentation links | PASS |

Node emits two additional parent-container completion events in the merged run. They are preserved separately in JSON and excluded from the 285 independent leaf cases in agreement with JUnit. The 60 additional JavaScript leaf cases come from the incoming main changes; they do not replace the earlier added scenarios.

The two known failures remain the auth button's exact-label assertion and the source assertion requiring the old bedroom filter. The seven app type errors remain six unused React imports and the `unknown` comparison in `valuation.ts`. Their causes and the outstanding browser/staging acceptance work are detailed in the [initial report](test-report.md#unresolved-failures-and-limitations). This merge does not waive those gates or establish a successful hosted CI run.

## Execution evidence

- [Application events](evidence/after-main/application.jsonl) and [JUnit](evidence/after-main/application.xml)
- [ML JUnit](evidence/after-main/valuation.xml); the original execution log is not retained in the repository
- [Database TAP](evidence/after-main/database.tap)
- [Actual app typecheck output](evidence/after-main/app-typecheck.txt)
- [All outcomes, source procedures and evidence hashes](evidence/after-main/case-results.json)

Use the [running guide](../../tests/README.md) to repeat the checks. The original coverage measurement remains attached to its original run; branch coverage was not remeasured during this merge verification. Browser, hosted service, SMTP delivery and production-model approval limitations are unchanged.
