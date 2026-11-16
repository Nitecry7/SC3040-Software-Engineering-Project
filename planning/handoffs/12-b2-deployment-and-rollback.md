# Note 12: B2 deployment and rollback

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Repository owner |
| Date | 17 November 2026 |
| Status | Prepared. Nothing here has been run against the hosted project. Every hosted step needs the owner's approval at the time. |

## What is deployed now (owner-reported)

| Function | Version | Deployed | Verify JWT |
| --- | --- | --- | --- |
| `chatbot` | 42 | 31 October 2026 | Off |
| `admin-monitoring` | 8 | 31 October 2026 | Not yet confirmed; `config.toml` says on |

## What changes

| Function | Change | Deploy needed |
| --- | --- | --- |
| `chatbot` | The synthetic check route verifies an administrator session instead of comparing a key. One header leaves the CORS allow-list. | Yes |
| `admin-monitoring` | Forwards the caller's session token to the chatbot. Logs the upstream status. Carries the B1 evidence-flag fix. | Yes |
| Every other function | None | No |

No migration, secret or hosted setting is involved. The B1 dashboard wording is in the frontend and reaches the site only when the frontend is deployed; the check itself does not depend on it.

## Rollback copies

Two sources. Prepare the first before any deployment.

1. **Downloaded from hosted (authoritative).** With the Supabase CLI linked to the project, download both functions into a new folder outside the repository. Check the exact syntax with `supabase functions download --help` first; in current CLI versions it is `supabase functions download chatbot` and `supabase functions download admin-monitoring`. This reads from hosted and changes nothing there. Confirm that the download includes the `_shared` files each function imports.
2. **Exported from Git (prepared, 17 November 2026).** The folder `sghomie-rollback-d520b64`, next to the repository folder, holds the functions directory and `config.toml` as they were at commit `d520b64` of 31 October: 24 files, including both functions and `_shared`. By Git history the chatbot folder has not changed since that commit, and `admin-monitoring` has changed only by the B1 edit. This copy is from Git, not from hosted. It has not been compared with the deployed code.

Before deploying, compare the two copies for `chatbot/`, `admin-monitoring/index.ts` and `_shared/`. If they differ, stop: the hosted code is not what the repository assumes, and the difference must be understood first.

Dependencies: the functions import `npm:@supabase/supabase-js@2.114.0` with a pinned version and have no import map or lock file in the repository. A redeploy resolves that version again at deploy time.

## Order

1. Confirm `admin-monitoring`'s hosted Verify JWT is on. Deploying applies `config.toml`, which sets chatbot off and `admin-monitoring` on.
2. Deploy `chatbot`.
3. Send one ordinary signed-out chat message on the site, or check the public onboarding reply, to confirm normal chat still works. This makes no provider call.
4. Deploy `admin-monitoring`.
5. Open the admin dashboard and confirm it loads.
6. Run the Chatbot Synthetic Check once. This makes one provider call.

## Compatibility between steps

| State | Synthetic check | Everything else |
| --- | --- | --- |
| New chatbot, old `admin-monitoring` (between steps 2 and 4) | Fails, as it does today | Unchanged |
| Old chatbot, new `admin-monitoring` (if the order were reversed, or after a chatbot-only rollback) | Fails | Unchanged |
| Both new | Expected to pass; not yet known | Unchanged |

Ordinary chat does not use the changed route, so neither order affects users. The chatbot goes first so that the administrator check exists before anything sends it a session token.

## Acceptance

The dashboard shows Passed, with a provider and a model, and "Synthetic check passed". The chatbot function's log shows one `synthetic_chatbot_canary` event at that time.

A pass supports the explanation that the bearer was the difference. It does not prove the original cause.

## If it still fails

Do not rerun repeatedly. Read the `synthetic_canary` event in the `admin-monitoring` log: `upstream_status` gives the HTTP status. Check whether the chatbot function recorded an invocation.

- No invocation and 401 or 403: the bearer was not the cause. The remaining differences are the custom header and the platform's handling of this function.
- An invocation with 404: the administrator check refused the session. Check the account's `is_admin` flag.
- Any other result: record it and stop.

## Rollback

1. Redeploy `admin-monitoring` from the rollback copy.
2. Redeploy `chatbot` from the rollback copy.
3. Confirm ordinary chat and the admin dashboard.

Rolling back returns the synthetic check to its current failing state and affects nothing else. It creates new version numbers; hosted does not return to versions 42 and 8 by number.
