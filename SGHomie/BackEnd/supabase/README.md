# Supabase setup

The chatbot Buy flow, listing-search tool contract, verification and deployment
steps are documented in [Chatbot buy flow](../../docs/buy-flow.md).

The active migration path starts with one complete initial migration and then
applies incremental migrations for the current application features:

- `20250328092626_sghomie_initial.sql`
- HDB postal-code validation, property image storage, chatbot drafts, and
  admin-role constraints
- `20260917120000_hdb_verification_tokens.sql` for server-enforced HDB writes
- `20260917130000_remove_chatbot_rate_limits.sql` removes the chatbot counter

The initial migration creates the full application schema, policies, views, and
triggers for a fresh Supabase project. Later migrations must be applied in
timestamp order with the initial schema.

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
supabase db push --dry-run
supabase db push --linked
```

`seed.sql` is used by local `supabase db reset` to load nine approved demo
properties; it is not applied by `supabase db push`, so demo data cannot enter
production accidentally. For a hosted project that contains an old schema,
reset it through the Supabase Dashboard before pushing this fresh initial
migration. `supabase db reset` only resets the local database.

For local database testing, run:

```bash
supabase start
supabase db reset
```

Do not run `supabase db reset` against the linked hosted project.

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

The chatbot has no application-level request rate limit. Its default model can
be overridden with the `OPENROUTER_MODEL` Edge Function secret; the default is
`openrouter/free`, which selects available free models with the required capabilities.
`OPENROUTER_*` settings in frontend `.env` files do not configure the hosted Edge
Function. Set overrides with `supabase secrets set OPENROUTER_MODEL=...` and deploy
the chatbot after changing its source.

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
