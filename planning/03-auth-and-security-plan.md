# Authentication and security plan

Findings come from reading source and SQL on 16 November 2026. Nothing here was executed against a database or a hosted service. Security findings are described generically until fixes are live, and this document contains no reproduction steps.

## Authentication

### Current state

- Sign-in and sign-up share one modal, `SGHomie/FrontEnd/src/components/AuthModal.tsx`.
- Email verification works. The owner tested a sign-up, received the email and confirmed the link. SMTP and the email provider are not changed.
- There is no confirm-password field, show or hide control, forgot-password entry point, reset page or authenticated password change.
- The Supabase client is `@supabase/supabase-js` 2.114.0 with default options: implicit flow, session detection from the URL.
- Sign-up passes no redirect URL, so the hosted Site URL decides where confirmation links land.
- The application does not handle the password recovery event or link error parameters, so an expired link currently shows nothing.

### S4. Sign-up password experience (mandatory)

- A confirm-password field in sign-up mode. A mismatch blocks submission with an inline message and makes no Supabase call.
- A show or hide control that is keyboard-usable and labelled for screen readers.
- Password strength rules stay with Supabase. Its errors are mapped to readable messages.

### S5. Forgot and reset password (conditional)

- A "Forgot password?" entry in sign-in mode calls `resetPasswordForEmail` with a redirect to a public `/reset-password` route.
- The confirmation message is identical whether or not an account exists.
- A small pure module parses link error parameters, such as an expired link.
- The reset page has three states: a new-password form with confirmation, an expired-link message with a way to request a new link, and an invalid-link message.
- Success calls `updateUser` with the new password and returns the user to the application.
- The profile-completion overlay is suppressed on the reset route.

Before implementation, the installed auth client is read to confirm when the link fragment is consumed and whether the recovery event can fire before the application subscribes.

### S6. Authenticated password change (conditional)

- A section on the Profile page with current, new and confirm fields.
- The current password is verified by signing in again before `updateUser` is called. Supabase enforces a current password only when a hosted setting is enabled, and that setting is unverified.
- If Supabase requires reauthentication, the page says so and points to the forgot-password flow. No one-time-code screen is built.

### Hosted configuration to check

These are owner checks in the Supabase dashboard. No agent changes hosted settings.

- Site URL. An earlier screenshot showed a localhost value. The current value is unverified.
- Redirect allow-list includes `/reset-password` for the hosted site, and for local development if the flow is demonstrated locally.
- Secure password change setting, which decides whether an older session must reauthenticate.
- Email confirmation remains enabled.

### Authentication tests

Node tests in the existing harness under `SGHomie/tests/`. They are component and logic tests, not browser journeys, and do not prove hosted email delivery.

- Mismatched passwords block submission and make no Supabase call.
- The show or hide control toggles the field type and its accessible state.
- Parser cases for link errors, including an expired link.
- The three reset page states.
- An update failure shows an error and keeps the form.
- The reset request message does not reveal whether an account exists.

## Chatbot synthetic check

### What the code shows

- The admin-triggered check calls the chatbot function with a privileged server credential as the bearer token.
- Any 401 or 403 response is recorded as an authentication failure.
- The stored result marks the function as reached for every HTTP response, including one rejected before the function ran. "The request reached the function" is therefore not established by the stored result.
- The committed chatbot function answers a wrong credential on that route with 404, never 401 or 403. The committed function code cannot produce the observed result.
- The valuation synthetic check passes. It forwards the administrator's own session token.

### Conclusion

The rejection came either from the platform gateway in front of the function or from deployed code that differs from the repository. Official documentation is inconsistent on how the gateway treats a server credential sent as a bearer token. The cause is not established.

### What decides the fix

The owner reads two things in the hosted project: the JWT verification setting for the chatbot function, and the function's logs at the time of the failed check.

- If the deployed functions are out of date, no code change is needed. This is recorded as a deployment finding.
- If the gateway rejected the credential, the check forwards the administrator's own token, as the valuation check does, and the chatbot route verifies that token and the admin flag. The privileged credential no longer travels as a bearer token. The "function reached" flag is set only when the response carries a marker from the function.

The repair is tested with mocked requests in the Node suite. Hosted success is not claimed until both functions are deployed and the check is rerun.

## SGH-01. Public listing data protection

- **Finding.** Anonymous callers can read more listing fields than the public pages need, including seller contact and private address fields on approved listings.
- **Approach.** An explicit allow-list of fields for anonymous callers, enforced in the database. Row-level rules are unchanged.
- **Unchanged.** Signed-in buyers, sellers and admins keep their current access, so property details, seller and admin pages and the chatbot continue to work.
- **Remaining limitation.** Any signed-in account can still read seller contact and private address fields of approved listings. This work does not resolve that. It needs a product decision.
- **Dependencies.** The home page must request an explicit field list before the database change is applied. Realtime behaviour for anonymous visitors cannot be tested in CI and stays unverified until a hosted check.
- **Tests.** Database tests as the anonymous role, a signed-in buyer, the owner and an admin, including an exact check of the allow-list.

## SGH-02. HDB verification integrity

- **Finding.** Some location-related edits can leave a listing marked as verified although its stored location no longer matches what was verified.
- **Narrower than first reported.** An owner edit of an approved listing already returns it to moderation. Reapproval is enforced today.
- **Approach.** Tighten the existing database triggers so that a verified listing's location fields change only together, through a valid verification.
- **Reverification.** A legitimate reverification to a new address must update every location field and the map coordinates together. Regression tests cover a new address in another town, a new address in the same town, and a case designed to catch stale or fallback coordinates.
- **Relation to SGH-03.** Listing approval integrity depends on the verified flag being trustworthy. This fix is a prerequisite. SGH-03 itself is out of scope.
- **Tests.** Database tests for permitted edits, rejected edits, bypass attempts, reverification, trusted server writes and legacy unverified listings.

## Other audit findings

Not addressed in this assessment: listing approval integrity, unmetered valuation and address lookup, unverified retention cleanup scheduling, admin action auditing, multi-factor authentication and shared chatbot quota.

## Testing limits

- Database tests run only in CI on synthetic rows. They do not show how hosted data behaves.
- No security probe is run against real user records.
- Repository status and hosted status are reported separately. A fix is described as deployed only after the owner deploys and verifies it.
