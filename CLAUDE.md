
@AGENTS.md

# Claude Code Assessment Instructions

## Model responsibilities

The higher-capability planning model is responsible for:
- Repository investigation
- Architecture and specification
- Challenging design assumptions
- Reviewing implementation decisions
- Independent final review

Sonnet Medium is responsible for:
- Implementing approved vertical slices
- Writing and executing focused tests
- Fixing verified issues
- Updating progress and test evidence

Do not assume that changing the model automatically transfers
responsibility or delegates work. Use explicit handoffs.

## Assessment context

Work on the existing SGHomie project in the
assessment/ncs-opspilot branch.

Read the applicable planning documents before implementation.

Separate existing functionality from new assessment work.
Do not deploy, stage, commit, push, merge, or change branches
without explicit authorization.

Use synthetic data and non-production environments for
security-sensitive tests.

Keep all assessment planning and handoff artifacts under
planning/.

Never invent completed tests, agent mistakes, measurements,
deployments, or development history.
