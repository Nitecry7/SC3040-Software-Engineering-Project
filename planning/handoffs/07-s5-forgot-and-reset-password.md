# Handoff 07: S5 forgot and reset password

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Date | 16 November 2026 |
| Budget | 2.5 hours |
| Depends on | A1 (handoff 06), present in the working tree, uncommitted |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything. The working tree holds uncommitted A1 work; leave it intact.

## Goal

A signed-out user can request a password reset email and set a new password from the emailed link, using the existing Supabase Auth SDK. Expired and invalid links show a clear message. The request never reveals whether an email address is registered.

## Read first

- `AGENTS.md`
- `SGHomie/FrontEnd/src/lib/supabase.ts`, `contexts/AuthContext.tsx`, `App.tsx`, `components/AuthModal.tsx`, `components/ProtectedRoute.tsx`, `components/SessionLifecycle.tsx`, `components/InitialProfileSetup.tsx` (props and where it renders only)
- `SGHomie/FrontEnd/src/lib/passwordPolicy.ts`, `components/PasswordStrength.tsx`
- `SGHomie/tests/helpers/frontend-component.mjs`, `auth-modal.test.mjs`, `auth-context-profile-dedupe.test.mjs`, `supabase-config.test.mjs`
- In `SGHomie/FrontEnd/node_modules/@supabase/auth-js/src/GoTrueClient.ts`: `_initialize`, `_getSessionFromURL`, `_isImplicitGrantCallback`, and where the URL fragment is cleared.

## Investigate before coding, and report

1. In the installed client (2.114.0, default implicit flow, `detectSessionInUrl` on): when is the fragment read and cleared, and what happens when the fragment carries `error`, `error_code` and `error_description` and no token?
2. Can `PASSWORD_RECOVERY` fire before `AuthContext` subscribes? The planner's reading is that it is emitted from a zero-delay timer during start-up, so the app must not depend on it. Confirm or correct.
3. What do `ProtectedRoute` and `SessionLifecycle` do to a user who arrives signed in through a recovery link? Report anything that would redirect or sign them out mid-flow.
4. `supabase.ts` clears `localStorage` on `SIGNED_OUT`. Check that the recovery state does not depend on anything that this would break or leave stale.

If any finding contradicts the design below, stop and report before coding.

## Design

### `lib/authRecovery.ts` (new, no Supabase import)

- `parseAuthRedirect(hash, search)`: pure. Returns one of `{ kind: 'recovery' }`, `{ kind: 'error', reason: 'expired' | 'invalid' }` or `{ kind: 'none' }`. `otp_expired` and an "expired" description map to `expired`; any other auth error maps to `invalid`. It returns no token and no raw description.
- A small recovery state with `captureAuthRedirect()`, `getRecoveryState()`, `clearRecoveryState()` and a subscribe function. It keeps only the kind and reason, in memory and in `sessionStorage` under one key, so a reload of the reset page keeps the form. Storage access is wrapped in try/catch.
- Never store or log the token, the fragment or the email.

### `lib/supabase.ts`

Call `captureAuthRedirect()` once, before `createClient`, so the fragment is read before the client consumes it. No other change.

### Request view

"Forgot password?" appears in sign-in mode of `AuthModal`. It opens a one-field view (email) inside the same dialog, with a way back to sign in.

- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`.
- After the call, show the same confirmation for success, for an unknown address and for a rate-limit or any other Auth error: "If an account exists for that address, we've sent a link to reset your password. Check your inbox and your junk or spam folder."
- Only a thrown network failure shows a different message: a generic "We couldn't send the request. Check your connection and try again."
- The button is disabled while the request is in flight. One request per submit, no automatic retry.
- Do not add `console` output that includes the email or the error.

Prefer a small new component (`components/ForgotPasswordForm.tsx`) so the change inside `AuthModal.tsx` stays small.

### Reset page

`pages/ResetPassword.tsx`, lazy-loaded, on a public route `/reset-password` outside `ProtectedRoute`.

| State | When | Shows |
| --- | --- | --- |
| Form | Recovery state is `recovery` and a session exists | New password, confirm, show/hide, the A1 checklist and meter, submit |
| Waiting | Recovery state is `recovery` and the session is still loading | A short loading message |
| Expired | Recovery state is `error` with `expired` | Message and a button that opens the forgot-password request view |
| Invalid | Recovery state is `error` with `invalid`, or `recovery` with no session after loading | Message and the same button |
| No link | No recovery state | Signed in: a link to the Profile page. Signed out: a link to sign in |
| Done | After success | Confirmation and a link to continue |

- Submit order: policy, then match, then `supabase.auth.updateUser({ password })`. Same messages and ARIA pattern as the sign-up form.
- `same_password` shows "Choose a password you haven't used for this account." `weak_password` shows Supabase's message. Any other error shows a generic failure. The form and its values stay.
- On success, clear the recovery state.
- The form must not appear for a normal signed-in visit without a recovery state. That route must not become a way to change a password without the current one.

### Landing on another path

If a recovery or error redirect is captured while the path is not `/reset-password`, navigate there once. This covers a link that falls back to the site URL.

### Profile setup overlay

`AuthProvider` wraps the router, so it cannot use router hooks. Hide `InitialProfileSetup` while the recovery state is `recovery`, by reading the recovery state. It returns as normal once the state is cleared.

### Clearing

Clear the recovery state on success, on sign-out, and when the user leaves `/reset-password` after an error state.

### Small carry-over from the A1 review

Add `autoComplete` to the password inputs: `current-password` in sign-in mode, `new-password` for sign-up, confirm and the reset form. Add `autoComplete="email"` to the email inputs you touch.

## Files

New: `lib/authRecovery.ts`, `pages/ResetPassword.tsx`, `components/ForgotPasswordForm.tsx`, `SGHomie/tests/auth-recovery.test.mjs`, `SGHomie/tests/reset-password.test.mjs`, `SGHomie/tests/forgot-password.test.mjs`.

Changed: `lib/supabase.ts`, `components/AuthModal.tsx`, `App.tsx`, `contexts/AuthContext.tsx`, and the existing tests of those files only to add dependency-map entries and new tests.

No new dependency. No change to Supabase configuration, migrations or Edge Functions.

## Tests, written first

1. Parser: recovery fragment; expired error; other error; empty; unrelated fragment; a fragment with both a token and an error. The result never contains a token.
2. Recovery state: capture, read, clear, survives when storage throws.
3. Request view: calls `resetPasswordForEmail` with the email and the redirect; the confirmation text is identical for success, an unknown-address response and a rate-limit error; a thrown network error shows the retry message; no double send while in flight; nothing is logged.
4. Reset page: each state in the table; policy failure and mismatch block the call; success calls `updateUser` with only the password and clears the state; `same_password`, `weak_password` and a generic error keep the form.
5. A signed-in visit with no recovery state shows no password form.
6. `AuthContext`: the overlay is hidden while recovery is active and shown again after clearing.
7. `App`: `/reset-password` is not wrapped in `ProtectedRoute`.
8. Every existing test still passes. Any edit to an existing test beyond dependency-map entries: stop and report first.

## Checks to run

- Focused: the new test files plus `auth-modal.test.mjs`, `auth-modal-guards.test.mjs` and the `AuthContext` tests.
- From `SGHomie/FrontEnd/`: `npm test`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`.

Baseline: 506 Node tests pass. Lint has 0 errors and 2 existing warnings.

## Constraints

- Do not stage, commit, push or deploy. Do not start a dev server or a browser.
- Do not call hosted Supabase. No real reset email, sign-up or sign-in.
- Do not weaken, skip or delete a test.
- Paste real command output. Never report a result you did not observe.

## Report back

- Answers to the four investigation questions, with file and line references.
- Files changed.
- Red then green output, and the four check results.
- Every edit to an existing test.
- Hosted settings the flow depends on (redirect allow-list, site URL, email template, rate limits), as a list for the owner.
- Anything unverified.
- A recommended Conventional Commits message.
