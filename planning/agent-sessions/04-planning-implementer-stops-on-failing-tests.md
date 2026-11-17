# Planning session: the implementer stops on failing tests (change password)

_Editor's note: the implementer finishes the change-password form, finds three existing tests failing in a file it was not allowed to edit, and stops. The planner reviews, approves a one-line fix, and re-runs the checks itself. The implementer's own run is in file 11._

### Implementer report (Claude Sonnet), delivered to the planner

STATUS: implementation done and focused tests green, but the full `npm test` has 3 failures caused by my change in a test file the handoff does not allow me to edit. I stopped there, as instructed. Nothing was staged, committed or reverted.

#### Blocker (needs your decision)
`SGHomie/tests/auth-context-profile-dedupe.test.mjs` is not on the allowed list. It has its own Profile harness (`profileHarness`, ~line 173) whose module map rejects unknown imports. Profile.tsx now imports `../components/ChangePasswordForm`, so these 3 existing tests fail:
- `Profile sign-out success shows only the appropriate notification`
- `Profile sign-out returned-error shows only the appropriate notification`
- `Profile sign-out rejection shows only the appropriate notification`

Error for each: `AssertionError: Unexpected import: ../components/ChangePasswordForm`.

Proposed fix, one line in that file's `modules` map: `'../components/ChangePasswordForm': { default: () => null },`. I have not applied it, so I have not seen these 3 pass. Please approve it, or tell me to use another approach. I found no way to avoid it, because any import in Profile.tsx is rejected by that harness.

#### Investigation answers
Sources are the installed client (`node_modules/@supabase/auth-js/src/GoTrueClient.ts`, `lib/types.ts`) and the supabase/auth server source on GitHub master (`internal/api/user.go`, `internal/models/user.go`, `internal/models/sessions.go`). I read the server source through a summarising fetch tool, so some quotes are paraphrased. Master may differ from the deployed hosted version. Context7 was not used.

1. **`current_password` with the setting off:** ignored, no error. The server reads it only inside `if config.Security.UpdatePasswordRequireCurrentPassword { ... }`. The client type `UserAttributes.current_password` is documented as needed "when GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD is true". So I send `{ password, current_password }` as designed.
2. **Recovery sessions with the setting on:** exempt. The check is wrapped in `if !session.IsRecovery()`. `IsRecovery()` loops over the session's AMR claims and returns true for a recovery method. The owner can turn the setting on without breaking S5. I could not see how `ParseAuthenticationMethod` maps strings, so I did not confirm the exact AMR value, only that the exemption exists.
3. **"Secure password change":** if `session == nil` or the session is more than 24h old (`now.After(session.CreatedAt.Add(24h))`), the request must carry a `nonce`. Without it the server returns HTTP 400 with code `reauthentication_needed` ("Password update requires reauthentication"). The form maps that code to the specified message. Because step 4 `signInWithPassword` creates a brand-new session, the 24h condition does not trigger for this form. A fresh recovery session is also inside the window.
4. **Other sessions:** yes. `UpdatePassword(tx, sessionID)` calls `Logout` (all sessions) when `sessionID` is nil, otherwise `LogoutAllExceptMe` (comment: "log out user from all other sessions"). It does not depend on any config setting. The extra client `signOut({ scope: 'others' })` is therefore largely redundant, though harmless. I kept it per the design. One effect to know about: step 4 replaces the local session with a new one, and the old session is revoked by the update. If the update fails after step 4, the previous server session is left alive until it expires.
5. **`signOut({ scope: 'others' })` in the installed client:** `_signOut` calls `removeCurrentSession()` only when `scope !== 'others'`. It emits no `SIGNED_OUT` locally. The client docs say "If using `others` scope, no `SIGNED_OUT` event is fired!" So the design call is safe and I included it.
6. **`signInWithPassword` for the signed-in user:** it calls `_saveSession` and then `_notifyAllSubscribers('SIGNED_IN', session)`. There is no `SIGNED_OUT`. In the `AuthContext` handler (lines ~196-220), the same registered user with `!profileLoadingRef.current` takes the early-return branch: `setAuthLoading(false)` and return. It does not call `applySession`, does not restart the profile bootstrap and does not set the `session-ended` transition. If a profile load is in progress it goes to `applySession`, which only does `setUser` because the user id is unchanged. The Profile page is not unmounted. `updateUser` emits `USER_UPDATED`, which the handler handles with `setUser(sessionUser)` in the same early-return branch. No design contradiction found. This is source reading only. I did not run any real auth event.

#### Recommendation on the two hosted settings
Turn on both "Require current password when updating" and "Secure password change". The first makes the server enforce what step 4 only checks client-side, and recovery sessions are exempt (answer 2). The second is safe for this form because the step 4 sign-in creates a fresh session (answer 3). Risks:
- Please verify both on a non-production project first, because my evidence is upstream source and not your deployed version.
- With "Secure password change" on, an old session that calls `updateUser` without going through this form gets `reauthentication_needed`.
- Neither setting protects the reset-link flow beyond what it has now.

#### Files changed
- New: `SGHomie/FrontEnd/src/components/ChangePasswordForm.tsx`, `SGHomie/tests/change-password.test.mjs` (16 tests, FE-CHPW-01 to 16).
- Changed: `SGHomie/FrontEnd/src/pages/Profile.tsx` (import plus a "Change password" section rendered only when `user.email` is set), `SGHomie/FrontEnd/src/pages/ResetPassword.tsx` (imports the shared message), `SGHomie/FrontEnd/src/lib/passwordPolicy.ts` (exports `SAME_PASSWORD_MESSAGE`), `SGHomie/tests/reset-password.test.mjs`, `SGHomie/tests/profile-workflows.test.mjs`.
- Untouched: AuthContext, authRecovery, supabase.ts, config, migrations, Edge Functions. No new dependency.

#### Edits to existing tests
- `reset-password.test.mjs`: in FE-RESET-09, the old regex `/Choose a password you haven't used for this account\./` became `/Your new password must be different from your current password\./`. I added new test FE-RESET-17 for the new wording (handoff test 15).
- `profile-workflows.test.mjs`:
  - Added a stub `ChangePasswordForm` and the dependency-map entry `'../components/ChangePasswordForm'`.
  - Beyond the "dependency map only" wording: `profileHarness` takes a new `email` option with default `'[email redacted]'`, and `authUser` uses `email` instead of the literal. This is needed for test 14 and keeps every existing test's behaviour identical. Tell me if you want it done differently.
  - Added FE-PROFILE-03 and FE-PROFILE-04.
- No other existing test was edited.

#### Test evidence
**Red** (before implementation, focused run of change-password, reset-password, profile-workflows):
`ℹ tests 39 / ℹ pass 20 / ℹ fail 19`. FE-CHPW-01 to 16 failed with ENOENT on `ChangePasswordForm.tsx` or a missing export. FE-PROFILE-03, FE-RESET-09 and FE-RESET-17 failed. FE-PROFILE-04 passed trivially, as expected when the form does not exist yet.

**Green** (after implementation): the six focused files (change-password, reset-password, profile-workflows, auth-recovery, auth-modal, auth-modal-guards) gave `ℹ tests 95 / ℹ pass 95 / ℹ fail 0`.

**Full checks from `SGHomie/FrontEnd/`:**
- `npm test`: `ℹ tests 578 / ℹ pass 575 / ℹ fail 3`. The 3 failures are the blocker above. The baseline of 559 plus my 19 new tests is 578.
- `npm run lint`: `✖ 2 problems (0 errors, 2 warnings)`. These are the same two existing react-refresh warnings, in `AuthContext.tsx` and `main.tsx`.
- `npx tsc --noEmit -p tsconfig.app.json`: no output, exit 0.
- `npm run build`: `✓ built in 3.46s`.
- `git diff --check`: exit 0, with only LF/CRLF warnings.

#### Unverified
- No browser or hosted check was run. Behaviour is covered only by harness tests with synthetic doubles, so real Supabase error shapes (for example the status on a rate limit) are assumed from the client and server source.
- The 3 blocked `auth-context-profile-dedupe` tests are unverified after the change.
- I did not check how the real child components render together, because the harness does not render children.
- The server-side answers come from upstream master, not your hosted project.

#### Recommended commit message
feat(auth): add authenticated change-password form to Profile

Co-Authored-By: Claude Sonnet 5.5 <[email redacted]>

(Commit only after the `auth-context-profile-dedupe.test.mjs` fix is decided and `npm test` is green.)

### Planner (Claude Fable) · 2026-11-16T15:02:50Z

_[tool: Bash — Review the change-password form and the diffs to Profile, reset page and existing tests]_

### Planner (Claude Fable) · 2026-11-16T15:02:59Z

_[tool: SendMessage]_

### Planner (Claude Fable) · 2026-11-16T15:03:09Z

Sonnet implemented S6 and stopped on a blocker, which I've resolved; it's now applying a one-line fix and rerunning the checks. S6 is not accepted yet.

**The blocker.** Three existing Profile sign-out tests fail, because a third test file has its own Profile harness that rejects the new form's import. My handoff didn't list that file. I approved the one-line import entry there and nothing else. Sonnet has not yet seen those three pass.

**My code review found nothing to change.** The form does what the handoff specified:
- **Order of checks:** policy, then match, then "new equals current", all before any network call.
- **Current password:** verified by signing in with it, then the update is sent with the current password attached.
- **Errors:** wrong current password, rate limit, connection failure, ended session and reauthentication each have their own message.
- **S5 untouched:** no change to the recovery state, the auth context or the client setup. The reset page only picks up your new wording from a shared constant.

**What Sonnet's investigation found** (from Supabase's upstream server source, read through a summarising tool, so not confirmed against your hosted version):

| Question | Finding |
| --- | --- |
| "Require current password" on: does it break reset links? | No. Reset-link sessions are exempt. |
| Current password sent while the setting is off | Ignored, no error. |
| "Secure password change" on | Sessions older than 24 hours need reauthentication. This form signs in fresh first, so it is unaffected. |
| Other sessions after a change | The server already signs them out, whatever the settings. |

So the extra "sign out other sessions" call I added is redundant but harmless. Sonnet recommends turning both settings on; I agree in principle, but only after you've tried it on a non-production project, since the evidence is upstream source. Nothing has been changed.

`✶ Insight ─────────────────────────────────────`
- The server-side exemption for recovery sessions is what makes "Require current password" compatible with forgot-password at all: a user who forgot their password cannot supply the current one.
- Verifying by sign-in has a side effect worth knowing: it replaces the browser's session with a new one, and if the update then fails, the old session stays valid on the server until it expires.
`─────────────────────────────────────────────────`

I'll rerun the suite myself once Sonnet reports, then give you the S6 report.

### Implementer report (Claude Sonnet), delivered to the planner · 2026-11-16T15:03:23Z

The one-line dependency-map fix is applied and all four checks pass from SGHomie/FrontEnd. Nothing was staged or committed. I started no dev server and made no hosted calls.

**The only edit in `SGHomie/tests/auth-context-profile-dedupe.test.mjs`** (`git diff --stat` shows 1 insertion, 0 deletions). The line sits in the Profile harness module map, just before `'lucide-react': {},`:
`+    '../components/ChangePasswordForm': { default: () => null },`

**Check results:**
- `npm test`: `ℹ tests 578 / ℹ pass 578 / ℹ fail 0`. The 3 earlier Profile sign-out failures now pass.
- `npm run lint`: `✖ 2 problems (0 errors, 2 warnings)`, the same two existing react-refresh warnings.
- `npx tsc --noEmit -p tsconfig.app.json`: no output, exit 0.
- `npm run build`: `✓ built in 1.30s`.

**Test edits to report:** besides the three in my first report, this one line in `auth-context-profile-dedupe.test.mjs` is the only other existing-test edit. The `email` option in `profileHarness` in `profile-workflows.test.mjs` stays, as you accepted.

**Unverified, unchanged from my first report:** there was no browser or hosted check. The server-side answers come from upstream supabase/auth source, not your deployed project.

**Recommended commit message:**
feat(auth): add authenticated change-password form to Profile

Co-Authored-By: Claude Sonnet 5.5 <[email redacted]>

### Planner (Claude Fable) · 2026-11-16T15:03:37Z

_[tool: Bash — Rerun suite, lint and typecheck, then record S6 evidence and review findings]_

### Planner (Claude Fable) · 2026-11-16T15:04:03Z

S6 (change password on the Profile page) is implemented, reviewed and accepted, with the automated suite passing. It has not been seen in a browser or run against hosted Supabase.

#### S6 result

**What changed:**
- **Profile page:** a "Change password" section with current, new and confirm fields, reusing the checklist, strength meter and show/hide. It shows only for accounts with an email.
- **Reuse policy:** no history is kept. Only "new equals current" is refused, before any network call, and again by Supabase.
- **Wording:** the reset page and the new form share "Your new password must be different from your current password."
- **S5 untouched:** no change to the recovery state, the auth context or the client setup.

**Checks I ran myself:**

| Check | Result |
| --- | --- |
| Full Node suite | 578 of 578 passed (559 before, 19 added) |
| Lint | 0 errors, the same 2 existing warnings |
| Typecheck | passed |

The build was run by Sonnet only and passed. X → Y → X is covered by an automated test against a stub that refuses only the current password.

**Edits to existing tests:**
- `reset-password.test.mjs`: the old wording replaced by the new, as you asked.
- `profile-workflows.test.mjs`: an import entry and an `email` option on the harness.
- `auth-context-profile-dedupe.test.mjs`: one import entry. My handoff missed this file; Sonnet stopped on three failing tests and I approved the line.

**Limitations:**
- **No browser check.** The Profile page needs a signed-in session and I used none. Layout, focus order and real Supabase error responses for this form are unverified.
- **The current-password check is client-side.** While "Require current password when updating" is off, someone holding a valid session token can still change the password through the API without it.
- **Server behaviour is from upstream source, not your project.** That covers reset links being exempt from the current-password requirement and other sessions being signed out on a change.
- **Failed update after verification:** the browser holds a fresh session and the earlier one stays valid on the server until it expires.

#### Commit

```
feat(auth): add authenticated change-password form to Profile
```

Files to stage:

```
SGHomie/FrontEnd/src/components/ChangePasswordForm.tsx
SGHomie/FrontEnd/src/pages/Profile.tsx
SGHomie/FrontEnd/src/pages/ResetPassword.tsx
SGHomie/FrontEnd/src/lib/passwordPolicy.ts
SGHomie/tests/change-password.test.mjs
SGHomie/tests/profile-workflows.test.mjs
SGHomie/tests/reset-password.test.mjs
SGHomie/tests/auth-context-profile-dedupe.test.mjs
planning/01-scope-and-decisions.md
planning/04-test-evidence.md
planning/05-review-findings.md
planning/handoffs/08-s6-change-password.md
```

#### Hosted settings: my recommendation, nothing changed

Turn on "Require current password when updating" first. It makes the server enforce what the form only checks in the browser, and by the upstream source it does not affect reset links. Rerun your S5 reset afterwards to confirm that on your project. "Secure password change" adds less here and can wait.

#### Real X → Y → X test

I can't do this alone: the form is behind sign-in, and I can't create an account without receiving a confirmation email. Two ways to get it:
1. You run it by hand on a synthetic account: change X to Y, sign in with Y, change Y back to X, then try X to X and confirm it is refused.
2. You sign a synthetic account in to the Playwright browser yourself and type the passwords; I drive and observe the form without seeing credentials.

`✶ Insight ─────────────────────────────────────`
- Three tests in an unrelated-looking file broke because this harness treats every import as a contract. That strictness is what caught the gap in my handoff before it reached CI.
- Sharing the `same_password` text as one exported constant means the two forms can't drift apart again, and one test pins the exact sentence.
`─────────────────────────────────────────────────`

Phase A is complete in the repository. Next in the plan is the chatbot canary repair, which still needs the hosted Verify JWT setting for the chatbot function and its log from a failed check.

_[end of excerpt]_
