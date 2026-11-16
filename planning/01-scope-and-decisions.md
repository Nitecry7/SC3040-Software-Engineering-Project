# Scope and decisions

## Final scope

About one day of implementation time is available.

| Priority | Workstream | Status |
| --- | --- | --- |
| Mandatory | SGH-02: HDB verification integrity | Planned |
| Mandatory | SGH-01: public listing data protection | Planned |
| Mandatory | Level 1 service monitoring runner | Planned |
| Mandatory | Sign-up password experience: confirm and show or hide | Planned |
| Conditional | Forgot and reset password | Only if time remains |
| Conditional | Authenticated password change | Only if time remains |
| Conditional | Chatbot synthetic check authentication repair | Only if the cause is identified |

## Deferred

- Runtime AI incident investigator and any AI dashboard panel.
- Telegram operational alerts and persistent alert state.
- Additional LLM frameworks.
- Listing approval integrity, rate limits on valuation and address lookup, admin action auditing, multi-factor authentication.
- Homepage, marketplace and other unrelated product work.

## How the scope changed

The scope was revised twice during planning on 16 November 2026. Each revision came from the repository owner after reviewing the planner's analysis.

1. **Initial brief.** Three workstreams, with an operations assistant ("OpsPilot") as the primary contribution: scheduled checks, incident deduplication, Telegram alerts and an AI investigator with read-only tools.
2. **First revision.** With one day available, the owner asked for a critical comparison of security and authentication hardening against monitoring automation, without a runtime LLM. The planner recommended monitoring automation alone, because the database security work could not be tested locally.
3. **Final revision.** The owner chose a combined scope led by the two security fixes, accepting CI-only database testing, and kept monitoring at Level 1.

## Decision log

| ID | Decision | Reason |
| --- | --- | --- |
| D1 | No runtime LLM in the assessment contribution. | The assessment does not require one. Deterministic checks are easier to test and explain in one day. |
| D2 | Database changes are tested only in the CI `database` job. | Docker is unavailable locally and the owner chose not to install it. |
| D3 | Work runs in two lanes on disjoint files: a database lane and a local lane. | Serial execution of the full scope needs about 14 hours. The lanes cannot collide because one writes only new SQL files. |
| D4 | The verification integrity fix runs before the public listing fix. | It is smaller and touches no application readers, so it proves the CI loop before the larger change depends on it. |
| D5 | Nothing is reverted or discarded automatically. On a missed budget or failed CI run, the agent stops, records status, and the owner decides. | Repository rules forbid discarding work without the owner's request. |
| D6 | Before the first push, the push-notification workflow is limited so that it does not run for `assessment/**` branches. | That workflow sends each push diff to an external provider. Security migrations and tests should not be transmitted that way. |
| D7 | The public listing fix restricts anonymous access only. Access for signed-in accounts is unchanged. | Changing what registered users may see is a product decision and touches several working features. See the limitation below. |
| D8 | The monitoring runner is plain Node `.mjs`, with no stored state. | It matches the existing canary script and adds no second TypeScript project. |
| D9 | Scheduled monitoring is not claimed as live. | GitHub runs scheduled workflows only from the default branch. |
| D10 | The CI `database` job must pass before any hosted database change. Every deployment needs the owner's explicit approval. | Deployment safety takes priority over the time budget. |
| D11 | Security findings are described generically in committed files until fixes are live. | The repository is public and the hosted site is not yet fixed. |

## Known limitation of the public listing fix

After the fix, anonymous callers can no longer read seller contact and private address fields. Any signed-in account still can, on approved listings, as the property details page does today. Registration is open, so this remains a real privacy limitation. This work does not claim that all seller-data exposure is resolved.

## Open items for the owner

- Approve the change in decision D6 before the first push.
- Read the hosted chatbot function's JWT verification setting and its logs for the failed synthetic check.
- Approve the monitored Supabase endpoint and supply the public Render service URL.
- Check the hosted Site URL and redirect allow-list before the reset-password flow is demonstrated.
