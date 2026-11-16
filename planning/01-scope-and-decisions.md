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

### Update, 16 November 2026: phase 2 authorized

The five mandatory slices are committed and CI verified at `0c12329`. The owner then authorized the work below. Entries above are unchanged.

| ID | Decision | Reason |
| --- | --- | --- |
| D12 | The optional slices proceed: password policy and strength meter (A1), forgot and reset password (S5), authenticated password change (S6), chatbot synthetic check repair (B), monitoring completion (C), then submission documents (D). All work stays on `assessment/ncs-opspilot`. No release branch. | The owner chose to complete the worthwhile features before submission and intends to merge this branch into `main` after a final review. |
| D13 | One minimum password policy applies to sign-up, password reset and password change: at least 8 characters with a lowercase letter, an uppercase letter and a digit. It mirrors the hosted Auth setting reported by the owner. Sign-in does not apply it. | Supabase remains the final authority. Applying the policy at sign-in would lock out accounts created under the earlier setting. |
| D14 | The strength rating is an in-house, advisory estimate with no new dependency. It is labelled as an estimate and is not an authentication rule. | The component test harness stubs imports, so a library estimator would not be exercised by component tests, and the established libraries add large dictionaries to the bundle. |
| D15 | No real sign-up, reset email, provider call, function deployment, hosted setting change or authenticated browser session happens without the owner's approval at the time. | Deployment and hosted-data safety. |
| D16 | No password history. A user may return to a password used earlier, provided it meets the policy. Only a change to the current password is refused, and that refusal comes from Supabase. The `same_password` message reads "Your new password must be different from your current password." | Owner decision, 16 November 2026. The earlier wording implied a history rule that does not exist. |
| D17 | The password-change form asks for the current password and checks it before the update. The hosted settings "Secure password change" and "Require current password when updating" are both off (owner-reported) and are not changed by this work. | With the hosted setting off, the server does not check the current password, so the form must, or the field would be decorative. The check is client-side and is described as such. |

### Update, 17 November 2026: hosted Auth setting and Phase B

Entries above are unchanged. D17 describes the settings as they were on 16 November.

| ID | Decision | Reason |
| --- | --- | --- |
| D18 | The owner enabled the hosted setting "Require current password when updating". "Secure password change" stays off. The password policy is unchanged. | Owner action, reported 17 November 2026. The server now enforces what the change-password form previously checked only in the browser. |
| D19 | In a synthetic check result, `edge_reached` is true only when the response carries validated evidence that the chatbot handler answered. False means execution was not confirmed. It does not mean the function did not run. Stored results are not rewritten. | The flag was set for every non-OK response, so the dashboard claimed evidence it did not have. |
| D20 | The chatbot synthetic check's authorization is not changed until the hosted cause is confirmed and the owner approves a design. The service-role bearer is a hypothesis only. | Owner decision, 17 November 2026. |
| D21 | Scheduled deep canaries will not store the owner's personal administrator session token or an unrestricted service-role key in GitHub Actions. No scheduling change is made until Phase B is repaired, reviewed and verified on hosted. | Owner decision, 17 November 2026. |

### Update, 17 November 2026: chatbot synthetic check authorization (B2)

| ID | Decision | Reason |
| --- | --- | --- |
| D22 | `admin-monitoring` forwards the administrator's own session token to the chatbot function, which verifies the session and the administrator flag itself before any capacity reservation or provider call. The service-role key is no longer sent between the two functions. The internal-action header and the fixed prompt stay. | Owner decision. The hosted check is rejected before the chatbot function runs, while the valuation check, which forwards a session token, passes. The cause of the rejection is not established. This is the smallest change that needs no new secret or hosted setting. |
| D23 | Accepted trade-off: an administrator can call the route directly, and such a call is not written to `synthetic_canary_runs`. It still runs only the fixed prompt, reserves global provider capacity and appears in the chatbot function's log. No new rate limiting in this slice. | Owner decision. |
| D24 | The internal-action header is removed from the chatbot's browser CORS allow-list. CORS is not an authorization boundary; the administrator check is. | No browser code sends the header. |
| D25 | A passing hosted check after deployment will support the bearer explanation. It will not prove the original cause. | Owner decision on evidence wording. |

## Known limitation of the public listing fix

After the fix, anonymous callers can no longer read seller contact and private address fields. Any signed-in account still can, on approved listings, as the property details page does today. Registration is open, so this remains a real privacy limitation. This work does not claim that all seller-data exposure is resolved.

## Open items for the owner

- Approve the change in decision D6 before the first push.
- Read the hosted chatbot function's JWT verification setting and its logs for the failed synthetic check.
- Approve the monitored Supabase endpoint and supply the public Render service URL.
- Check the hosted Site URL and redirect allow-list before the reset-password flow is demonstrated.
