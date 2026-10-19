# SG Homie chatbot

The chatbot UI calls the Supabase `chatbot` Edge Function. OpenAI or OpenRouter can provide language responses through server-side configuration; bounded application tools handle listing search and seller draft intake. The model does not have arbitrary SQL access, and trusted application results take precedence over model memory.

## Buyer listing search

The buyer flow uses the read-only `search_listings` tool to search and sort approved HDB listings. It is not a personalized recommendation-ranking engine. The LLM can explain returned records but must not invent listing IDs, prices, amenities, distances, or valuation evidence.

```mermaid
sequenceDiagram
    actor Buyer
    participant UI as React chat UI
    participant Edge as Supabase chatbot Edge Function
    participant LLM as Configured LLM provider
    participant Tool as Structured listing tool
    participant DB as Supabase listing data
    Buyer->>UI: Ask for listings
    UI->>Edge: Message and session context
    Edge->>LLM: Request response with approved tool schema
    LLM-->>Edge: Structured search_listings call
    Edge->>Tool: Validate filters and sort request
    Tool->>DB: Read approved HDB listings
    DB-->>Tool: Matching structured records
    Tool-->>Edge: Trusted listing results
    Edge->>LLM: Results for explanation
    LLM-->>Edge: Explanation grounded in results
    Edge-->>UI: Response and structured listings
    UI-->>Buyer: Show answer and listing cards
```

*Search results come from the application tool. The language model explains them; it does not rank personalized recommendations.*

## Seller intake

Seller intake extracts details supplied in chat, verifies the HDB address through the location lookup, and saves an owner-bound draft. The seller reviews and completes the draft in the dashboard before submission. Any suggested asking price is provisional AI guidance based on application asking listings, separate from the CatBoost research/demo valuation.

```mermaid
sequenceDiagram
    actor Seller
    participant UI as React chat UI
    participant Edge as Supabase chatbot Edge Function
    participant LLM as Configured LLM provider
    participant Address as OneMap and HDB address lookup
    participant DB as Supabase properties
    Seller->>UI: Provide property details
    UI->>Edge: Message and authenticated session
    Edge->>LLM: Extract supplied fields into schema
    LLM-->>Edge: Structured field extraction
    Edge->>Address: Verify supplied HDB address
    Address-->>Edge: Verification result
    Edge->>DB: Save owner-bound draft
    DB-->>Edge: Draft record
    Edge-->>UI: Draft card and next steps
    UI-->>Seller: Review and complete draft in dashboard
```

*Address verification does not make other synthetic listing facts verified. Demo amenity records are synthetic; nearby amenity lookup is not implemented.*

## Detailed flows and setup

- [Buyer chatbot flow](../buy-flow.md)
- [Seller chatbot flow](../sell-flow.md)
- [Supabase provider configuration and function setup](../../BackEnd/supabase/README.md#chatbot-provider-selection)

Hosted provider configuration and deployment must be checked in the intended Supabase project; repository code alone does not establish hosted state.
