# Planning session: the owner reports hosted test results

_Editor's note: two messages in which the owner reports results of tests the owner ran by hand against hosted Supabase Auth, and gives instructions for the next slice. No agent ran or observed these tests._

### Owner

S5 is now successfully tested end to end.

I received the real Supabase recovery email, opened the reset form on localhost, updated the password, saw the success page and successfully signed in using the new password.

The A1 and S5 commit has been pushed to `assessment/ncs-opspilot`, and GitHub CI passed.

Please record these results in the existing planning evidence.

I also want to clarify the password reuse policy before implementing S6.

**Password reuse requirements**

Users should be permitted to reuse passwords they previously used, provided the password meets our existing Supabase requirements of at least eight characters, including lowercase, uppercase and digits.

For example:
1. Change from password X to Y: allowed.
2. Change from Y back to X: allowed.
3. Change from X to X: Supabase may reject this because it is already the current password.

Do not implement historical password tracking or a password history restriction.

I noticed the current ResetPassword component says "Choose a password you haven't used for this account" for the `same_password` error. That wording is misleading.

Please have Sonnet Medium change it to:

"Your new password must be different from your current password."

Update the corresponding tests.

**Next: S6 Authenticated Change Password**

Prepare the focused S6 handoff and proceed with Sonnet Medium implementation.

Add a Change Password section to the existing Profile page, reusing our password requirements, strength indicator, confirm-password validation and show/hide functionality.

Keep Supabase Auth as the authoritative password validator.

Review the two hosted settings, Secure password change and Require current password when updating, which are currently disabled. Do not change either without my approval.

Ensure the S6 flow is secure, handles session and authorization errors, and does not interfere with the successful S5 recovery workflow.

Add focused regression tests, run the relevant test suites and use Playwright for safe browser verification where possible.

If practical, test X → Y → X using a dedicated synthetic account, without exposing passwords, credentials or recovery tokens.

Have Fable independently review Sonnet's changes and provide the exact files changed, observed tests, limitations and recommended commit message.

Continue working only on `assessment/ncs-opspilot`.

Do not stage, commit, push, merge, deploy, change Supabase settings or run migrations without my approval.

### Planner (Claude Fable) · 2026-11-16T14:57:51Z

_[tool: Bash — Record owner-reported S5 results and add password reuse and change-password decisions]_

### Planner (Claude Fable) · 2026-11-16T14:58:24Z

_[tool: Write — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\planning\handoffs\08-s6-change-password.md]_

### Planner (Claude Fable) · 2026-11-16T14:58:28Z

_[tool: Agent — Implement S6 change password]_

_[turns between these two parts are omitted]_

### Owner · 2026-11-16T16:40:54Z

_[image omitted]_

_[image omitted]_

_[image omitted]_

_[image omitted]_

_[image omitted]_



We have completed Phase A of the SGHomie NCS assessment, including S4, A1, S5 and S6.

The latest commit is `1f8904f` on `assessment/ncs-opspilot`.

I have manually verified the authentication workflows against real Supabase Auth using a synthetic account:

- Password registration guidance, confirmation and visibility work.
- Forgot Password sends a real recovery email.
- Reset Password successfully changes the password.
- Signing in with the updated password works.
- Authenticated Change Password on the Profile page works.
- The current-password and new-password validation behave correctly.
- Supabase's Require Current Password setting is now enabled.
- Secure Password Change remains disabled.
- The existing eight-character, lowercase, uppercase and digit policy remains unchanged.

Please record these as user-observed hosted Auth integration tests, not Playwright-executed tests, unless Playwright independently verified them.

Do not repeat the entire authentication implementation or reopen completed design decisions.

**NEXT TASK: PHASE B, CHATBOT SYNTHETIC CANARY AUTHENTICATION REPAIR**

The existing Admin Monitoring dashboard has a synthetic chatbot check that previously returned AUTH_FAILURE.

I want to diagnose and repair this properly, not bypass authentication or merely suppress the failure.

**1. Investigate the current implementation**

Read the relevant existing files, especially:

- `SGHomie/BackEnd/supabase/functions/admin-monitoring/index.ts`
- `SGHomie/BackEnd/supabase/functions/chatbot/index.ts`
- `SGHomie/BackEnd/supabase/functions/chatbot/syntheticCanary.ts`
- `SGHomie/BackEnd/supabase/config.toml`
- Relevant admin monitoring and chatbot tests.

Trace the entire request path from the admin dashboard, through admin-monitoring, to the chatbot Edge Function and its AI provider.

Inspect the authorization headers, JWT validation, service-role usage, gateway behavior, response classification and persistence.

Distinguish what the code establishes from what the deployed environment actually does.

**2. Diagnose the hosted AUTH_FAILURE**

I will provide the hosted chatbot Verify JWT setting and relevant redacted logs if needed.

Use read-only inspection where possible.

Determine whether the failure comes from:
- The Supabase Edge Function gateway.
- An incorrectly configured hosted Verify JWT setting.
- A mismatch in the internal authorization mechanism.
- A difference between deployed and repository code.
- Another actual cause revealed by evidence.

Do not assume the existing service-role credential or the hosted configuration is necessarily the problem.

Do not modify hosted function settings without asking me.

**3. Design the smallest secure repair**

Preserve these security properties:

- Only an authorized SGHomie administrator can initiate the synthetic check.
- An ordinary user cannot invoke the privileged synthetic route.
- No service-role key or private provider key is exposed to the browser.
- The fixed synthetic prompt cannot be replaced with arbitrary user-supplied content.
- No unnecessary raw prompt, generated response, password or token is persisted.
- Provider calls respect quotas and existing capacity safeguards.
- A gateway-level rejection is not incorrectly reported as proof that application code executed.
- Monitoring results accurately distinguish authentication failures, provider failures, timeouts and valid responses.

Do not disable authentication globally or weaken existing authorization to make the check pass.

**4. Implement and test**

Have Sonnet Medium implement the approved minimal fix with test-first development.

Add regression tests for:
- Authorized admin invocation.
- Unauthorized user rejection.
- Missing or invalid internal authorization.
- Correct failure classification.
- Successful synthetic response validation.
- Provider failure and timeout handling.
- No leakage of credentials or sensitive response content.

Run the focused tests, full Node suite, lint, typecheck and build, as applicable.

Have Fable independently review the implementation.

Do not claim the hosted canary is fixed until a real deployed check has succeeded.

**5. Prepare the hosted verification plan**

If Edge Function deployment is necessary, identify exactly which functions need deploying, their relevant JWT verification configuration, deployment dependencies and safe rollback steps.

I will explicitly authorize any deployment.

After deployment, the acceptance criterion is that the admin dashboard's Chatbot Synthetic Check returns a successful result with evidence that the Edge Function and AI provider were reached, and the expected fixed response was validated.

Do not run repeated live provider checks unnecessarily.

**6. Documentation and reporting**

Continue using the existing `planning/` structure.

Create a focused Phase B handoff for Sonnet, preserving prior decisions and historical evidence.

Record:
- Original observed failure.
- Confirmed root cause, or unresolved alternatives.
- Tests that actually ran.
- Security design decisions.
- Fable's review.
- Remaining hosted verification requirements.

Provide a recommended conventional commit message and exact files to stage.

Do not stage, commit, push, merge, change hosted settings or deploy without my approval.

**7. After the chatbot canary repair**

Prepare Phase C, finishing service monitoring.

The current S3 monitor checks basic frontend availability, Render model readiness and public chatbot onboarding. It does not yet perform real valuation or AI chatbot synthetic checks.

I want to configure its live targets, verify a real run and investigate safely scheduling deeper canaries less frequently than the lightweight checks.

Prefer existing infrastructure and minimal changes. Consider simple enable/disable configuration and quota controls.

Do not introduce a runtime LLM investigator, Telegram alerting or a new admin dashboard panel.

**Start now**

First inspect the chatbot authentication path and identify exactly what deployed configuration or logs you need from me.

Then prepare the Sonnet Medium implementation handoff and proceed with local fixes where the evidence supports them.

Avoid a new broad planning cycle. Keep implementation focused, and do not perform hosted operations without authorization.

_[end of excerpt]_
