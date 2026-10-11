<div align="center">
  <img width="200" alt="SG Homie logo" src="https://github.com/user-attachments/assets/8e515211-77c0-4630-b725-9e27734192c8" />

  <h1>SG Homie</h1>
  <p>A Singapore HDB housing companion.</p>

  <a href="https://sg-homie.netlify.app">Existing deployment URL (availability not verified)</a> ·
  <a href="https://drive.google.com/file/d/1LzKrfmayua1ZWJQZfrD89voyZggpbCKi/view?usp=sharing">Project documentation</a> ·
  <a href="https://youtu.be/0muokFq4Si4">Demo video</a>
</div>

## Project status

The active application is under `SGHomie/`. This repository contains implemented workflows as well as demo and research features; code in the repository does not verify that a hosted deployment, migration, secret, or external service is active.

**Implemented in the repository:** buyers can search approved HDB listings with filters; sellers can submit and manage listings; the chatbot can perform structured, read-only search of approved HDB listings and support seller draft intake; seller HDB postal-code/address verification uses OneMap and official HDB property information; property pages include a “What’s nearby” view.

**Demo:** nearby amenities are deterministic synthetic records marked `source = 'demo'`, with illustrative labels and distances. They are not verified facilities, live OneMap results, or walking routes. The Trends/analytics experience includes generated or hardcoded values and is not verified market analytics.

**Research:** `MLPricePredictorV2/` selects CatBoost as its current robust research candidate. It is not an approved production model, persisted inference service, or integrated valuation feature. See the [V2 README](MLPricePredictorV2/README.md) for methods and detailed results; the legacy `MLPricePredictor/` experiments contain target leakage and are not reliable evidence.

**Planned:** trusted valuation integration, historical transaction analytics, future market outlook, explainable recommendation ranking, affordability-aware decision support, trusted seller pricing guidance, and real amenity ingestion. Simple filter matching and chatbot search are not recommendation ranking.

## Technology and external services

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, and Supabase JavaScript.
- Backend: Supabase Auth, PostgreSQL with Row Level Security, and Edge Functions.
- Chat providers: OpenRouter or OpenAI, selected server-side. Provider credentials belong in Supabase Edge Function secrets, never in frontend environment variables.
- OneMap and official HDB property information: seller HDB postal-code/address verification only. Nearby amenity rows are synthetic demo data, not live OneMap results.
- OpenStreetMap raster tiles: map basemap; tile data does not verify synthetic amenity markers.

## Local frontend setup

The installed Vite 8 toolchain requires Node.js `^20.19.0` or `>=22.12.0`. No separate npm version is pinned in the frontend package.

From the repository root:

```bash
cd SGHomie/FrontEnd
npm ci
cp .env.example .env
npm run dev
```

In PowerShell, copy the example with `Copy-Item .env.example .env` instead of `cp`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend `.env`; `VITE_SUPABASE_FUNCTIONS_URL` is optional when using the functions on the configured Supabase project. Only the publishable/anonymous key belongs in the browser, protected by Row Level Security. Do not put OpenAI, OpenRouter, OneMap, or Supabase service-role secrets in this file.

For backend setup, migrations, local Edge Functions, provider configuration, and safe deployment procedures, see [Supabase setup](SGHomie/BackEnd/supabase/README.md). Backend environment variables are described in [`BackEnd/.env.example`](SGHomie/BackEnd/.env.example).

## Repository layout

```text
AGENTS.md                         Repository instructions
PRODUCT.md                        Product intent and capability status
SGHomie/FrontEnd/                 Active React application
SGHomie/BackEnd/supabase/         Supabase migrations and Edge Functions
SGHomie/docs/buy-flow.md          Chatbot buyer-search behavior
SGHomie/docs/sell-flow.md         Chatbot seller-intake behavior
MLPricePredictor/                 Legacy, leaky ML experiments
MLPricePredictorV2/               Leakage-safe HDB resale research
archived_migrations/              Historical migrations
```

## Useful documentation

- [Product direction and status](PRODUCT.md)
- [Supabase setup and deployment](SGHomie/BackEnd/supabase/README.md)
- [Chatbot buyer flow](SGHomie/docs/buy-flow.md)
- [Chatbot seller flow](SGHomie/docs/sell-flow.md)
- [V2 valuation research and evaluation](MLPricePredictorV2/README.md)

## Contributors

<table>
  <tr>
    <td align="center"><a href="https://github.com/Nitecry7"><img src="https://github.com/Nitecry7.png" width="100" height="100" alt="Faheem" /><br /><sub><b>Faheem</b></sub></a></td>
    <td align="center"><a href="https://github.com/stevennoctavianus"><img src="https://github.com/stevennoctavianus.png" width="100" height="100" alt="Steven" /><br /><sub><b>Steven</b></sub></a></td>
    <td align="center"><a href="https://github.com/Eishani"><img src="https://github.com/Eishani.png" width="100" height="100" alt="Eishani" /><br /><sub><b>Eishani</b></sub></a></td>
    <td align="center"><a href="https://github.com/vanillatte11037"><img src="https://github.com/vanillatte11037.png" width="100" height="100" alt="He Haoyu" /><br /><sub><b>He Haoyu</b></sub></a></td>
  </tr>
</table>
