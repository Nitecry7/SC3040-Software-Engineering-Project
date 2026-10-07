# Repository Instructions

## Product and Documentation

Read `PRODUCT.md` before changing product behavior, user-facing workflows, or capability claims. It describes intended direction and current status; it is not proof that a planned feature exists.

Use the relevant document as the detailed source of truth:

- `README.md` for repository overview and local setup.
- `SGHomie/BackEnd/supabase/README.md` for migrations, Edge Functions, secrets, and deployment procedures.
- `SGHomie/docs/buy-flow.md` and `SGHomie/docs/sell-flow.md` for chatbot behavior.
- `MLPricePredictorV2/README.md` for valuation research methods and results.

Keep implementation, demo, research, and planned capabilities distinct. Repository code or a migration file does not prove hosted deployment or external-service state.

## Repository Map

- `SGHomie/` is the active application.
- `SGHomie/FrontEnd/` contains the React, TypeScript, Vite, and Tailwind frontend.
- `SGHomie/BackEnd/supabase/` contains Supabase configuration, migrations, seed data, and Edge Functions.
- `MLPricePredictorV2/` contains new HDB price research. `MLPricePredictor/` is legacy and has target leakage; do not use its metrics or artifacts as evidence or modify it unless explicitly requested.
- `MLPricePredictorV2/data/raw/` contains local, Git-ignored source datasets. Do not commit raw data or generated processed datasets.
- `archived_migrations/` is historical; do not modify it.

## Change Discipline and Data Safety

1. Inspect the current implementation and relevant documentation before changing behavior.
2. Keep changes scoped and avoid unrelated file churn.
3. Put every database schema change in a new migration under `SGHomie/BackEnd/supabase/migrations/`; never edit an applied migration to change the current schema.
4. Preserve Row Level Security and review policies when access patterns change. Do not bypass RLS to make a feature work.
5. Preview linked database changes before applying them. Never run destructive reset commands against a hosted project; `supabase db reset` is for an explicitly local environment.
6. Keep service-role, OpenAI, OpenRouter, OneMap, and other privileged credentials out of frontend code, committed files, logs, screenshots, and examples. Browser code may use the Supabase publishable/anonymous key only with appropriate RLS.
7. Do not invent property records, amenities, distances, coordinates, market metrics, comparable sales, recommendations, or model outputs. Identify data provenance and distinguish historical transactions, current asking listings, estimates, and general explanations.
8. Clearly label synthetic or placeholder content. Production UI must not present generated market data as verified evidence.
9. Verify live services and deployments separately from repository code. Describe what was checked and in which environment.

## Machine Learning

1. New HDB price work belongs in `MLPricePredictorV2/`; do not build on the leaky legacy directory.
2. Keep `resale_price` and deterministic derivatives of the current target out of its predictors. Use only information available at prediction time.
3. Respect chronological splits. Fit preprocessing on the fitting partition only; validation and test targets must not influence features, transformations, or training.
4. Historical aggregates, comparable sales, lagged prices, and rolling features may use only transactions strictly before the prediction date.
5. Include tests for leakage-sensitive logic, feature schema, parsers, and split boundaries. Report appropriate metrics (including MAE, RMSE, MAPE, R², and median absolute error when relevant) and compare against a suitable baseline.
6. Record data provenance, covered and split periods, schema, model configuration, and metrics for serious evaluations. Keep local raw and processed data untracked.
7. Do not integrate or present a model as production until leakage checks, chronological validation, final test evaluation, and an approved artifact are complete. User income may inform affordability but must not be a property-value feature.

## Valuation, Recommendations, and Data Sources

- Describe valuation outputs as estimates, not official valuations or financial advice. Prefer an estimated range and supporting verified historical comparables when available; never fabricate comparables.
- Keep valuation (current value of a property), market outlook (future movement of a broader segment), and affordability (fit for a particular buyer) separate.
- Do not use an LLM as the authoritative recommendation ranker. Ranking should use explainable deterministic or explicitly modeled criteria, with hard constraints separated from preferences. Do not call filter matching intelligent ranking.
- Prefer authoritative Singapore sources. Use official HDB/data.gov.sg transaction data for historical resale research and trustworthy geospatial sources for location features. Do not scrape commercial listing platforms against their terms.
- Handle failed or ambiguous geocoding explicitly. Do not present town centroids, synthetic locations, or estimated distances as exact property locations or verified nearby facilities.

## Chatbot

- The frontend calls a Supabase Edge Function. The server supports OpenRouter and OpenAI through provider configuration; keep provider credentials server-side. Read the buyer or seller flow document before changing that journey.
- Buyer search has a structured, read-only tool for approved HDB listings. This is search and sorting, not an explainable recommendation-ranking engine. The current demo amenity records are synthetic; OneMap is used for seller HDB postal-code/address verification, not real nearby-amenity search.
- The LLM explains trusted results supplied by application tools. It must not invent listings, IDs, asking prices, valuations, distances, amenities, comparable transactions, or recommendation scores. Never allow unrestricted arbitrary SQL; tool inputs and outputs need explicit schemas.
- Structured application results take precedence over model memory. If trusted information is missing, say so. Keep general housing explanations separate from current listing facts.
- Do not add LangChain, LangGraph, or another orchestration framework without a concrete need.

## Architecture Boundaries

- The frontend handles presentation, interaction, and calls to trusted interfaces; it must not contain privileged credentials or be treated as the authority for approvals, model metadata, or audited predictions.
- Supabase owns authentication, persistence, RLS, migrations, database functions, Edge Functions, and server-side secrets.
- Keep Python training and inference separate from the browser and Supabase. A future inference service should expose a narrow validated contract and load an approved artifact rather than train during requests.
- Avoid adding databases, queues, vector stores, microservices, or large frameworks without a demonstrated requirement.

## Frontend and Verification

- Read `PRODUCT.md` before substantial UI work. Use Impeccable when appropriate for focused accessibility, responsive layout, and visual review. Preserve the existing design system and scope.
- Keep controls keyboard-usable with visible focus. Use color as reinforcement, not the only way to communicate status. Identify demo content and uncertainty clearly.
- For frontend changes, run relevant checks from `SGHomie/FrontEnd/`: `npm run lint`, `npx tsc --noEmit`, `npm run build`, and applicable tests. Report pre-existing failures separately; do not weaken tests to hide them.
- For Python ML changes, run the relevant automated tests. For documentation changes, verify links and commands and run `git diff --check`.
- Do not claim a check passed unless it ran. Report files changed, checks and results, limitations, assumptions, and follow-up work.
