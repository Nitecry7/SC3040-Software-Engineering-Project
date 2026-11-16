# Handoff 03: S2 public listing column contract

> **Do not commit or push this file, or the two S2 SQL files, until the repository owner approves the S2 push.** It describes an unfixed issue on a live site in a public repository.

| Field | Value |
| --- | --- |
| From | Planning model |
| To | Sonnet Medium |
| Date | 16 November 2026 |
| Budget | 2 hours |

If you exceed the budget or get stuck, stop and report status. Do not revert, delete or discard anything.

## Goal

Callers who are not signed in can read only an explicit allow-list of columns on `public.properties`. Signed-in access is unchanged.

## Background

- The read policy on `public.properties` lets the `anon` role read approved rows. No column-level grant exists, so `anon` can read every column of those rows, including seller contact and address fields.
- Row-level security filters rows, not columns. The fix is column-level privileges.
- Slice L0 already changed the home page to request named columns.

## Read first

- `AGENTS.md`
- `SGHomie/BackEnd/supabase/migrations/20250328092626_sghomie_initial.sql`: the `properties` table, its select policy and anything that grants or revokes on it.
- Every later migration that adds a column to `public.properties`, so you have the complete current column list.
- `SGHomie/BackEnd/supabase/tests/database/access-control.test.sql` for conventions, and `hdb-verification-integrity.test.sql` as a recent example.
- `SGHomie/FrontEnd/src/pages/PropertyDetails.tsx`, only the `PROPERTY_DETAILS_SELECT` constant.

## Files

Create exactly two files, together, in this slice:

- `SGHomie/BackEnd/supabase/migrations/<timestamp>_public_listing_column_contract.sql`, with a timestamp later than `20261101120000`.
- `SGHomie/BackEnd/supabase/tests/database/public-listing-contract.test.sql`

Do not edit any existing file.

## Design

```sql
REVOKE SELECT ON public.properties FROM anon;
GRANT SELECT (<allow-list>) ON public.properties TO anon;
```

Allow-list, derived from the queries that run without a signed-in user:

`id, title, price, location, town, type, image_url, bedrooms, bathrooms, area_sqft, status, created_at`

| Anonymous reader | Selects | Filters and ordering |
| --- | --- | --- |
| Home page featured listings | `id, image_url, title, type, price, location, bedrooms, bathrooms, area_sqft` | order by `created_at` |
| Listing counts | `id, town, location` | `status`, `type`, order by `id` |
| Chatbot onboarding | `id, town, location` | `status`, `type`, order by `id` |
| Realtime new-listing notice | reads `id`, `location` from the payload | none |

Everything else is private to signed-in users, including `description`, `photos`, seller name and phone, seller and user identifiers, postal code, block, street, detailed location, coordinates, verification fields, moderation fields and valuation inputs. `description` is excluded because sellers write it as free text.

Rules:

- Do not change any row policy.
- Do not change privileges for `authenticated` or `service_role`.
- Do not change `anon` privileges other than `SELECT`.
- Check whether `SELECT` on this table reaches `anon` through `PUBLIC` as well as directly. If it does, report it and stop; do not revoke from `PUBLIC` without the planner's decision.
- A column added later is private by default, because nothing grants it.
- Neutral comments that describe the contract.

## Tests

pgTAP, synthetic rows only, same conventions as the existing files, new identifiers that collide with neither existing file. Every statement that may be refused sits inside an assertion.

1. `anon` has no table-wide `SELECT` on `public.properties`.
2. The set of columns on which `anon` has `SELECT` equals the allow-list exactly, computed from the catalog over all current columns. This must fail if a column is granted by mistake or a listed column is missing.
3. As `anon`, each of the three query shapes in the table above succeeds against an approved row and returns it.
4. As `anon`, selecting each private column is refused with `42501`. One assertion per column for: `seller_name`, `seller_phone`, `seller_id`, `user_id`, `postal_code`, `block_number`, `street_name`, `detailed_location`, `latitude`, `longitude`, `description`.
5. As `anon`, selecting every column is refused.
6. As `anon`, filtering on a private column while selecting only allowed columns is refused.
7. As `anon`, draft, pending and rejected rows are not visible.
8. As a signed-in buyer, the `PROPERTY_DETAILS_SELECT` column set on an approved row succeeds, and so does selecting every column.
9. As the owner, selecting every column of their own row succeeds.
10. As an admin, selecting every column succeeds.
11. `authenticated` still has table-wide `SELECT`.

State in your report which assertions you expect to fail before the migration.

## Also check, by reading only

- Whether any existing assertion in `access-control.test.sql`, `monitoring.sql` or `synthetic_canary.sql` reads `public.properties` as `anon` in a way the new grant would refuse.
- Whether `SGHomie/BackEnd/supabase/seed.sql` or any migration runs as `anon`.
- Whether any Edge Function other than the chatbot onboarding reads `properties` with the public key.

Report findings. Do not change those files.

## Constraints

- Docker is unavailable, so you cannot run SQL. Never state that a test passes.
- Do not stage, commit, push or deploy.
- No Node code changes are expected. If you believe one is needed, stop and report.

## Report back

- Files created and the exact allow-list used.
- A table of assertions with expected results before and after the migration.
- Findings from the read-only checks.
- Anything unverified.
- Deployment considerations you noticed.
- A recommended Conventional Commits message, worded neutrally.
