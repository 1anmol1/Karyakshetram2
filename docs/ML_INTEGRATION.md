# Linking your ML models

The web app never talks to the ML layer directly. Every call goes through one file:
`server/src/ml/adapter.js`.

| `ML_SERVICE_URL` | Behaviour |
|---|---|
| empty (default) | Built-in **placeholder engine** (`server/src/ml/placeholder/`) answers every call. It uses simple, fixed formulas only: no training and no learned parameters. Its job is to exercise every screen, constraint and edge case. |
| set, e.g. `https://ml.example.com` | The adapter sends `POST {ML_SERVICE_URL}/ml/<op>` with header `X-Internal-Key: {ML_INTERNAL_KEY}` and returns your JSON. If the call fails or times out (`ML_TIMEOUT_MS`), the adapter falls back to the placeholder and marks the response `source: "placeholder-fallback"`. The UI then shows a banner. |

Your service only has to return the same JSON shapes the placeholder returns. The fastest way to see a
shape is to call the running API (for example `POST /api/recommend`) or read `placeholder/engine.js`.

## Operations

| op | Request body (from the adapter) | Response the UI relies on |
|---|---|---|
| `score` | `{cell, category, assumptions:{areaSqft?, margin?, opex?, capex?, rent?}}` | `{result: Site}` |
| `cells` | `{category, assumptions}` | `{results: Site[]}` (every cell, for the hex layer) |
| `recommend` | `{category, constraints:{maxRent?, minSpacingKm, minP10Profit?, budget?}, assumptions, focusAreas[], excludeLow, own:Own[], grid}` | `{picks: (Site & {label, icon, rule, cannibalisation?})[5], coverage_status:'ok'\|'insufficient', missingLayers[], stats:{scored, eligible, afterConstraints, lowCoverageShare}}`. A pick with no candidate is `{label, icon, rule, empty:true, reason}`. |
| `stress` | `{cell, category, assumptions}` | `{stress}` (see Site) |
| `cannibalisation` | `{site: Site, own: Own[], category}` | `{stores:[{id,name,lat,lon,revenue,estimated,distKm,lossPct,lossRs}], takenRs, lostMargin, ratio, netNetworkRevenue, netNetworkProfit, affected, model:{alpha, lambda, source}}` |
| `alternatives` | `{cell, category, assumptions}` | `{alternatives: (Site & {distKm})[3]}` (nearest suitable cells) |
| `portfolio` | `{category, k, spacingKm, budget?, assumptions, own: Own[]}` | `{selected:(Site & {marginalGain, takenFromNetwork, lostMargin})[], networkProfit, naive_comparison:{selected[], networkProfit, upliftPct}, droppedFromNaive[], budgetUsed, capexPerSite, maxSites, k}` |
| `recalibrate` | `{category, outcomes:[{actualMonthlyRevenue, predicted:{p10,p50,p90}, insideInterval}]}` | `{calibrationScale, previous, coverage}` |

### `Site` object (all money in rupees per year)

```json
{
  "cell": "8860a25a1bfffff", "category": "grocery", "locality": "Baner", "lat": 18.56, "lon": 73.78,
  "revenue": {"p10": 46000000, "p50": 54000000, "p90": 63000000},
  "profit": {"exp": 2400000, "p10": 640000},
  "tier": "A", "breakevenRent": 160, "rent": 110, "area": 4000, "margin": 0.22, "opex": 4200000, "capex": 6000000,
  "confidence": "High", "flags": ["EMPTY_MARKET" | "LOW_COVERAGE" | "EXTRAPOLATION"],
  "stress": {
    "competitor500m": {"label": "...", "exp": 0, "p10": 0, "tier": "B", "pass": true},
    "rentUp25": {}, "demandDown15": {}, "marginDown2": {}, "passes": 3
  },
  "popChange": 0.142, "coverage": 0.86,
  "eligible": {"ok": true, "reasons": []},
  "catchment": {"km": 2, "households": 38400, "competitors": 2, "nearestCompetitorKm": 1.2, "anchors": 14, "anchorKey": "transit"},
  "demandSupply": 12800,
  "shap": {"Demand": 0, "Access": 0, "Competition": 0, "Cost": 0, "Network": 0}
}
```

`Own` = `{id, name, lat, lon, revenue, estimated}` (the user's stores of the same category, from MongoDB).

## Data the pipeline should write

The Express API reads these MongoDB collections. The seed script fills them today:

- `cells`: `_id` (H3 res 8), `centroid` (GeoJSON Point, 2dsphere), `locality`, `features{pop2015, pop2020, households, affluence, roadDistM, rentIndex, anchors{schools, offices, hospitals, transit, parks}, …}`, `landuse{res, com, ind, green, water}`, `coverage`, `eligible{<category>:{ok, reasons[]}}`
- `competitors`: POIs with `category`, `brandClass`, `areaSqft`, `loc`, `h3`
- `profiles`: category profiles (30 seeded)
- `models`: `{version, category, metrics, calibrationScale}`. Put your `metrics.json` in `metrics`. The Trust Center shows measured values once `metrics.status` is not `"pending"`. Keys: `KPI-1`…`KPI-6`, plus `baselines:[{name, spearman, ndcg, hit, shipped}]`.

Set `MODEL_VERSION` to your model hash so caches and the UI pick it up.

## LLM narratives (optional)

Set `LLM_URL` (and `LLM_API_KEY`). The gateway POSTs `{kind, temperature:0, evidence:[…], instructions}` and expects `{narrative, claims:[{text, evidence:[ids]}]}`.
Every number in the narrative is checked against the evidence record (`server/src/llm/index.js → validate`). If a number does not match, or the call fails, the template narrative is used instead.
