# Retrospective

Written by the planning model, from the records in this folder. Every item below points to where it was recorded at the time. Nothing here is reconstructed from memory alone.

## What worked

- **One handoff per slice.** Each implementing run started from a short brief with named files, a test list and a stop rule. Reviews stayed small because each diff matched one brief.
- **Tests first, with the red run kept.** For the database slice the planner predicted 7 failing and 31 passing assertions before CI ran, and CI matched ([05](05-review-findings.md), S1 step 1).
- **Stop rules.** The implementer stopped three times when an existing test would have had to change (S4, A1, S6), and the planner or owner decided. No test was weakened to get a pass.
- **Independent re-runs.** The reviewer re-ran the suite, lint and typecheck for each slice from S4 onward, and recorded which checks were only reported by the implementer.
- **The owner's gates.** Every commit, push, deployment and hosted setting change was done by the owner. Hosted evidence came from the owner's own inspection.

## What went wrong

### Planner errors

| Error | Found by | Effect | Record |
| --- | --- | --- | --- |
| Monitor handoff treated every server error as a failure | Planner's own review | A waking free-tier service would have been reported as an outage. The owner chose the corrected rule. | [05](05-review-findings.md), S3 finding 1 |
| One condition for a "strong" rating in the handoff could never be false | Planner's review | Rule replaced. A separate gap, a common word inside a longer password rated strong, was fixed in the same round. | [05](05-review-findings.md), A1 review, findings 3 and 4 |
| Meter design hid the rule checklist when the field was empty | Planner's review | Checklist made always visible | [05](05-review-findings.md), A1 review |
| Reset-password handoff said a network failure is thrown | Implementer, reading the client source | Both cases handled | [05](05-review-findings.md), S5 |
| Reset design treated any link error on any page as a reset error | Planner's review | Would have mislabelled an expired sign-up link. Limited to the reset page. | [05](05-review-findings.md), S5 |
| Change-password handoff missed a third test harness | Three failing tests | One approved line | [05](05-review-findings.md), S6 finding 1 |
| The detailed S1 handoff was pushed earlier than the disclosure rule intended | Planner | Limited extra exposure. No history rewritten. | [05](05-review-findings.md), S1 process note |
| First explanation of the chatbot failure was a hosted setting that differed from the repository | Owner's screenshots | Ruled out. The plan was reworked. | [04](04-test-evidence.md), Phase B |
| Browser script mistakes during the reset-page check (a navigation that did not reload, a missed link lookup) | Planner | Cases re-run correctly | [04](04-test-evidence.md), S5 |

### Implementer errors and limits

| Item | Found by | Record |
| --- | --- | --- |
| A survey claimed the chatbot listing search runs for visitors who are not signed in | Planner, reading the handler | [05](05-review-findings.md), L0 |
| A database test called a helper as a role that might not be allowed to execute it | Planner's review | [05](05-review-findings.md), S2 finding 1 |
| Statements about Supabase Auth server behaviour came from a summarising fetch of upstream source and were not checked on hosted | Stated by the implementer | [04](04-test-evidence.md), S6 |

The implementer also caught a real defect in the planner's S1 design before it shipped: a verified listing with no stored detailed location would have had every ordinary save rejected ([05](05-review-findings.md), S1 step 2).

### Corrections that came from the owner

- The wording of one error message implied a password history rule that did not exist (D16).
- The chatbot plan assumed a cause. The owner required the cause to stay open until evidence settled it, required the authorization options to be compared, and required proof that the administrator flag is protected before it was relied on (D20, D22).
- The rollback plan assumed a Git commit matched the deployed functions. The owner required the deployed versions to be identified first ([handoff 12](handoffs/12-b2-deployment-and-rollback.md)).

## The weakest part

**The chatbot synthetic check.** Three slices went into it, and the owner has now seen it pass on hosted. It is still the weakest part:

- The original rejection was never explained. The repair replaced the one request property that differed from a working check. The pass supports that explanation without proving it.
- The check depends on a free model router that picks a different model per request. One passing run shows that execution, not reliability.
- It took three rounds, because the first plan carried an unverified explanation and the second repair exposed a validation rule too strict for the models actually served.

Second weakest: **nothing new is on the live site or the hosted database.** The two data fixes are CI verified only. The monitor has not made a configured live run on record.

## What was cut, and why

See [01-scope-and-decisions.md](01-scope-and-decisions.md). In short: the AI incident investigator, alerting, stored alert state and scheduled deep canaries were cut for time and testability. The data-exposure fix was limited to visitors who are not signed in, because changing what registered users see is a product decision.

## What I would do differently

- Ask for the hosted logs of the failing check before writing any plan for it. The first day carried an unverified explanation for hours.
- List every test harness that imports a changed file in the handoff, by searching, not from memory.
- Put the browser check in the handoff as a named step with its own evidence table, so "not seen in a browser" is never the default.

## Future work

1. Apply and verify the two database migrations, after the frontend change they depend on is live.
2. Configure the monitor's live targets and observe a scheduled run.
3. Deep canaries on a slower schedule, with a credential that can only start the two fixed checks and with provider quota limits ([handoff 11](handoffs/11-c-monitoring-preparation.md)).
4. Stored results for scheduled checks, repeated-failure thresholds, and severity and recovery handling on the existing `system_alerts` table.
5. Deduplicated operational notifications for warnings, critical alerts and recoveries.
6. Possibly a bounded AI investigator that summarizes sanitized incident evidence and suggests next steps for a person to approve. It was cut for cost, false positives, reliability and security. An agent that changes production on its own judgment is a risk this project does not need.
7. Further hardening: broader listing privacy rules, rate limiting or a challenge on public forms, and auditing of administrator actions.
