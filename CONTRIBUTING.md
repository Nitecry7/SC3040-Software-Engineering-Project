# Contributing to SG Homie

Thanks for contributing to SG Homie. This guide separates local development and tests from GitHub Actions CI and the independently controlled Netlify, Supabase, and Render environments.

## Project Layout

The active application is organised as follows:

```text
SGHomie/
├── FrontEnd/       # React + Vite application
└── BackEnd/
    └── supabase/   # Database migrations and Edge Functions
```

The frontend uses React and Vite. Supabase provides Auth, PostgreSQL/RLS, Storage, and Edge Functions; the valuation Edge Function passes validated inputs to the versioned Render FastAPI service. Repository code and passing CI do not establish hosted deployment state.

## Prerequisites

Install the following before starting:

- Git
- Node.js 20.19+ or 22.12+
- npm
- Supabase CLI and Docker only when running the local Supabase stack or disposable database tests

On macOS, the Supabase CLI can be installed with Homebrew:

```bash
brew install supabase
```

## 1. Clone the Repository

```bash
git clone https://github.com/Nitecry7/SC3040-Software-Engineering-Project.git
cd SC3040-Software-Engineering-Project
```

## 2. Install Frontend Dependencies

```bash
cd SGHomie/FrontEnd
npm ci
```

## 3. Configure the Frontend Environment

Create the local environment file from the example:

```bash
cp .env.example .env
```

Set only browser-required Supabase values in `SGHomie/FrontEnd/.env`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-publishable-or-anon-key

# Leave blank to use the hosted Supabase Edge Functions.
VITE_SUPABASE_FUNCTIONS_URL=
```

`VITE_SUPABASE_FUNCTIONS_URL` is optional when using the Edge Functions associated with `VITE_SUPABASE_URL`. Do not put LLM provider configuration or credentials in the frontend environment. Provider credentials and optional model/site settings belong in the Supabase Edge Function environment; follow the [Supabase setup guide](SGHomie/BackEnd/supabase/README.md#chatbot-provider-selection).

The `.env` file is ignored by Git. Do not commit it or paste secret values into issues, pull requests, or chat messages. The browser may use only the Supabase publishable/anonymous key with the repository's RLS and authorization controls.

## 4. Chatbot authentication behavior

The chatbot function has `verify_jwt = false` in repository configuration so anonymous Buy/Sell onboarding can respond deterministically. The handler resolves the caller with Supabase Auth and returns onboarding guidance when there is no authenticated user. AI provider calls and seller operations require an authenticated user and enforce authorization in application logic. Preserve this boundary; do not disable or change authentication based on generic public-function advice.

## 5. Local database tests

Local database verification uses a disposable database in an explicitly local Supabase stack. It does not reset or modify a hosted project. Install the backend dependencies and start the local stack from `SGHomie/BackEnd/`:

```bash
cd SGHomie/BackEnd
npm ci
npx supabase start
```

From the repository root, run the isolated database harness:

```bash
python3 SGHomie/tests/run-database-tests.py --output .test-results/database.tap
```

The harness applies repository migrations to its uniquely named temporary database and cleans it up. See the [test guide](SGHomie/tests/README.md#database-access-rules-and-migrations) for lifecycle and limitations. GitHub Actions runs the same database tests against its disposable local Supabase stack; CI does not connect to hosted Supabase.

## 6. Hosted Supabase changes

Hosted migrations and Edge Functions are separate, deliberate deployment steps. From `SGHomie/BackEnd/`, confirm the target project, replace the project-reference placeholder, review migration history and pending changes, and preview before any approved hosted migration:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push --dry-run
```

Apply a migration only to the explicitly confirmed project under the team's approved release process, using `supabase db push --linked`. Deploy changed Edge Functions separately and verify their versions. Never put service-role, provider, OneMap, or Render credentials in Vite variables. Provider secrets and optional provider/model settings belong in the intended project's Edge Function secrets/configuration; see the [Supabase deployment guide](SGHomie/BackEnd/supabase/README.md).

## 7. Deploying the Chatbot Edge Function

Deploy from `SGHomie/BackEnd` so the shared OpenRouter helper is included:

```bash
supabase functions deploy chatbot --use-api
```

The hosted function URL is:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/chatbot
```

Deployment is separate from local testing and GitHub Actions. After an approved deployment, the frontend uses functions associated with `VITE_SUPABASE_URL` when `VITE_SUPABASE_FUNCTIONS_URL` is blank.

## 8. Run the Frontend

Open a second terminal:

```bash
cd SGHomie/FrontEnd
npm run dev
```

Open `http://localhost:5173` in your browser. Restart the Vite server whenever `.env` changes.

## 9. Day-to-day database changes

Create a migration for each schema change:

```bash
cd SGHomie/BackEnd
supabase migration new describe_your_change
```

Edit the generated SQL file and test it locally first. Before a hosted migration, confirm the intended project, review the migration and preview it:

```bash
supabase db push --dry-run
```

Only after approval, apply the migration to the confirmed project with `supabase db push --linked`. If a schema change was made directly in the Supabase Dashboard, capture it locally afterwards:

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

Function deployment is independent of GitHub Actions and requires a confirmed target project. Repository CI does not deploy Edge Functions.

## 11. Local Supabase development

Use Docker and the local stack for database, Auth, Storage, or local migration work:

```bash
cd SGHomie/BackEnd
supabase start
npx supabase status
```

The local API normally runs at `http://127.0.0.1:54321`. Keep local settings and credentials separate from hosted project configuration.

## 12. Verify Changes Before Opening a Pull Request

From `SGHomie/FrontEnd`:

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

The lint command may report existing warnings. New errors should be fixed before submitting a pull request.

GitHub Actions runs the application, valuation, and disposable database jobs on pull requests, pushes, and manual dispatch. A passing workflow verifies its checks for that source revision; it does not deploy or verify Netlify, hosted Supabase, or Render.

Netlify frontend deployment is configured outside this repository. Render uses the checked-in Blueprint on `main` with automatic deployment off; a Render release is separately controlled. A Git merge or passing CI run does not deploy either service. Follow the [deployment runbook](SGHomie/docs/operations/deployment-runbook.md) for release boundaries and verification.

Before submitting, confirm that:

- No `.env` files or API keys are staged.
- Database changes are represented by reviewed migrations.
- Edge Function changes have relevant local/CI checks; any separately approved hosted release is verified in its target project.
- The frontend builds successfully.
- The pull request explains what changed and how it was tested.

## Useful Supabase References

- [Supabase local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/deploy)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
