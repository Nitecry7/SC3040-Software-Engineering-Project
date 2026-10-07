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

`seed.sql` is used by local `supabase db reset` to load nine approved demo
properties; it is not applied by `supabase db push`, so demo data cannot enter
production accidentally. For a new hosted project, link the intended project,
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
