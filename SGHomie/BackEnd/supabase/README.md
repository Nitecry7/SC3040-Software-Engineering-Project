# Supabase setup

The first two migrations are already part of the SG Homie migration history:

- `20250328092626_wooden_brook.sql`
- `20250328093116_silent_wave.sql`

The next migration, `20250328094231_frosty_tree.sql`, completes the application
schema. It is safe to push to a new hosted Supabase project after linking the
project from `SGHomie/BackEnd`.

## Extensions

The migration enables the only database extension currently required by SG
Homie:

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

## Push the schema

From the backend directory:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push --dry-run
supabase db push --linked
```

Only migrations are pushed to the hosted project. `seed.sql` is used by local
`supabase db reset` to load nine approved demo properties; it is not applied by
`supabase db push`, so demo data cannot enter production accidentally.

For local database testing, run:

```bash
supabase start
supabase db reset
```

Do not run `supabase db reset` against the linked hosted project.
