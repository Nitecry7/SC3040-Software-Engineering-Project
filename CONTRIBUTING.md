# Contributing to SG Homie

Thanks for contributing to SG Homie! This guide covers the complete development setup, from cloning the repository to testing changes against the hosted Supabase project.

## Project Layout

The active application is organised as follows:

```text
SGHomie/
├── FrontEnd/       # React + Vite application
└── BackEnd/
    └── supabase/   # Database migrations and Edge Functions
```

The normal development workflow uses the hosted Supabase project. The local Supabase stack is optional and is only needed when you specifically want to test a local database or Auth instance.

## Prerequisites

Install the following before starting:

- Git
- Node.js 20.19+ or 22.12+
- npm
- A Supabase project
- The Supabase CLI

On macOS, the Supabase CLI can be installed with Homebrew:

```bash
brew install supabase
```

## 1. Clone the Repository

```bash
git clone https://github.com/Nitecry7/SC3040-Software-Engineering-Project.git
cd SC3040
```

## 2. Install Frontend Dependencies

```bash
cd SGHomie/FrontEnd
npm install
```

## 3. Configure the Frontend Environment

Create the local environment file from the example:

```bash
cp .env.example .env
```

Update `SGHomie/FrontEnd/.env` with the Supabase project values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key

# Leave blank to use the hosted Supabase Edge Functions.
VITE_SUPABASE_FUNCTIONS_URL=

OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_NAME=SG Homie
OPENROUTER_SITE_URL=http://localhost:5173
```

Never add `OPENROUTER_API_KEY` to the frontend environment file. Vite variables are intended for browser-side use, while the OpenRouter key must remain inside the Edge Function environment.

The `.env` file is ignored by Git. Do not commit it or paste secret values into issues, pull requests, or chat messages.

## 4. Link the Supabase Project

Go to the [Supabase Dashboard](https://supabase.com/dashboard) and create a new free project.

Note the project reference, which is the URL slug after the "project":

```aiignore
https://supabase.com/dashboard/project/YOUR_PROJECT_REF
```

From the backend directory, open a new terminal:

```bash
cd SGHomie/BackEnd
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 5. Sync the Existing Database Schema

This repository already tracks database migrations under `SGHomie/BackEnd/supabase/migrations/`. After linking the project, compare the local migration history with the hosted project:

```bash
supabase migration list
```

Push the latest migration to the hosted project:

```bash
supabase db push --dry-run
supabase db push --linked
```

Database migrations sync schema changes such as tables, columns, indexes, policies, views, and database functions. They do not copy production data.

The required database extension and the admin-account setup are documented in [`SGHomie/BackEnd/supabase/README.md`](SGHomie/BackEnd/supabase/README.md). The migration enables `pgcrypto` automatically, so no separate extension migration is needed.

## 6. Configure Edge Function Secrets

In the Supabase Dashboard, open:

```text
Edge Functions → Secrets
```

Add:

```text
OPENROUTER_API_KEY=your-openrouter-key
```

The model and site metadata have safe defaults in the function. If you want to override them for the hosted project, add these values as Edge Function environment variables as well:

```text
OPENROUTER_MODEL=openrouter/free
OPENROUTER_SITE_NAME=SG Homie
OPENROUTER_SITE_URL=https://your-live-site-url
```

Do not use `--no-verify-jwt` for production deployment. Keep JWT verification enabled if the chatbot is only for signed-in users. If the chatbot is intentionally public, configure that decision in Supabase and add suitable rate limiting before launch.

## 7. Deploy the Chatbot Edge Function

Deploy from `SGHomie/BackEnd` so the shared OpenRouter helper is included:

```bash
supabase functions deploy chatbot --use-api
```

The hosted function URL is:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/chatbot
```

After deployment, the frontend uses the hosted function automatically because `VITE_SUPABASE_FUNCTIONS_URL` is blank.

## 8. Run the Frontend

Open a second terminal:

```bash
cd SGHomie/FrontEnd
npm run dev
```

Open `http://localhost:5173` in your browser. Restart the Vite server whenever `.env` changes.

## 9. Day-to-Day Database Changes

Create a migration for each schema change:

```bash
cd SGHomie/BackEnd
supabase migration new describe_your_change
```

Edit the generated SQL file, then preview and apply it to the linked hosted project:

```bash
supabase db push --dry-run
supabase db push --linked
```

If a schema change was made directly in the Supabase Dashboard, capture it locally afterwards:

```bash
supabase db pull --linked
```

Avoid editing the production database directly when the change can be represented as a migration. This keeps the repository and hosted project in sync.

## 10. Redeploying Function Changes

Whenever an Edge Function or shared helper changes:

```bash
cd SGHomie/BackEnd
supabase functions deploy chatbot --use-api
```

There is no need to run the local function server when testing against the hosted project.

## 11. Optional Local Supabase Stack

Use this only when you need a local database, Auth, Storage, or local migrations:

```bash
cd SGHomie/BackEnd
supabase start
supabase db reset
```

The local API normally runs at `http://127.0.0.1:54321`. Local development requires Docker. Do not point the normal hosted workflow at the local URL unless you have also changed the frontend project credentials to the local Supabase credentials.

## 12. Verify Changes Before Opening a Pull Request

From `SGHomie/FrontEnd`:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

The lint command may report existing warnings. New errors should be fixed before submitting a pull request.

Before submitting, confirm that:

- No `.env` files or API keys are staged.
- Database changes are represented by reviewed migrations.
- Edge Function changes have been deployed and tested when applicable.
- The frontend builds successfully.
- The pull request explains what changed and how it was tested.

## Useful Supabase References

- [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
