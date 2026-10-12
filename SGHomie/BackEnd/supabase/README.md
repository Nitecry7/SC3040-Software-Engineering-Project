# Supabase setup

The chatbot Buy flow, listing-search tool contract, verification and deployment
steps are documented in [Chatbot buy flow](../../docs/buy-flow.md).
The seller intake, provisional pricing, partial drafts and saved-draft card are
documented in [Chatbot sell flow](../../docs/sell-flow.md).

The active migration path starts with one complete initial migration and then
applies incremental migrations for the current application features:

- `20250328092626_sghomie_initial.sql`
- HDB postal-code validation, property image storage, chatbot drafts, and
  admin-role constraints
- `20260917120000_hdb_verification_tokens.sql` for server-enforced HDB writes
- `20260917130000_remove_chatbot_rate_limits.sql` removes the chatbot counter
- `20261008120000_deterministic_demo_property_amenities.sql` adds provenance and deterministic demo nearby amenities
- `20261012120000_property_valuation_inputs.sql` adds nullable, provenance-labelled valuation inputs
- `20261013140000_property_demo_batch_provenance.sql` adds canonical synthetic demo batch provenance and database-enforced eligibility invariants
- `20261013150000_require_approved_demo_valuations.sql` replaces the demo completeness check to require approved listings while preserving fixture owner IDs

The initial migration creates the full application schema, policies, views, and
triggers for a fresh Supabase project. Later migrations must be applied in
timestamp order with the initial schema.

## Deterministic demo amenities

The latest migration adds a `source` column to `public.property_amenities`,
defaulting existing and unspecified rows to `legacy`. Generated rows use
`source = 'demo'` and one deterministic record per property for each category:
Transport, School, Shopping, Healthcare, Food, Park, and Community. Distance and
bearing are derived deterministically from the property/category, and the stored
distance is calculated from the generated coordinates.

The migration replaces only its exact recognized legacy placeholder rows. It
preserves unrelated amenity records, and its demo-only partial unique index does
not constrain multiple real amenities of the same category. Existing properties
are backfilled only when they have zero amenity rows and finite coordinates
within the broad Singapore bounds (latitude 1.0–1.6, longitude 103.4–104.4).
New properties use a temporary insert trigger to create demo rows when their
coordinates pass the same checks; generation reads but does not change the
property's stored coordinates. This trigger and these records are for the
current demo pipeline, not a live amenity service.

Real amenity ingestion is not implemented. When an authoritative source is
ready, remove the temporary demo trigger and replace `source = 'demo'` rows using
the chosen real-source provenance. The migration file documents the full
generation logic; this README describes its behavior only.

## Local demo valuation integration

`20261012120000_property_valuation_inputs.sql` adds nullable structured inputs
for `flat_type`, `flat_model`, model-oriented `storey_mid`, and a remaining
lease value tied to `remaining_lease_as_of_month`. It adds
`valuation_inputs_source`, defaulting to `legacy`. Existing rows receive no
fabricated feature values; no property rows are updated by the migration. Basic
text, numeric, and month checks preserve canonical property facts independently
of any model version. Rows labelled `demo` must include their valuation inputs
and explicit town, block, street, and floor area, with canonical batch
provenance. The demo valuation gate additionally requires a valid
`storey_range` whose midpoint matches `storey_mid`; seller eligibility does not
require the training-style range string.

`20261013120000_property_storey_range.sql` adds nullable `storey_range` for
auditable demo source ranges and checks the training-style midpoint when both
storey fields are present. The canonical local inventory in `seed.sql` is the
union of two synthetic test batches: 20 rows from
`sghomie-test-2026-10-07-2e3e55` and 30 from
`sghomie-test-2026-10-07-extra30-12f05f`. Their exported UUIDs and listing
facts are stored directly in the seed. It has no reset-time dependency on the
ignored export CSV or HDB training CSV. The CSV was used only as temporary
construction input.

The canonical fixtures set `valuation_inputs_source='demo'`, their explicit
`demo_batch_id`, and `hdb_verified=false`; they omit nullable seller/account identifiers and
contacts. `flat_type` comes from each fictional title. Flat-model and storey
range categories and lease reference values were chosen deterministically from
HDB development data dated 2017-01 through 2025-12, with explicit town/type
grouping and tie rules. Lease values are aged to `2026-10-01`; the Edge
Function subtracts whole calendar months through the current Singapore
valuation month. Block and training-style street fields are stored explicitly.
All these valuation attributes remain synthetic, not seller- or HDB-verified.
This fixture-only construction does not alter CatBoost model selection,
training, uncertainty calibration, or the untouched 2026 evaluation results.

The seed removes the nine superseded standalone fixtures only when their exact
title, detailed address, and `Demo Seller` signature matches. It upserts only
the 50 canonical IDs and clears nullable seller/account fields on those rows;
it does not delete properties based on demo provenance. The legacy location
trigger previously substituted a town centroid on insert even when a complete
coordinate pair was supplied. `20261013130000_preserve_explicit_property_coordinates.sql`
keeps explicit pairs and retains the centroid only as a missing-coordinate or
location-only-edit fallback, allowing the amenity trigger to see the fixture's
stored coordinates.

For demo valuation, `storey_range` must match `storey_mid`. This range is
fixture metadata only, not a permanent seller-facing input. The real seller
capture contract remains incomplete: a future stage must capture the actual
floor/storey fact and derive model-oriented range/midpoint values. Seller
eligibility remains complete `seller_supplied` valuation inputs plus
`hdb_verified = true`; it does not require sellers to enter a training-style
range string.

The `valuation` Edge Function accepts only a property UUID and reads the row
with the caller's Supabase session, so the existing property RLS policies govern
visibility. It requires an authenticated user and calls the configured Render
valuation API with a server-held bearer token. Seller eligibility requires
complete `seller_supplied` inputs, `hdb_verified = true`, and a null
`demo_batch_id`. HDB verification is an address/location check; it does not
establish that synthetic listing facts are genuine. Local demos require
`VALUATION_ALLOW_DEMO_INPUTS=true` and a local Supabase URL. Hosted demos use a
separate `VALUATION_ALLOW_HOSTED_DEMO_INPUTS=true` gate, a non-local Supabase
URL, an approved row in one of the two canonical batches, and complete,
internally consistent valuation inputs. Synthetic seller/account IDs on these
fixtures are preserved and do not affect demo eligibility. Neither gate reads
listing descriptions, and the hosted path accepts either value of
`hdb_verified`.
Legacy, incomplete, or unverified seller rows return
`409 VALUATION_UNAVAILABLE`. No `detailed_location`, `built_year`, bedroom
count, or asking price is used to infer model inputs. Asking price is sent only
as the optional comparison field; transaction month/year come from the current
Singapore calendar month.

The Edge Function protects the route with Supabase JWT verification and also
validates the user in its handler. Configure these Edge Function secrets in the
local `.env` used by `supabase functions serve valuation --env-file .env`, and
as Supabase Function secrets only when a hosted deployment is separately
approved:

- `VALUATION_API_URL`: the trusted Render `POST /v1/valuation/predict` URL.
- `VALUATION_SERVICE_TOKEN`: the server-to-server bearer token shared with the
  Render service. Never put it in frontend environment files or responses.
- `VALUATION_ALLOW_DEMO_INPUTS`: set to `true` only for local development; the
  function still verifies that `SUPABASE_URL` is local.
- `VALUATION_ALLOW_HOSTED_DEMO_INPUTS`: set to `true` only when hosted demo
  valuation is explicitly intended. The function still requires a non-local
  Supabase URL, canonical `demo_batch_id`, approved status, and complete valid
  metadata. Synthetic fixture owner IDs are allowed. This flag does not enable
  local demos and does not change seller eligibility.

The migration does not assign provenance or update the existing hosted demo
listings. Hosted rows remain unchanged by this repository change and will not
pass the hosted demo gate until a separately approved data operation assigns
their canonical batch IDs and demo source. No hosted data update is included
here.

Run local function tests from the repository root:

```bash
node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test SGHomie/tests/valuation.test.mjs
```

The hosted database has already received
`20261013140000_property_demo_batch_provenance.sql` (as reported for this
project). The corrective `20261013150000_require_approved_demo_valuations.sql`
and current function changes remain unapplied and undeployed. No migration here
assigns batch provenance to or otherwise updates the hosted 50 rows. Do not infer
other remote schema, secrets, or function state from these files. Before any
later hosted rollout, inspect pending migrations and deploy the function
separately using the documented preview-first procedure below. Structured real seller capture is not yet
implemented, so ordinary production listings will remain valuation-unavailable
until their owner can provide these fields legitimately.

## Extensions

The initial migration enables the only database extension currently required by
SG Homie:

```sql
create extension if not exists pgcrypto with schema extensions;
```

`pgcrypto` provides UUID generation through `gen_random_uuid()`. No manual
extension setup is needed when using the migrations. If a project has an
extension policy that prevents migrations from enabling extensions, enable
`pgcrypto` in Dashboard → Database → Extensions before pushing.

Supabase Auth owns the `auth` schema. The migrations deliberately do not create
or modify `auth.users` or any other Auth-managed table. To create an admin:

1. Create the user through Supabase Dashboard → Authentication → Users.
2. Let the user complete the normal profile setup in SG Homie.
3. In the Supabase SQL Editor, mark that profile as an administrator:

```sql
update public.user_profiles
set is_admin = true
where id = (
  select id from auth.users where email = 'your-admin-email@example.com'
);
```

## Reset and push the schema

From the backend directory:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push --dry-run --linked
supabase db push --linked
```

`seed.sql` is used by local `supabase db reset` to load the 50 canonical
synthetic batch fixtures; it is not applied by `supabase db push`, so demo data
cannot enter production accidentally. To update an existing local database
without resetting it, apply pending migrations locally and then run
`supabase db seed --local`; the seed upserts the exact batch IDs and removes
only the nine obsolete seed signatures. A fresh `supabase db reset` also
recreates the canonical set but resets all local database contents. Neither
procedure has been run as part of this repository change. For a new hosted
project, link the intended project,
review pending migrations, and preview before applying them. For an existing
hosted project, compare local and remote migration history and reconcile any
drift before pushing; do not reset or recreate a hosted database to work around
history differences. A repository checkout does not prove which migrations are
applied remotely.

`supabase migration list` compares local and linked migration history. The
`--dry-run` command previews pending changes; apply only after confirming the
project reference and migration plan. `supabase db reset` is for the local
development database. Never use `supabase db reset --linked` against a hosted
project; it is destructive. See the [Supabase CLI workflow guide](https://supabase.com/docs/guides/local-development/cli-workflows).

For local database testing, run:

```bash
supabase start
supabase db reset
```

Do not run `supabase db reset` against the linked hosted project.

To verify environment-specific deployment state, inspect migration history with
`supabase migration list` and check the relevant Edge Function in the linked
project's Supabase Dashboard or by invoking its intended health/workflow path.
Deploying source with `supabase functions deploy <function-name>` is a separate
step from applying migrations. Do not infer either state from the repository.

## HDB postal-code lookup

The `lookup-hdb-location` Edge Function uses OneMap for postal-code geocoding
and the official HDB Property Information dataset for residential-block
validation. Configure the OneMap credentials as Edge Function secrets before
deploying the function:

```bash
supabase secrets set ONEMAP_EMAIL=your-registered-email@example.com ONEMAP_PASSWORD='your-onemap-password'
supabase functions deploy lookup-hdb-location
```

The OneMap credentials are server-side only and must not be added to the
frontend `.env` file.

The lookup function also issues a short-lived, seller-bound verification token.
The `properties` trigger uses that token's verified address and coordinates
on seller writes, so the frontend cannot mark an address as verified or submit
fabricated map coordinates. Apply the migrations before deploying the lookup
and chatbot functions:

```bash
supabase db push --linked
supabase functions deploy lookup-hdb-location
supabase functions deploy chatbot
```

## Chatbot provider selection

The chatbot supports exactly two providers, selected by the server-side
`CHAT_PROVIDER` setting. When omitted, it uses OpenRouter as before. The switch
does not change system prompts, history, listing tools, search rules or seller
logic, and does not automatically fall back to another provider.

| Setting | OpenRouter | OpenAI |
| --- | --- | --- |
| `CHAT_PROVIDER` | `openrouter` (default) | `openai` |
| API key | `OPENROUTER_API_KEY` | `OPENAI_API_KEY` |
| Model override | `OPENROUTER_MODEL` | `OPENAI_MODEL` |
| Default model | `openrouter/free` | `gpt-6-luna` |

For local testing, copy `BackEnd/.env.example` to `BackEnd/.env`, fill in the
selected provider's key, and run from `BackEnd/`:

```bash
supabase functions serve chatbot --env-file .env
```

The hosted chatbot reads **Supabase Edge Function secrets**, not local or
frontend `.env` files. Add `OPENAI_API_KEY` securely in Dashboard → Edge Functions
→ Secrets, then select OpenAI with:

```bash
supabase secrets set CHAT_PROVIDER=openai OPENAI_MODEL=gpt-6-luna
```

To switch back, keep the existing OpenRouter key and set:

```bash
supabase secrets set CHAT_PROVIDER=openrouter OPENROUTER_MODEL=openrouter/free
```

Deploy `chatbot` after source changes; changing provider/model secrets does not
require another source edit. Only the selected provider's key is required.
Keys must stay server-side and out of Git and frontend environment variables.

The OpenAI adapter uses the existing Chat Completions contract and HTTP
transport. It removes OpenRouter's `provider` routing field, converts
`max_tokens` to `max_completion_tokens`, and uses `reasoning_effort: none` for
GPT-6 Luna/Sol to support function calls. Choose a Chat Completions model that
supports function calling. GPT-6 Astra and GPT-6.1 Sol require Responses API for
tools and are deliberately rejected by this adapter; use Luna/Sol instead.
The official compatibility rules are documented in the
[GPT-6 guide](https://developers.openai.com/api/docs/guides/latest-model).

The chatbot has no application-level request rate limit. Each provider still
enforces its own account limits, quotas, and model availability. Automated
adapter tests mock the provider; they do not verify access to a paid account.

Adapter verification (from the repository root):

```bash
node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test SGHomie/tests/chat-provider.test.mjs SGHomie/tests/buy-flow.test.mjs
```

Strict backend module check (from `SGHomie/FrontEnd/`):

```bash
./node_modules/.bin/tsc --noEmit --strict --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2022 --lib es2022,dom ../BackEnd/supabase/functions/_shared/openai.ts ../BackEnd/supabase/functions/_shared/chatProvider.ts ../BackEnd/supabase/functions/chatbot/buy.ts ../BackEnd/supabase/functions/chatbot/buyerRequirements.ts
```

## Property image storage and cleanup

Property images use the public `property-images` bucket and are organised as:

```text
<seller-id>/<property-id>/<random-file-name>.<extension>
```

The seller dashboard uploads JPG, PNG and WebP files up to 10 MiB. The storage
policies restrict uploads and deletion to the owning seller or an administrator;
the bucket is public so approved listing pages can render image URLs.

Deploy the cleanup function after the migration:

```bash
supabase functions deploy cleanup-unlinked-property-images
```

Create the 30-minute schedule in Supabase Dashboard → Integrations → Cron:

1. Create a job with schedule `*/30 * * * *`.
2. Configure it to make a `POST` request to
   `/functions/v1/cleanup-unlinked-property-images`.
3. Add the header `apikey: YOUR_SUPABASE_SECRET_KEY`.
4. Use `{}` as the JSON request body.

The cleanup function accepts only a Supabase secret API key in the `apikey`
header and uses its server-side Supabase key to delete objects. The schedule
and credential therefore stay in the Supabase Dashboard rather than in SQL or
the repository.

The scheduled function reads the image URLs linked from `properties.image_url`
and `properties.photos`, then removes only unlinked objects from the bucket.
External legacy image URLs are ignored and are not deleted.
