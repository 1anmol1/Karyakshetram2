# Karyakshetram: Retail Expansion Intelligence (MERN)

Karyakshetram tells a retail business where to open its next store, what the store should earn, how certain that is, and how much it would take from the business's own stores.

- **Stack:** MongoDB, Express (Node 20), React 18 + Vite, Leaflet.
- **Themes:** Day (white + burgundy) and Night (reddish black), using the approved design tokens.
- **Look and feel:** Arial, Remix Icon, no emojis.

> **AI models are not included, by design.** All scoring goes through one adapter, `server/src/ml/adapter.js`. Until your FastAPI service is linked, a transparent **placeholder engine** (fixed formulas, no training) keeps every screen working. See [`docs/ML_INTEGRATION.md`](docs/ML_INTEGRATION.md).

## Quick start (local)

Prerequisites: Node 20+ and MongoDB 6+ running locally, or a MongoDB Atlas URI.

```bash
npm run setup                 # installs server + client
cp server/.env.example server/.env    # set MONGO_URI / JWT_SECRET
npm run seed                  # builds the Pune & PCMC grid, 30 category profiles, POIs, demo account
npm run dev:server            # API on http://localhost:4000
npm run dev:client            # web on http://localhost:5173 (proxies /api)
```

Sign in with **demo@karyakshetram.in / Demo@1234** (a grocery chain with 12 stores), or create a new account and go through onboarding.

To use Docker instead: run `docker compose up -d --build`, then `docker compose exec server node src/scripts/seed.js`, then open http://localhost:8080.

Checks (with the API running):
- `npm run smoke` runs 41 API checks: valid, edge and invalid inputs, plus the error schema.
- `node server/src/scripts/validator-test.js` checks that every narrative number traces to evidence.

## What's inside

```
server/                       Express API gateway (the only public API)
  src/app.js                  helmet, CORS allowlist, rate limit, compression, error schema {error:{code,message,field}}
  src/routes/                 auth · profile · stores (CSV) · core (cells, recommend, check, explain, compare,
                              cannibalisation, portfolio, shops, trending, search, chat, eval, meta) · user (saved, feedback, outcomes, visits)
  src/ml/adapter.js           ← link your ML service here (ML_SERVICE_URL + X-Internal-Key)
  src/ml/placeholder/         stand-in engine with the same JSON contract
  src/llm/index.js            evidence record, template narratives, numeric validator, optional LLM call (temp 0)
  src/models/index.js         Mongoose: users, cells (2dsphere), stores, competitors, profiles, scores, models, outcomes, feedback, jobs, saved, visits
  src/data/categories.js      30 category profiles: rules, drivers, catchment, economics, step-4 fields
  src/scripts/seed.js         JS stand-in for pipeline stages 1–3 (grid, features, suitability + reason codes)
client/                       React + Vite SPA
  src/pages/                  Landing, Auth, Onboarding (5 steps), Dashboard, Location, Cannibalisation,
                              Compare, Check, Portfolio, Trust, Profile, Saved, Guide, NotFound
  src/components/             Header + hamburger drawer, HexMap (Leaflet H3 choropleth), cards, chat, UI kit
  src/styles.css              design tokens for both themes
docs/ML_INTEGRATION.md        endpoint-by-endpoint contract for your models
```

## How it maps to the architecture

| Diagram block | This repo |
|---|---|
| Data Sources → H3 Feature Builder → Suitability Engine | `server/src/scripts/seed.js`. It writes `cells`, `competitors` and `profiles`. Your Python pipeline can bulk-upsert the same collections instead. |
| Seeded Simulator → Training → Batch Scorer | **Your ML work.** Write `models` (metrics, calibrationScale) and serve `/ml/*`. |
| Web App (React + Vite) | `client/`. Includes the wizard, Leaflet hex map, cards, location drawer/page, Trust Center, compare, check, cannibalisation and portfolio. |
| Express Gateway | `server/`. Includes zod validation, rate limiting, helmet, CORS, cache keyed by (model version, parameter hash), the LLM adapter and the validator. |
| FastAPI ML Service | `ML_SERVICE_URL`. Placeholder engine until linked. |
| LLM Provider (optional) | `LLM_URL`. Template fallback is always on. |
| MongoDB Atlas M0 | `MONGO_URI` (any MongoDB 6+) |

## Features and edge cases covered

- **Onboarding (5 steps), with progress saved after every step:**
  1. Business and role, choosing from 30 categories.
  2. City and focus areas, with a coverage warning and a choice of grid detail.
  3. Own stores, from CSV or entered by hand. Invalid rows (outside the city, duplicates, bad numbers) are reported, a missing revenue is imputed and flagged, and files over 500 rows or 1 MB are rejected.
  4. Format and economics. Fields come from the category profile and are checked against allowed ranges.
  5. Goals and constraints, with a review panel before searching.
- **Dashboard:**
  - Layout follows your sketch:
    - category switcher, centred text logo, editable location, theme toggle, profile and hamburger menu along the top
    - search bar under the logo (`/` shortcut; accepts a locality, `lat, lon` or an H3 cell)
    - trending localities on the left; AI summary and filters (two pages) on the right
  - A map that shrinks to a strip on scroll, five labelled picks spaced at least 1.5 km apart, and CSV export.
  - Shop cards with filter chips and Save on hover.
  - Edge states: "insufficient data" with a coarse-grid option, "no results", and cached / placeholder badges.
- **Location page (laid out like the YouTube screenshot):** The map collapses on scroll. Share, AI summary, Save and Compare sit under the map. It has five tabs:
  - Summary
  - Why here: driver attribution and the evidence record
  - Risks
  - Neighbourhood
  - Money: P&L and a rent what-if

  Similar locations run down the right, and the AI panel covers them when opened. The page also takes feedback (a reason code is required for thumbs-down), site-visit notes (quoted rent replaces the simulated rent) and "We opened here" outcomes, which trigger recalibration.
- **Cannibalisation:** Uses a Huff recompute with the candidate site added, and shows the loss for each store, net network revenue and profit, an alert threshold, and a table of how each pick affects the network. States handled:
  - no stores
  - stores of a different category
  - ineligible site, with alternatives
  - no overlap
  - heavy overlap
  - estimated revenue
  - loading and error
- **Compare (up to 3 sites, laid out like the Ather screenshot):**
  - Site pickers and a "Highlight key differences" toggle.
  - Collapsible sections: key numbers, stress tests, cannibalisation, drivers, neighbourhood, risks.
  - A "why A over B" narrative.
- **Check a location:** Drop a pin, search a locality, or enter lat/lon. Covers:
  - field-level 400 errors (rent ₹10–1,000, area 200–20,000 sq ft, outside the city)
  - a pass verdict
  - a fail verdict with reason codes and the 3 nearest suitable cells
- **Portfolio planner:** greedy selection by marginal network gain, compared with a naive top-k, within budget limits.
- **Trust Center:** KPI targets, baselines, data sources and licences, assumptions, limitations and the recalibration log. It is honest that measured metrics are pending until the ML pipeline runs.
- **Profile:** edit every onboarding answer, with an unsaved-changes bar and validation. Also: re-upload stores, change category (with confirmation and reset to defaults), change password, delete account.
- **App-wide:**
  - Chatbot, hamburger drawer.
  - Error handling: 401 / session-expired redirect back to the same page, a toast on 429, offline and cold-start banners, a hex layer that still renders when map tiles fail, a 404 page and an error boundary.

All revenue, rent, margin and opex values are **SIMULATED** in this pilot (PRD §9), and are labelled that way in the UI.

## Deploying (free tier, as in the PRD)

- **Web on Vercel:** root `client/`, set `VITE_API_URL=https://<api>/api`.
- **API on Render:** root `server/`, `npm start`. Set `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGINS=https://<web>`, and optionally `ML_SERVICE_URL` + `ML_INTERNAL_KEY`.
- **Database on MongoDB Atlas M0:** run `npm run seed` once against the Atlas URI.
