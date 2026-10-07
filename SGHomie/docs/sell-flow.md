# Chatbot seller intake

## Implemented flow

1. **Sell** sends an explicit selling intent. Login, seller registration and admin
   restrictions remain enforced by the server on every turn.
2. Ask for the six-digit postal code and verify it using `lookup-hdb-location`.
   Fill the address, town, HDB property type, available built year and coordinates
   from the verified result.
3. Ask for the private unit number, actual bedroom/bathroom counts, floor area
   with sqft/sqm and description/flat type/condition together. Use the contact
   name and valid phone number from the current user's profile; ask only for
   missing/invalid profile contact fields. Available profile contacts are kept
   even if the extractor omits them. Contact changes can be made in the dashboard.
   Sellers can mark unknown property values as unknown. Photos are uploaded in
   the dashboard.
4. The configured chat provider extracts supplied details into a validated schema.
   Explicit sqm is converted to sqft. HDB room type is not treated as bedroom count.
   A factual title is generated from known bedroom count and verified town.
5. With bedroom count, bathroom count and floor area, request a provisional AI
   asking-price suggestion. Supply up to 20 approved HDB asking prices from the
   same town, same bedroom count and within 20% of the supplied floor area where
   available. These are application asking listings, potentially demo/seed data,
   not verified completed transactions. With sparse details, invalid output or a
   pricing outage, say a price cannot be gauged.
6. Ask the seller to accept the suggestion naturally (e.g. "oh sure", "yeah sure"
   or "sounds good to me"), provide their own positive SGD price,
   or say "no price in mind" to skip. An explicitly supplied asking price may also
   be used during intake. No listing is created merely for suggesting a price.
7. Re-verify the address and save an owner-bound **draft**, with the supplied
   details and selected price. Save a known unit number only in the private table;
   unknown unit numbers have no private-details row yet. No listing is submitted
   or approved by chat. Repeated requests for the same draft ID/unit reuse the
   seller's existing draft. Success requires completed database writes.
8. Emit structured saved-draft metadata, refresh the Seller Dashboard and show a
   compact draft card. It opens `/seller?draft=<saved-id>`, loads the current
   seller's database records and opens the matching draft for editing. The chat
   closes when the card is clicked, using its existing animation.
9. Remind the seller of missing unit/counts/area/description/contact/price fields
   and required pictures. Review the generated title and all details before
   submitting through the dashboard.

## Boundaries and persistence

- The existing OpenAI/OpenRouter environment switch and model selection also
  apply to detail extraction and the price suggestion. Buy behaviour is retained.
- Prices are provisional AI guidance. There is no ML integration or claim of an
  official valuation. The seller controls the final asking price.
- Intake context is validated server-side and carried separately from chat text,
  so history truncation and terse replies do not drop the current selling stage.
  It is cleared when the signed-in account changes. Unfinished chat intake itself
  is held in browser memory; only a successfully saved database draft survives a
  page refresh. Start Sell again after refreshing an unfinished intake.
- Existing numeric columns require values. Unknown draft price/counts/area use
  the existing zero sentinel in the database, but edit inputs show them as blank
  and the draft card shows "Price to be added". There is no schema migration.
- Draft ownership/RLS and verified-address writes remain enforced. Chat does not
  have an approval tool. A failed write must not emit a saved-draft card.

## Validation

From the repository root:

```bash
node --experimental-strip-types --import ./SGHomie/tests/register-deno-imports.mjs --test SGHomie/tests/sell-flow.test.mjs SGHomie/tests/buy-flow.test.mjs SGHomie/tests/chat-provider.test.mjs
```

From `SGHomie/FrontEnd`:

```bash
npm run lint
npx tsc --noEmit
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

Tests use isolated fixtures, not fabricated records written to the hosted database.

## Files changed

- `BackEnd/supabase/functions/chatbot/index.ts`: stage routing, verified draft
  persistence, authentication and structured seller events.
- `BackEnd/supabase/functions/chatbot/sell.ts`: collective intake prompt, detail
  extraction, title generation, provisional pricing and missing-field checklist.
- `BackEnd/supabase/functions/_shared/sellerFlow.ts`: validated public protocol.
- `FrontEnd/src/lib/chat.ts` and `FrontEnd/src/components/Chatbot.tsx`: consume
  seller events, retain intake context and refresh from confirmed saves.
- `FrontEnd/src/components/SellerDraft.tsx`: saved-draft continuation card.
- `FrontEnd/src/pages/SellerDashboard.tsx`: direct draft editing and blank unknown
  fields, including "Price not set" in the list.
- `tests/sell-flow.test.mjs` and `tests/buy-flow.test.mjs`: seller workflow tests
  and revised postal-step contract; existing buyer/provider checks are retained.
- This document and `BackEnd/supabase/README.md`: implementation and validation.

Verification completed: 64 workflow/provider tests passed, lint passed with two
existing fast-refresh warnings, and the production build passed with its existing
large-chunk warning. `npx tsc --noEmit` passed; the stricter app-project check
reported seven pre-existing unused React imports in unrelated files. Backend
strict checking also passed using the installed Supabase SDK and a temporary Deno
globals declaration (`tsc -p /private/tmp/sghomie-backend-tsconfig.json`).

Live checks verified postal lookup, the combined intake prompt, the unknown-detail
pricing fallback, refresh persistence of an existing draft and its direct edit
link. Actual draft inserts and failure/rollback checks used isolated service
fixtures. Profile-contact reuse, missing-contact questions, natural confirmations
such as "oh sure", refusals and alternative prices are also covered by fixtures.
The contact/confirmation refinement changes `chatbot/index.ts`, `chatbot/sell.ts`,
`tests/sell-flow.test.mjs` and this document; no frontend or schema changes were
needed for that refinement.

The chatbot Edge Function was deployed as active version 26; frontend
changes remain in the local branch for the normal frontend deployment process.
