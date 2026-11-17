# Planning session: the owner sets the final scope

_Editor's note: the owner declines the planner's first, larger proposal and sets the final scope and working rules. After the planner revises the plan, the owner adds six corrections before any implementation. One bullet is replaced by a marked redaction._

### Owner (feedback given when declining a proposed plan)

We have decided to revise and finalize the NCS assessment scope.

Keep the existing repository investigation, evidence, architectural
decisions and planning work. Do not restart the analysis unnecessarily.

My final preferred direction is to improve SGHomie through:

A. SGH-01 public seller-data protection.
B. SGH-02 HDB verification integrity.
C. Authentication and password-management improvements.
D. Level 1 automated periodic service monitoring.
E. Chatbot synthetic canary authentication repair, if feasible.

We are deferring:
- The runtime AI incident investigator.
- Telegram operational notifications.
- An AI investigation dashboard panel.
- Additional LLM frameworks.
- Homepage video and visual redesign.
- Unrelated marketplace features.

GENERAL RULES

Read and follow AGENTS.md and CLAUDE.md.

Investigate before implementing.
Use deductive reasoning grounded in existing code.
Apply Socratic questioning to genuinely unresolved decisions.
Challenge unsupported assumptions.
Do not ask questions already answerable from repository evidence.
Prefer simple, maintainable solutions.
Verify existing functionality before rebuilding it.
Preserve unrelated files and current workspace changes.
Maintain consistent formatting and terminology.

Do not stage, commit, push, merge, reset, switch branches,
deploy or alter hosted configuration without approval.

Do not expose secrets or security-sensitive findings.

SECURITY WORKSTREAM

For SGH-01:
- Inspect current table grants, RLS policies, queries and views.
- Propose a secure public/private listing data contract.
[one bullet omitted here; see the index]
- Preserve legitimate authenticated seller and buyer workflows.
- Provide actual database regression tests.
- Consider whether the fix affects the chatbot or property pages.

For SGH-02:
- Inspect all location-related verification triggers.
- Ensure verification cannot remain valid after an inconsistent
  address or location change.
- Consider the relationship to SGH-03 approval integrity.
- Test relevant edits and bypass attempts at the database level.

We will use the existing GitHub Actions disposable database
test workflow. Do not require local Docker or apply unverified
migrations to production.

AUTHENTICATION WORKSTREAM

The existing email verification flow has been tested successfully.
Do not rebuild SMTP or replace the email provider.

Implement:
- Confirm password.
- Show/hide password.
- Forgot password.
- Reset password through the supported Supabase flow.
- Authenticated change password.
- Correct errors, recovery navigation and expired-link handling.

Use the existing React and Supabase architecture.
Inspect relevant current official APIs and tests.
Avoid unnecessary packages or authentication abstractions.

MONITORING WORKSTREAM

Build Level 1 only.

Implement a small, independent Node/TypeScript monitoring runner
that can:

- Check Netlify frontend reachability.
- Check Render model readiness and expected version.
- Check an approved safe Supabase application endpoint.
- Apply timeouts and validate responses.
- Record timestamp, duration and observed status.
- Distinguish healthy, failed and unknown results.
- Generate a readable summary and structured JSON output.
- Run against synthetic test fixtures.
- Run locally and through GitHub Actions.

Design for configurable periodic execution.

Do not claim periodic monitoring is live until the workflow
has actually been enabled and observed running.

Remember that GitHub Actions scheduling runs on the default
branch. The assessment branch must be tested without disturbing
the existing production branches.

Do not add persistent alert state, Telegram or a runtime LLM
unless a concrete reason establishes that they are necessary.

CHATBOT CANARY

Investigate the current AUTH_FAILURE.
Do not assume the cause is known.

Fix it only if the required authentication mechanism can be
identified and safely tested.

Avoid weakening authentication or using privileged tokens
in an unsafe way.

ASSESSMENT REQUIREMENTS

We have approximately one day.

The deliverable must show meaningful new work, effective
AI coding-agent collaboration and clear engineering decisions.

Fable is the planner and architecture reviewer.
Sonnet Medium is the implementation agent.

Use small, test-first vertical slices.

Use existing installed planning, specification, TDD,
review and handoff skills where beneficial.

Preserve real planning decisions, test evidence, agent handoffs,
implementation changes and tradeoffs in planning/.

Do not fabricate agent mistakes or test results.

REQUIRED RESPONSE

1. Revise the existing plan to this scope.
2. Identify any contradictions or dependencies.
3. Give a realistic milestone order.
4. Define mandatory and conditional acceptance criteria.
5. Identify exactly which files/modules each slice may affect.
6. Specify the tests and CI gates for each slice.
7. Establish a stopping rule if time becomes constrained.
8. State how the monitoring output will be demonstrated.
9. Identify deployment implications and approval gates.
10. Prepare the first implementation handoff for Sonnet.

Be critical about feasibility.

Do not implement code yet.
Finalize the plan for my review and approval.

### Planner (Claude Fable) · 2026-11-16T08:50:55Z

_[tool: Glob — SGHomie/FrontEnd/{public/_redirects,netlify.toml,public/*}]_

### Planner (Claude Fable) · 2026-11-16T08:50:56Z

_[tool: Grep — _redirects|netlify\.toml]_

### Planner (Claude Fable) · 2026-11-16T08:50:57Z

_[tool: Read — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\MLPricePredictorV2\src\api\app.py]_

### Planner (Claude Fable) · 2026-11-16T08:50:58Z

_[tool: Read — <home>\Desktop\SC3040-Software-Engineering-Project\SC3040-Software-Engineering-Project\.github\workflows\tests.yml]_

### Planner (Claude Fable) · 2026-11-16T08:50:59Z

_[tool: Grep — glob|\.sql|plan\(]_

### Planner (Claude Fable) · 2026-11-16T08:51:00Z

_[tool: Grep — supabase\.from\('properties'\)|\.from\('properties'\)|detailed_location|location:|town:|built_year]_

### Planner (Claude Fable) · 2026-11-16T08:51:13Z

Revising the plan to your final five-workstream scope now; the earlier investigation carries over unchanged.

### Planner (Claude Fable) · 2026-11-16T08:52:30Z

_[tool: Write — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:28Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:31Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:34Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:39Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:40Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:44Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:48Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:50Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:53Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:55Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:55:58Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:00Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:03Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:05Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:09Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:11Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:13Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:15Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:18Z

_[tool: Edit — <home>\.claude\plans\pasted-content-id-63fb-sghomie-whimsical-seal.md]_

### Planner (Claude Fable) · 2026-11-16T08:56:19Z

_[tool: ExitPlanMode]_

_[turns between these two parts are omitted]_

### Owner · 2026-11-16T09:10:08Z

Before implementation, make these final adjustments:

1. **No automatic reverting or discarding work.** If a slice exceeds its time budget or fails CI, stop, document the status and let me decide whether to continue, defer or discard it. Follow AGENTS.md.

2. **Review GitHub push security.** Our existing Telegram workflow sends commit diffs to OpenRouter. Ensure that assessment branch pushes containing security migrations, tests or sensitive details are not transmitted to that workflow. Propose the safest minimal solution before the first push.

3. **Review SGH-02 coordinate integrity.** Confirm that when a seller legitimately reverifies a new HDB address, all relevant location fields and coordinates remain consistent. Add the necessary regression test. Do not create a situation where verification is updated but the map coordinates remain stale.

4. **Be precise about SGH-01.** The proposed migration restricts anonymous column access, but authenticated access remains unchanged. Clearly document the remaining privacy limitation and do not claim that all seller-data exposure has been resolved.

5. **Keep the scope realistic.** Prioritize the two security fixes, the basic monitoring runner and signup password UX. Forgot/reset password, authenticated password change and chatbot canary repair should proceed only if sufficient time remains. Do not rush security migrations or production deployment merely to meet a time box.

6. **Preserve deployment safety.** Database CI must pass before any hosted changes. Any deployment requires my explicit approval. If production deployment cannot be verified safely, document the repository implementation separately from hosted status.

Please incorporate these corrections into the existing plan without restarting the investigation. Then create the initial planning documents and prepare the S1 implementation handoff for Sonnet Medium.

Fable remains the planner and reviewer. Sonnet Medium is the implementer.

Do not implement application code, commit, push, merge or deploy yet. Present the finalized changes briefly, then await my authorization to begin S1.

_[end of excerpt]_
