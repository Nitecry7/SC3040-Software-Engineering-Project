# Chatbot buyer search

## Implemented behavior

Anonymous users receive deterministic onboarding only. **Buy** returns a bounded
summary of approved application HDB listings when retrieval succeeds, with no
individual listings or private seller details. Summary failures omit counts;
they never fall through to AI. Application listings may include demo records and
are not completed transactions. Explore and individual Property Details routes
remain login-protected. Other anonymous messages receive sign-up/login guidance,
without provider or search-tool access. Approved listing rows retain their
existing public Supabase RLS visibility; the route gate controls application UI
navigation, not direct Data API reads.

The following buyer conversation behavior requires a server-verified, registered
Supabase user:

1. A bare “Buy” request asks for useful search preferences before querying listings. A direct listing-search request can proceed with its stated requirements.
2. The buyer flow keeps earlier filters until the user changes or clears them. Explicit town, budget, and room-type requirements are validated server-side; filters are not relaxed without the user's agreement.
3. The chatbot calls the read-only `search_listings` tool. It searches approved HDB listings, supports town, price, room type, recorded bedrooms/bathrooms, floor area, literal text keywords, and deterministic sort options. Results are limited to three listings and include the applied filters and total match count.
4. The frontend renders listing cards from the returned records. The assistant may summarize those same results; if its explanatory response is unavailable or invalid, a deterministic summary preserves the verified cards and search result.

## Boundaries and data meaning

- Search results come from application listing records and are current only when the tool returns them. Asking prices are not completed resale transaction prices.
- HDB room type is matched against listing title/description and is distinct from seller-recorded bedroom count. Keyword matches establish text presence only.
- Search and sorting are not a deterministic recommendation score or personalized ranking engine. Sort order is price ascending by default, with supported price-descending, area-descending, and newest options.
- The tool cannot verify MRT distances, schools, floor, lease, or other amenity facts. Nearby demo records are synthetic and are not returned as verified search evidence.
- The LLM explains tool results but does not create or modify listings in the buyer flow. It must not invent properties, prices, availability, named alternatives, distances, or suitability claims.
- Chat history is temporary context, not saved account memory. Buyer/general AI responses are screened for unsupported persistence claims and sensitive identifiers; a phone number or email in a buyer message receives a fixed privacy reminder before quota, telemetry, or provider processing.
- If no listings match, the chatbot reports that result and may ask which filter to change. It does not silently broaden the search. Switching to Sell enters the separate seller flow.

## Architecture

The Edge Function verifies identity before creating a provider or entering buyer
or seller orchestration. Missing, invalid, expired and Supabase anonymous-user
sessions cannot invoke AI. Browser intents and contexts cannot authorize access.

The React chatbot sends requests to the Supabase `chatbot` Edge Function. The buyer handler uses the configured OpenRouter or OpenAI provider to form structured tool calls; server code validates filters and queries approved HDB records. The tool result is kept separate from the LLM's explanatory text, and the frontend receives the verified listing data for cards. Provider credentials remain server-side. The repository does not establish which provider, secrets, function version, or deployment is active in a hosted environment.

For seller intake, provider configuration, credentials, migrations, and deployment procedures, see [Supabase setup](../BackEnd/supabase/README.md) and [Chatbot seller intake](sell-flow.md).

**New chat** clears temporary messages, input, buyer filters and seller intake,
and returns to Buy/Sell. It invalidates and aborts the old request so late results
cannot enter the new conversation. Login, profile preferences and saved records
remain intact. Closing the window continues to minimize it without resetting.

## Validation

From the repository root, run the isolated buyer-flow tests:

```bash
node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test ./SGHomie/tests/buy-flow.test.mjs
```

The tests use fixtures and mock provider/database calls; they do not write fabricated listings to a hosted database or verify a hosted deployment.
