# Repository Instructions

## Product Direction and Implementation Status

Read `PRODUCT.md` before changing product behavior, user facing workflows, product copy, or describing SG Homie's capabilities.

`PRODUCT.md` describes the intended product direction: a data informed Singapore HDB decision platform with trusted market data, valuation, affordability aware discovery, location and amenity insights, explainable recommendations, seller pricing guidance, and conversational access to trusted application data.

Treat `PRODUCT.md` as product intent, not proof that those capabilities currently exist.

Before modifying a feature, inspect its current implementation and distinguish clearly between:

1. Implemented functionality
2. Placeholder or demonstration functionality
3. Provisional functionality
4. Planned functionality

Do not present planned or placeholder capabilities as working features.

The most recent repository audit found the following, but always verify the current code because implementation may change:

1. Market analytics currently contain generated or hardcoded values.
2. Profile preferences currently filter search results rather than perform intelligent ranking.
3. The chatbot uses an LLM but currently has no trusted live listing or market data retrieval tools.
4. The legacy machine learning experiments under `MLPricePredictor/` are disconnected from the active application and contain target leakage.
5. Google authentication and live market data integration were not verified in the inspected frontend.
6. A repository code path does not prove that a hosted deployment, migration, secret, Edge Function, or external service is currently active.

## Repository Map

`SGHomie/`

is the active web application.

`SGHomie/FrontEnd/`

contains the active React, TypeScript, Vite, and Tailwind frontend.

`SGHomie/BackEnd/supabase/`

contains the active Supabase configuration, migrations, seed data, database related code, and Edge Functions.

`MLPricePredictor/`

contains legacy machine learning experiments with known methodological problems, including target leakage. Do not use its model metrics or generated prediction artifacts as production evidence. Do not modify it unless explicitly requested.

`MLPricePredictorV2/`

contains the clean implementation for new HDB price modelling work.

`MLPricePredictorV2/data/raw/`

contains local raw datasets used for modelling. These datasets are not committed to Git.

`archived_migrations/`

contains historical migrations. Do not modify them.

The obsolete `sghome/` frontend has been deleted. Do not recreate or target it.

## Change Discipline

1. Inspect the current implementation and relevant repository guidance before changing code.
2. Make small, scoped changes.
3. Do not modify unrelated files.
4. Do not modify application code when a task asks only for documentation, investigation, architecture analysis, or repository guidance.
5. Represent every database schema change using a new Supabase migration under:

   `SGHomie/BackEnd/supabase/migrations/`

6. Never modify an already applied historical migration in order to change the current database schema.
7. Preserve Row Level Security.
8. Review and update RLS policies deliberately whenever database access patterns change.
9. Do not bypass RLS merely to make a feature work.
10. When working with a linked hosted Supabase project, preview schema changes before applying them.
11. Do not run destructive database reset commands against a hosted Supabase project.
12. Commands such as `supabase db reset` may only be used when working with an explicitly local Supabase environment.
13. Never expose Supabase service role keys, OpenRouter API keys, OneMap credentials, or other privileged secrets in frontend code, committed configuration, logs, screenshots, documentation, or generated examples.
14. The Supabase publishable or anonymous browser key may be used in the frontend when protected by correct Row Level Security.
15. Do not invent property records, amenities, distances, coordinates, market analytics, comparable transactions, recommendations, or machine learning outputs.
16. Identify the provenance of application data whenever practical.
17. Distinguish clearly between:

verified public data

user generated listings

application database records

machine learning estimates

comparable transaction evidence

general AI explanations

18. Production UI must not use randomly generated market information.
19. Placeholder content must be clearly identified as placeholder content.
20. A repository implementation does not prove that a hosted service, migration, Edge Function, secret, production database, or deployment is currently active. Distinguish code path verification from live service verification.

## Machine Learning Rules

1. New HDB price modelling work belongs in `MLPricePredictorV2/`.
2. Do not use `MLPricePredictor/` as the foundation for the production model.
3. Every model input must be information that would realistically be available at inference time for the property being valued.
4. When predicting `resale_price`, never use `resale_price` itself as an input feature.
5. Never use a deterministic derivative of `resale_price` as an input feature when predicting `resale_price`.
6. Examples of invalid leakage include:

   `price_per_sqm` derived from the current transaction price

   current row target based aggregates

   future transaction values

   validation target values

   test target values

   rolling statistics that include the transaction currently being predicted

7. Aggregate price features, comparable sales features, lagged price features, and rolling market features may only use information available strictly before the prediction date.
8. Validation and test target values must never influence training features.
9. Train, validation, and test splits must respect time.
10. Do not randomly split historical housing transactions when the intended production use case predicts future transactions from past data.
11. Fit preprocessing transformations only on the appropriate training data.
12. Do not calculate encoders, scalers, price aggregates, imputers, feature statistics, or learned transformations using validation or test data.
13. Use the validation set for model selection, feature selection, threshold selection, and hyperparameter tuning.
14. Keep the final test set untouched until the model design and hyperparameters have been selected.
15. Evaluate against a simple baseline before claiming that an ML model adds value.
16. Suitable baseline examples include recent comparable transaction medians or simple historical group medians.
17. Report multiple evaluation metrics where relevant, including:

MAE

RMSE

MAPE

R squared

median absolute error

18. Do not rely on raw MSE alone when communicating model quality to users or project reviewers.
19. Record the following for every model candidate intended for serious evaluation or integration:

dataset source

dataset identifier where applicable

dataset retrieval date

covered transaction period

training period

validation period

test period

feature schema

model type

model version

model parameters

evaluation metrics

20. User income may inform affordability and recommendation suitability.
21. User income must not be used as a property market value feature.
22. Property valuation and user affordability are separate concerns.
23. Recommendation scoring may use affordability related signals, but valuation models should estimate property market value independently of who is viewing the property.
24. Do not treat legacy model metrics, legacy generated HTML, legacy charts, or legacy prediction artifacts as production evidence.
25. Python ML changes must include appropriate automated tests.
26. Add tests for leakage sensitive logic such as:

chronological splitting

target exclusion

rolling feature boundaries

aggregate feature boundaries

feature schema validation

remaining lease parsing

storey parsing

27. Raw datasets under `MLPricePredictorV2/data/raw/` are local inputs and must not be committed.
28. Generated processed datasets should normally remain local unless there is a specific documented reason to version a small derived artifact.
29. Model artifacts should have an explicit version and metadata.
30. Do not integrate a model into the application until leakage checks, validation, and final test evaluation have been completed.

## Valuation and Comparable Transactions

1. SG Homie's valuation feature should provide an estimate rather than claim an authoritative property valuation.
2. Prefer language such as:

   estimated market value

   estimated market range

   model estimate

   comparable historical transactions

3. Avoid definitive language such as:

   objectively overpriced

   guaranteed bargain

   guaranteed investment return

4. Buyer and seller experiences should use the same trusted valuation engine where practical.
5. Comparable transactions should be selected using documented and reproducible rules.
6. Do not fabricate comparable transactions.
7. Where possible, provide the user with both:

   a model estimate

   supporting historical comparable transaction evidence

8. If uncertainty intervals are implemented, prefer presenting an estimated range rather than false precision from one exact number.
9. If prediction confidence is shown, define how it is calculated.
10. Model estimates must include an appropriate informational disclaimer.

## Recommendation Rules

1. Do not use an LLM as the authoritative ranking engine for property recommendations.
2. Recommendation ranking should use deterministic or explicitly modelled criteria.
3. Distinguish between hard constraints and soft preferences.
4. Hard constraints may include:

   listing approval status

   budget ceiling

   property type

   flat type

5. Soft preferences may include:

   preferred town

   MRT proximity

   school proximity

   remaining lease

   amenities

   price position relative to estimated market value

6. Recommendation scoring should be explainable.
7. A recommended property should include understandable reasons for its ranking.
8. Do not label simple profile based filtering as AI recommendation.
9. Recommendation weights should be documented and configurable where practical.
10. Missing optional data should not automatically invalidate otherwise suitable listings.

## Chatbot Rules

1. The current chatbot architecture uses a Supabase Edge Function and OpenRouter.
2. Do not replace the current chatbot architecture without a concrete technical reason.
3. The LLM should explain trusted application data supplied to it.
4. The LLM must not fabricate:

   listings

   listing IDs

   asking prices

   predicted values

   distances

   nearby schools

   nearby MRT stations

   comparable transactions

   recommendation scores

5. The model must not construct unrestricted arbitrary SQL queries.
6. Trusted application tools should perform database and service operations.
7. Tool inputs and outputs should use explicit schemas.
8. Structured application data takes precedence over unsupported model memory.
9. If required information is unavailable, the chatbot should say so rather than inventing an answer.
10. When essential recommendation constraints are missing, the chatbot may ask a clarifying question.
11. General housing explanations should be distinguished from current SG Homie listing information.
12. Model generated valuations must be described as estimates.
13. Do not introduce LangChain or LangGraph unless the application develops a concrete orchestration requirement that cannot be handled cleanly with simpler tool calling.
14. LangSmith or another observability system may be considered later for tracing and evaluation, but it is not required for the initial architecture.

## Data Source Rules

1. Prefer authoritative Singapore public data sources where suitable.
2. Historical HDB transaction data should use an official HDB or data.gov.sg source.
3. Store or document the source dataset identifier and retrieval date.
4. Do not scrape a commercial property platform when its terms prohibit automated collection.
5. Current SG Homie seller listings are user generated marketplace data and must be distinguished from official historical transaction records.
6. Historical transactions and current asking listings are different datasets and should not be presented interchangeably.
7. Geospatial information should come from trustworthy sources such as OneMap or official geospatial datasets where possible.
8. Do not use randomly generated or approximate town centroid coordinates as though they were exact property locations.
9. Failed or ambiguous geocoding should be handled explicitly.

## Architecture Boundaries

### React Frontend

The frontend is responsible for:

1. Browser UI
2. Navigation
3. Presentation
4. User interaction
5. Client side state
6. Calling trusted application interfaces

The frontend may use the Supabase publishable or anonymous key when appropriate RLS policies are in place.

The frontend must never contain privileged server credentials.

The browser must not be treated as the authoritative source of trusted prediction records, model metadata, approval state, or privileged calculations.

### Supabase

Supabase is responsible for:

1. Authentication
2. PostgreSQL persistence
3. Row Level Security
4. Database constraints
5. Database functions where appropriate
6. Edge Functions
7. Server side secret handling

Keep database schema changes in migrations.

Keep sensitive operations behind trusted server side boundaries.

### Chatbot

The chatbot currently uses:

1. React frontend
2. Supabase Edge Function
3. OpenRouter
4. LLM

Future chatbot tools may retrieve trusted application data, recommendations, valuation results, historical transactions, and location information.

The LLM should explain trusted results rather than invent them.

### Python ML Service

The future Python ML service should remain logically separate from both the browser frontend and the Supabase database.

It should expose a narrow and validated inference contract.

Training and inference should remain separate processes.

The inference service should load an approved model artifact rather than retraining on request.

Do not provide the ML service with unrestricted application database credentials unless there is a demonstrated requirement.

Expose only the inputs required for inference through a controlled server side path.

Where predictions are persisted or used for trusted application decisions, obtain or verify them through a trusted backend boundary.

Do not trust browser supplied prediction values as authoritative audit records.

### Major Infrastructure

Do not introduce any of the following without a demonstrated requirement:

1. LangChain
2. LangGraph
3. Another database
4. Redis
5. Kafka
6. Kubernetes
7. Additional microservices
8. Vector databases
9. Large infrastructure frameworks

Prefer the simplest architecture that correctly satisfies the current requirement.

## Frontend Design Rules

Read `PRODUCT.md` before performing major UI work.

Use Impeccable when appropriate for UI critique, accessibility, layout, responsiveness, and polish.

The interface should emphasize:

1. Property information
2. Search usability
3. Market evidence
4. Fair value insights
5. Historical comparisons
6. MRT and school proximity
7. Affordability
8. Explainable recommendations
9. Clear distinction between verified data and estimates

Avoid unnecessary generic AI website patterns such as:

1. Unsupported success statistics
2. Fake testimonials
3. Random market metrics
4. Excessive gradients
5. Excessive nested cards
6. Generic AI powered marketing claims
7. Decorative complexity that reduces information clarity

Preserve accessibility and responsive behavior.

Do not redesign the entire application in one change unless explicitly requested.

## Verification

For frontend changes, run relevant checks from:

`SGHomie/FrontEnd/`

Use:
npm run lint
npx tsc --noEmit
npm run build

If the repository contains pre existing warnings, distinguish them from new errors introduced by the current change.

For Python ML changes, run the relevant automated tests.

Report the exact commands executed.

Do not claim checks were run unless they were actually executed.

Do not change production behavior or weaken tests merely to hide a failing test.

For Supabase migration work, review migrations before applying them.

Where supported, preview hosted database changes before applying them.

Do not perform destructive hosted database operations during verification.

## Handoff Requirements

At the end of every implementation task, report:

1. Files changed
2. What was implemented
3. Commands or tests run
4. Results
5. Remaining limitations
6. Any assumptions made
7. Any follow up work that is still required
   If verification was not requested, could not be run, or requires external credentials, say so clearly.
