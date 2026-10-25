# SG Homie deployment runbook

**Initial version: 2026-10-26.** This is a living operations guide. It describes repository configuration and expected service ownership, not proof of any current hosted deployment. Confirm each target project, branch, secret set, migration history and release in its hosting control plane before acting.

## Service ownership and status

| Service | Source and expected owner | Repository evidence | Hosted status |
| --- | --- | --- | --- |
| Frontend | `SGHomie/FrontEnd/` → Netlify; expected production branch `main` | React/Vite frontend; this repository has no Netlify deployment configuration | **Deployment-dependent / not verified.** Confirm the linked repository, production branch, build command, publish directory and environment variables in Netlify. |
| Auth and PostgreSQL/RLS | Supabase project | `SGHomie/BackEnd/supabase/config.toml`, migrations and Edge Functions | **Deployment-dependent.** Repository state does not show which project is linked, which migrations are applied, or which policies are hosted. |
| Edge Functions | Supabase Functions | `SGHomie/BackEnd/supabase/functions/` | **Explicit deployment required.** A Git merge does not deploy function code. Verify each function version in Supabase. |
| Valuation API | Render FastAPI service | Root `render.yaml` points to `MLPricePredictorV2/`, uses `/health`, pins the research bundle, sets `branch: faheem`, and has automatic deployment off | **Deployment-dependent.** The checked-in branch differs from the requested Netlify production branch expectation. Confirm Render’s linked branch and deployed commit in its dashboard. |

The valuation API is a research/demo service, not an approved production valuation system. Its `/health` endpoint reports minimal model readiness only; do not interpret it as an end-to-end application health check. See the [valuation service documentation](../../../MLPricePredictorV2/README.md) and the [Supabase serving notes](../../BackEnd/supabase/README.md).

The expected frontend workflow is for merges to the configured Netlify production branch (`main`) to trigger a frontend deployment. This trigger and branch are **Deployment-dependent** and cannot be confirmed from repository configuration; verify them in Netlify before relying on that workflow.

## Before a release

1. Confirm the intended repository, branch, commit and target environment. Check Netlify, Supabase and Render separately; never infer hosted state from Git.
2. Review the diff and run the relevant frontend, Edge Function and valuation checks locally. Keep generated valuation data and secrets out of the commit.
3. For Supabase schema work, compare local and linked migration history and preview pending changes before applying them:

   ```bash
   supabase migration list --linked
   supabase db push --dry-run
   ```

4. Review each migration and verify the linked project reference before an approved application. For a separately approved migration apply, use the documented `supabase db push --linked` workflow. Deploy Edge Functions explicitly and verify their versions after deployment:

   ```bash
   supabase functions deploy <function-name>
   ```

### Phase 3 chatbot quota rollout

The repository migration `20261026130000_chatbot_quotas_and_capacity.sql`
creates protected quota configuration, tier assignments and bounded usage
state. Review the migration and linked history, then apply it only through the
approved migration process above. Deploy the `chatbot` Edge Function after the
migration. The global reservation path uses Supabase's server-side
`SUPABASE_SERVICE_ROLE_KEY`; never add that key to Vite variables, client code,
or operator transcripts. Do not broaden RPC/table grants to make a deployment
work. The user RPC derives identity from the caller JWT; the provider-capacity
RPC remains `service_role` only.

After deployment, verify in Supabase that the migration is applied, the
`chatbot` function version contains the quota code, and no privileged key was
added to frontend environment settings. Use the trusted tier-assignment SQL in
the [Supabase setup guide](../../BackEnd/supabase/README.md) to promote a
project test account and delete its assignment to return it to standard.
Configuration edits must use a trusted database operator; ordinary accounts
must not be given table write access.

Use non-production test accounts for acceptance checks. Confirm standard burst
and daily denials, tester's higher limits, privileged's uncapped user daily
limit with bounded burst, repeated-burst cooldown and expiry, and anonymous
deterministic onboarding with no quota use. Verify Explore, Property Details,
Profile, Enquiries and authorized seller features after chat denial. To check
global denial safely, lower the application capacity in a non-production
database and invoke the chatbot; do not exhaust the provider account. Restore
the documented capacity values after the check. For database concurrency,
issue simultaneous user reservations with the same authenticated test JWT at
one below the configured burst limit and verify at most one succeeds; invoke
the service-only global reservation only from a secured test function. These
checks are post-deployment procedures, not evidence that hosted state has
already been verified.

5. Deploy the frontend using the configured Netlify workflow only after verifying its current production branch, build and publish settings. Those settings are not represented in this repository.
6. The Render Blueprint has `autoDeployTrigger: 'off'`; follow the approved Render deployment workflow. Check the expected model version and `/health` after any release. Do not copy secrets into a shell transcript, source file or Vite variable.
7. Verify the deployed frontend, auth, Edge Functions, database access and valuation path in the intended environment. Record what was actually checked and what remains unverified.

## Safety and rollback

- Git merge does not automatically deploy every service. Supabase Edge Functions and migrations are separate operations; Render auto-deployment is disabled in the current Blueprint.
- Never run `supabase db reset` against a hosted project. It is for an explicitly local development database only. Do not edit an applied migration; use a new migration for schema changes.
- Stop if the linked Supabase project, branch, pending migration, service or environment is ambiguous. Resolve drift before applying changes.
- Keep Supabase service-role keys, provider keys, OneMap credentials, Render service tokens and artifact-release credentials in the appropriate server/hosting secret store. `VITE_*` values are browser-visible and must contain only values designed for public use.
- If a release fails, use the hosting platform’s reviewed rollback or redeployment path for that service. For schema changes, use a reviewed forward-fix migration where needed; do not reset production data to roll back.
- After rollback or recovery, verify the affected service and related integrations independently. Record the deployed version/commit and evidence; do not claim recovery based solely on a successful build.

## Verification record

For each release, record date, environment, source commit, services changed, migration/function/model versions, checks performed, observed result, rollback decision and unresolved follow-up. Redact project credentials, user data and request secrets from the record.
