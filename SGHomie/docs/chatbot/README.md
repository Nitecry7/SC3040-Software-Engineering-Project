# SG Homie chatbot

The chatbot UI calls the Supabase `chatbot` Edge Function. OpenAI or OpenRouter can provide language responses through server-side configuration; bounded application tools handle listing search and seller draft intake. The model does not have arbitrary SQL access, and trusted application results take precedence over model memory.

## Buyer listing search

The buyer flow uses the validated, read-only `search_listings` tool to search and sort approved HDB listings. It is not a personalized recommendation-ranking engine. The LLM can explain returned records but must not invent listing IDs, prices, amenities, distances, or valuation evidence.

```mermaid
sequenceDiagram
    actor Buyer
    participant UI as React chat UI
    participant Edge as Supabase chatbot Edge Function
    participant LLM as Configured LLM provider
    participant Tool as Validated search_listings application tool
    participant DB as Approved HDB listing records
    Buyer->>UI: Ask for listings
    UI->>Edge: Message and session context
    Edge->>LLM: Request response with bounded tool schema
    LLM-->>Edge: search_listings call with requested filters
    Edge->>Tool: Validate filters and sort fields
    Tool->>DB: Read-only search of approved application listings
    DB-->>Tool: Matching structured listing records
    Tool-->>Edge: Structured search results
    Edge->>LLM: Ask for explanation grounded in returned records
    LLM-->>Edge: Explanation text
    Edge-->>UI: Explanation and structured results as separate fields
    UI-->>Buyer: Show answer and listing cards
```

*The tool performs validated, read-only listing search; it does not run arbitrary SQL. Structured results remain separate from the LLM explanation. Search and sorting do not provide personalized recommendation ranking or verify listing truth.*

## Seller intake

Seller intake verifies the HDB address, extracts details supplied in chat, and saves an owner-bound draft. The seller reviews and completes the draft in the dashboard before submission. Any suggested asking price is provisional AI guidance based on application asking listings, separate from the CatBoost research/demo valuation.

```mermaid
sequenceDiagram
    actor Seller
    participant UI as React chat UI
    participant Edge as Supabase chatbot Edge Function
    participant LLM as Configured LLM provider
    participant Lookup as lookup-hdb-location Edge Function
    participant Address as OneMap and HDB address data
    participant DB as Supabase listings and properties
    Seller->>UI: Start intake with HDB postal code
    UI->>Edge: Message and authenticated session
    Edge->>Edge: Check authenticated seller eligibility
    Edge->>Lookup: Verify postal code for this seller
    Lookup->>Address: Resolve and validate HDB address
    Address-->>Lookup: Canonical address and coordinates
    Lookup-->>Edge: Verified address and seller-bound token
    Edge-->>UI: Confirm address and ask for remaining details
    Seller->>UI: Provide property details
    UI->>Edge: Details and authenticated session
    Edge->>LLM: Extract supplied details into structured schema
    LLM-->>Edge: Structured field extraction
    Edge->>Edge: Validate fields and build factual title
    opt Enough details for provisional price guidance
        Edge->>DB: Read up to 20 approved asking listings matching town, bedrooms, and area within ±20%
        DB-->>Edge: Application asking-listing examples
        Edge->>LLM: Request provisional AI price suggestion using examples
        LLM-->>Edge: Suggested asking-price guidance
        Edge-->>UI: Show suggestion and accept, replace, or skip choices
        Seller->>UI: Accept, replace, or skip suggestion
        UI->>Edge: Seller price choice
    end
    Edge->>Lookup: Re-verify address before save
    Lookup->>Address: Validate current address details
    Address-->>Lookup: Verification result
    Lookup-->>Edge: Verified address and seller-bound token
    Edge->>DB: Save owner-bound draft after verified write
    DB-->>Edge: Draft record saved
    Edge-->>UI: Draft card after successful save
    UI-->>Seller: Open dashboard to review and complete draft
    Seller->>UI: Review, complete, and submit from dashboard
```

*The optional price suggestion is provisional LLM guidance based on application asking listings. It is separate from CatBoost valuation and is not completed-sale evidence. Address verification does not verify all listing facts; supplied details remain seller-provided. Saving creates an owner-bound draft, not an approved or published listing. The seller reviews and submits it from the dashboard.*

*Demo amenity records are synthetic; nearby amenity lookup is not implemented.*

## Detailed flows and setup

- [Buyer chatbot flow](../buy-flow.md)
- [Seller chatbot flow](../sell-flow.md)
- [Supabase provider configuration and function setup](../../BackEnd/supabase/README.md#chatbot-provider-selection)

Hosted provider configuration and deployment must be checked in the intended Supabase project; repository code alone does not establish hosted state.
