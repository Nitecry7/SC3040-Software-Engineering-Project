# Supabase setup

The active migration path contains one complete initial migration:

- `20250328092626_sghomie_initial.sql`

It creates the full application schema, policies, views, and triggers for a
fresh Supabase project. The historical migrations are preserved under
`archived_migrations/` for reference only.

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
