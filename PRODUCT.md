## `PRODUCT.md`

```md
# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SG Homie serves users participating in Singapore's HDB resale housing journey.

The primary user group is HDB buyers.

Buyers use SG Homie to:

1. Discover available HDB listings.
2. Search using criteria such as town, flat type, room configuration, price, location, and property characteristics.
3. Understand historical HDB resale market information.
4. Evaluate whether an asking price appears consistent with historical market evidence.
5. Understand proximity to transport, schools, and other amenities.
6. Receive explainable property recommendations based on their preferences and affordability constraints.
7. Enquire about properties.
8. Ask housing related questions through the conversational assistant.

Sellers are a secondary user group.

Sellers use SG Homie to:

1. Create and manage HDB property listings.
2. Submit listings for review.
3. Understand how their asking price compares with estimated market value.
4. Review comparable historical transactions.
5. Receive data informed pricing guidance before publishing a listing.

Administrators support platform integrity through listing review, user management, enquiry handling, and other administrative workflows.

Some current capabilities remain incomplete or provisional. Product intent must not be presented as proof that every listed capability is already implemented.

## Product Purpose

SG Homie is a Singapore HDB housing decision platform designed to help buyers and sellers make better informed property decisions using trustworthy market data.

For buyers, SG Homie should support property discovery, affordability aware search, historical market analysis, fair value estimation, location and amenity insights, and explainable personalized recommendations.

For sellers, SG Homie should support property listing submission and provide data driven guidance on how the seller's asking price compares with estimated market value and comparable historical transactions.

The long term objective is to combine property discovery, valuation, market analytics, recommendation, seller guidance, and conversational assistance into one coherent housing decision workflow.

SG Homie should reduce the amount of fragmented information a user must interpret when evaluating an HDB property.

The platform should help answer questions such as:

1. Does this property fit my stated preferences and budget?
2. How does this asking price compare with historical market evidence?
3. What have similar HDB flats recently transacted for?
4. How close is this property to MRT stations, schools, and useful amenities?
5. Why is this property being recommended to me?
6. If I am selling, how does my proposed asking price compare with the estimated market range?

SG Homie should support these decisions with evidence and explanations rather than presenting unsupported AI generated conclusions.

## Positioning

SG Homie should be positioned as a data informed HDB decision companion rather than simply a listing marketplace or generic AI property website.

Its key differentiation is the combination of:

1. Official Singapore housing transaction data.
2. Explainable property valuation.
3. Buyer preference and affordability signals.
4. MRT, school, and amenity proximity.
5. Personalized property ranking.
6. Seller pricing guidance.
7. Historical comparable transaction evidence.
8. Conversational access to trusted application data.

The system should clearly distinguish:

1. Verified public data.
2. User generated property listings.
3. Application database records.
4. Machine learning estimates.
5. Comparable historical transactions.
6. General AI explanations.

Features that are not yet implemented must be described as planned capabilities rather than presented as live functionality.

SG Homie should not position itself as providing an official property valuation, financial advice, guaranteed investment returns, or guaranteed future housing prices.

## Operating Context

SG Homie is a browser based web application.

The active application is located under:

`SGHomie/`

The active frontend is:

`SGHomie/FrontEnd/`

It uses:

React

TypeScript

Vite

Tailwind CSS

React Router

Supabase JavaScript

The active Supabase backend is located under:

`SGHomie/BackEnd/supabase/`

Supabase currently provides the primary application backend capabilities including authentication, PostgreSQL persistence, Row Level Security, migrations, and Edge Functions.

The chatbot runs through a Supabase Edge Function and supports OpenRouter or OpenAI through server-side provider configuration. Its buyer flow has a structured, read-only search tool for approved HDB listings. This code path does not establish the provider or Edge Function configuration of a hosted environment.

The current machine learning experiments under:

`MLPricePredictor/`

are legacy experiments and are not trusted as production modelling evidence.

New machine learning work belongs under:

`MLPricePredictorV2/`

The planned valuation architecture separates model training and inference from the browser frontend.

## Core Product Areas

### Property Discovery

SG Homie should allow buyers to discover relevant HDB listings using structured filters.

Useful criteria may include:

1. Town
2. Price range
3. Flat type
4. Room configuration
5. Floor area
6. Remaining lease
7. Storey range
8. MRT proximity
9. School proximity
10. Other relevant amenities

The product should distinguish basic filtering from personalized ranking.

A property matching a filter is not automatically an intelligent recommendation.

### Property Valuation

SG Homie should provide a machine learning based estimate of current property value using legitimate historical data and features available at prediction time.

The valuation experience should prefer understandable outputs such as:

1. Estimated market value
2. Estimated market range
3. Asking price
4. Difference from estimated value
5. Difference percentage
6. Price position relative to the estimated range
7. Comparable historical transactions
8. Model version or methodology information where useful

Preferred user facing labels include:

Below estimated market range

Within estimated market range

Above estimated market range

The platform should avoid presenting model estimates as authoritative valuations.

### Comparable Transactions

Historical comparable transactions should support both valuation explainability and user decision making.

Comparable transactions should come from verified historical transaction data.

The product should make it clear that:

historical resale transactions

current seller asking prices

machine learning estimates

are different concepts.

Comparable transactions should never be fabricated.

### Buyer Recommendations

The future recommendation system should help users prioritize suitable properties.

Recommendations should combine structured property information with user preferences.

Potential signals include:

1. Budget suitability
2. Preferred location
3. Flat type
4. MRT proximity
5. School proximity
6. Remaining lease
7. Amenities
8. Asking price position relative to estimated market value
9. Other explicit buyer preferences

Recommendations should be explainable.

The interface should tell the buyer why a property is recommended.

An LLM should not be the authoritative ranking mechanism.

### Affordability

Affordability and property valuation are separate product concepts.

Property valuation estimates what a property may reasonably be worth in the market.

Affordability considers whether a particular buyer can reasonably consider a property based on factors such as income, available budget, financing assumptions, grants, or other financial constraints.

Buyer income may influence affordability and recommendation suitability.

Buyer income should not influence the estimated market value of the property.

### Seller Pricing Guidance

Before submitting or publishing a listing, sellers should be able to compare their proposed asking price with SG Homie's estimated market value and relevant historical transactions.

The system may inform the seller that the asking price is:

Below estimated market range

Within estimated market range

Above estimated market range

The platform should not force the seller to use the model estimate.

The seller remains responsible for selecting the final asking price.

SG Homie should provide information rather than arbitrarily blocking a seller based on a model output.

### Market Analytics

Market analytics should eventually use verified historical transaction data.

Useful analytics may include:

1. Median resale price over time
2. Transaction volume
3. Price by town
4. Price by flat type
5. Historical market trends
6. Comparable area trends

The interface should clearly identify the data period and data source.

Generated or hardcoded values must not be presented as verified market analytics.

Historical HDB transaction data should be distinguished from SG Homie active marketplace listings.

### Market Outlook

Future market outlook should estimate how a broader HDB segment may move over time. It is distinct from property valuation, which estimates the current value of a particular property. Forecasting and buy-now-or-wait decision support are planned, not implemented. A future LLM may explain trusted forecast evidence, but should not act as the authoritative numerical forecaster.

### Location and Amenity Insights

SG Homie should provide meaningful location context using trustworthy geospatial information.

Useful information may include:

1. Property coordinates
2. Nearest MRT station or exit
3. Distance to MRT
4. Nearby schools
5. School distance
6. Nearby amenities
7. Other location based signals relevant to property discovery

Approximate town centroids must not be represented as exact property coordinates.

Current nearby-amenity records are deterministic synthetic demo data with `source = 'demo'`. They must not be presented as verified facilities, real distances, or OneMap results. Real amenity ingestion from OneMap or authoritative public datasets remains planned. OneMap currently supports seller HDB postal-code/address lookup.

### Conversational Assistant

The chatbot should provide a conversational interface to SG Homie's trusted application capabilities. Its current buyer search uses a structured, read-only tool to retrieve approved HDB listings; it does not provide an authoritative recommendation-ranking engine.

Future assistant tools may retrieve trusted application information for:

1. Property details and user preferences
2. Explainable property recommendations
3. Property valuation
4. Comparable transactions
5. Verified nearby MRT, school, and amenity information
6. Historical market information and future market outlook

The LLM should explain retrieved facts rather than fabricate application data.

General housing explanations should be clearly distinguishable from current listing information.

The chatbot should acknowledge uncertainty when trusted information is unavailable.

## Data Principles

Official or authoritative Singapore datasets should be preferred where appropriate.

The main historical HDB resale dataset for the new modelling work is intended to come from Housing and Development Board data published through data.gov.sg.

Historical transaction data should be used for:

1. Model training
2. Market analytics
3. Comparable transaction evidence
4. Historical trend analysis

User generated SG Homie listings represent current marketplace asking listings.

Historical completed transactions and current asking listings must not be treated as interchangeable data.

Where geospatial information is required, trustworthy services or official data sources such as OneMap, official MRT datasets, and official school datasets should be preferred where practical.

Every important data source should have identifiable provenance.

## AI and Machine Learning Principles

Machine learning should be used where it provides measurable value.

The objective is not to use the most complicated possible model.

SG Homie should compare reasonable baselines and candidate models before selecting a production model.

Model selection should be based on fair chronological evaluation.

Machine learning outputs should be explainable where practical.

User facing outputs should communicate uncertainty rather than false precision.

Deep learning may be evaluated experimentally, but it should not be assumed to outperform appropriate tabular regression models.

The production model should only be selected after comparison against strong baselines.

The product should never use known target leaking features to create misleading model performance.

## Current Capabilities and Constraints

The following reflects the inspected application state and should be verified again whenever implementation changes.

1. Email and password account signup and sign in are implemented in the frontend.

2. Profile setup and role specific routes exist.

3. Buyers can search approved listings using manual filters.

4. Profile preferences currently help populate or constrain filters but do not constitute a true recommendation ranking system.

5. Sellers can submit listings and manage their own listings subject to database policies.

6. Property detail flows exist.

7. Enquiry flows exist.

8. The chatbot runs through a Supabase Edge Function with OpenRouter/OpenAI provider selection. Its buyer flow has structured read-only search for approved HDB listings. It has no trusted historical-market, valuation, or nearby-amenity retrieval tool.

9. The analytics page currently uses randomly generated chart values and hardcoded summary figures.

10. Current analytics must be treated as demonstration content rather than verified market analytics.

11. Existing seed listings are development or demonstration content and must not automatically be described as production listings.

12. Email and password authentication are implemented. Google authentication is not implemented in the inspected frontend.

13. A live external market analytics feed is not implemented in the active frontend.

14. Seller HDB postal-code/address verification uses server-side OneMap geocoding and official HDB property information, with a short-lived seller-bound verification token enforced by a database trigger. This verifies the lookup path; it does not prove that every existing or synthetic listing is genuine.

15. Legacy price prediction experiments under `MLPricePredictor/` are not integrated into the active application.

16. Legacy ML experiments contain target leakage and their metrics must not be used as evidence of production model quality.

17. Nearby amenities are deterministic synthetic demo rows marked `source = 'demo'`; live amenity ingestion is not implemented. The demo trigger and data do not establish a hosted environment's migration state.

18. `MLPricePredictorV2/` is the current valuation research implementation. CatBoost is the selected robust research candidate after chronological, baseline, matched-history, temporal, and GPU-repeatability evaluation. It is not a persisted or approved production model, is not integrated into SG Homie, and has no inference service. Detailed methodology and results belong in `MLPricePredictorV2/README.md`.

19. The repository does not by itself verify the state of hosted migrations, secrets, Edge Functions, deployments, or production data.

## Brand Commitments

The product name is SG Homie.

The repository contains an SG Homie logo at:

`sghomielogo.png`

SG Homie should feel:

1. Trustworthy
2. Practical
3. Data informed
4. Clear
5. Approachable
6. Singapore focused
7. Evidence driven

The interface should avoid looking like a generic AI generated software landing page.

Product communication should prioritize useful property evidence and decision support over exaggerated AI marketing.

## Evidence on Hand

The repository contains:

1. Active React frontend source under `SGHomie/FrontEnd/`.
2. Supabase backend configuration under `SGHomie/BackEnd/supabase/`.
3. Database migrations.
4. Supabase seed data.
5. Seller listing workflows.
6. Buyer property search flows.
7. Enquiry workflows.
8. Chatbot integration code.
9. Legacy machine learning experiments.
10. The original SG Homie software requirements specification.
11. A local official HDB resale transaction dataset for new modelling work under `MLPricePredictorV2/data/raw/`.

The local raw dataset is not committed to Git.

Generated analytics, unsupported marketing claims, demonstration testimonials, synthetic amenity records, and legacy model outputs must not be reused as factual evidence without validation.

## Product Principles

1. Use evidence before claims.

2. Clearly distinguish verified information from estimates.

3. Make important data provenance understandable.

4. Do not present placeholders as real market information.

5. Keep buyer preferences understandable and under the buyer's control.

6. Give sellers useful market context without taking control of their pricing decision.

7. Prefer explainable recommendations over opaque rankings.

8. Prefer understandable valuation ranges over false precision.

9. Use official or trustworthy Singapore data where practical.

10. Do not let AI invent trusted application facts.

11. Treat the LLM as an explanation and interaction layer around trusted application systems.

12. Keep property valuation separate from user affordability.

13. Do not claim model quality until it has been evaluated using leakage safe methodology.

14. Design for informed housing decisions rather than generic AI novelty.

15. Make the distinction between asking prices, historical transaction prices, and model estimates obvious.

16. Maintain a clear path from evidence to recommendation.

17. Preserve user trust by communicating uncertainty and limitations.

## Claims to Avoid Until Implemented and Verified

Do not claim that SG Homie currently provides any of the following unless the implementation has been completed and verified:

1. Live HDB market analytics.
2. Real time market data.
3. Explainable recommendation ranking.
4. Chatbot retrieval of property valuation or verified nearby-amenity data beyond the current approved-listing search.
5. Grounded chatbot access to historical market data.
6. Production machine learning valuation.
7. Guaranteed fair value.
8. Official property valuation.
9. Google authentication.
10. Real amenity ingestion or verified MRT, school, shopping, healthcare, food, park, or community locations and distances.
11. Automated current commercial marketplace listing ingestion.
12. Guaranteed time to sell.
13. Guaranteed future property appreciation.
14. Financial advice.
15. Investment return guarantees.

When such features are planned but not implemented, describe them as planned capabilities.
```
