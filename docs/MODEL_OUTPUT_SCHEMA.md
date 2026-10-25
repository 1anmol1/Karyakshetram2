# Karyakshetram AI/ML Model Output & Data Matrices Specification

> **Version:** 3.0.0 (Production-Grounded Release)  
> **Target Metro:** Pune & PCMC Urban Conurbation (EPSG:4326)  
> **Spatial Framework:** Uber H3 Hierarchical Spatial Index  
> **Guiding Principle:** 100% Grounded, Deterministic & Probabilistic Data — Zero Mock/Simulated Values

This specification defines the complete data schemas, mathematical matrices, spatial geometries, and API response contracts required from the production AI/ML modeling pipeline for **Karyakshetram**. 

All data structures detailed herein are actively consumed by the frontend user interface (`Dashboard.jsx`, `HexMap.jsx`, `Location.jsx`, `Check.jsx`, `Compare.jsx`, `Cannibalisation.jsx`, `Portfolio.jsx`) and backend microservices (`/api/cells`, `/api/recommend`, `/api/shops`, `/api/stores`, `/api/location/:id`, `/api/portfolio`).

---

## Table of Contents
1. [Hexagon Color Ramp & Expected Profit ($P50$) Classification](#1-hexagon-color-ramp--expected-profit-p50-classification)
2. [User Business & Store Ingestion Pipeline (`/api/stores`)](#2-user-business--store-ingestion-pipeline-apistores)
3. [Cannibalisation & Huff Gravity Interaction Matrices](#3-cannibalisation--huff-gravity-interaction-matrices)
4. [Master Website Data Matrices](#4-master-website-data-matrices)
   - [Matrix 1: Spatial Grid & Hexagon Geometries](#matrix-1-spatial-grid--hexagon-geometries)
   - [Matrix 2: Catchment Demographics & Population Matrix](#matrix-2-catchment-demographics--population-matrix)
   - [Matrix 3: Footfall & Mobility Heatmap Matrix](#matrix-3-footfall--mobility-heatmap-matrix)
   - [Matrix 4: POI & Commercial Density Matrix](#matrix-4-poi--commercial-density-matrix)
   - [Matrix 5: Probabilistic Financial Projection Matrix](#matrix-5-probabilistic-financial-projection-matrix)
   - [Matrix 6: 4-Factor Stress Testing Matrix](#matrix-6-4-factor-stress-testing-matrix)
   - [Matrix 7: SHAP Feature Attribution Matrix](#matrix-7-shap-feature-attribution-matrix)
   - [Matrix 8: Multi-Site Comparison Vector Matrix](#matrix-8-multi-site-comparison-vector-matrix)
   - [Matrix 9: Submodular Portfolio Expansion Matrix](#matrix-9-submodular-portfolio-expansion-matrix)
5. [Complete API Endpoints Contract (JSON Schemas)](#5-complete-api-endpoints-contract-json-schemas)
6. [ML Pipeline Deployment Verification Checklist](#6-ml-pipeline-deployment-verification-checklist)

---

## 1. Hexagon Color Ramp & Expected Profit ($P50$) Classification

The choropleth map renders retail suitability across hexagonal cells using a calibrated 5-tier burgundy gradient based on **Expected Annual Profit ($P50$)**, plus a neutral mask for disqualified zones.

### 1.1 Palette Tokens & Percentile Cutoffs

```
Expected profit (P50)
[ #F6E3E6 ] [ #EDBFC6 ] [ #DB8B97 ] [ #B9505F ] [ #7B1E2E ]
    Low                                           High
● Not suitable (rule / mask) [ #D9D4D0 ]
```

| Step Index | Hex Code | Visual Tone | Profit Percentile Cutoff | Definition |
| :---: | :---: | :---: | :---: | :--- |
| **Step 0 (Low)** | `#F6E3E6` | Very pale blush | $0^{\text{th}} \le \text{Percentile} < 20^{\text{th}}$ | Marginal profitability, low catchment density or high competition. |
| **Step 1** | `#EDBFC6` | Soft rose | $20^{\text{th}} \le \text{Percentile} < 40^{\text{th}}$ | Modest positive returns, conservative baseline. |
| **Step 2** | `#DB8B97` | Medium dusty rose | $40^{\text{th}} \le \text{Percentile} < 60^{\text{th}}$ | Median urban retail performance. |
| **Step 3** | `#B9505F` | Deep crimson rose | $60^{\text{th}} \le \text{Percentile} < 80^{\text{th}}$ | Strong commercial performance with resilient footfall. |
| **Step 4 (High)** | `#7B1E2E` | Deep burgundy / wine | $80^{\text{th}} \le \text{Percentile} \le 100^{\text{th}}$ | **Prime Tier A flagship sites**: Highest footfall-to-rent efficiency. |
| **Mask** | `#D9D4D0` | Neutral stone gray | `eligible = false` | **Disqualified / Masked**: Fails zoning, protected natural reserves, defence land, or non-commercial. |

### 1.2 Mathematical Formulation of Bins
Let $\mathcal{C}_{\text{eligible}}$ be the set of cells where $\text{eligible} = \text{true}$. Let $v_i = \text{profit\_exp}_i$ for each $c_i \in \mathcal{C}_{\text{eligible}}$ sorted in ascending order.
$$\text{Cutoff}_k = \text{Quantile}(v, 0.20 \times k), \quad k \in \{1, 2, 3, 4\}$$

The color assigned to cell $i$ is:
$$\text{Color}(c_i) = \begin{cases} 
\#D9D4D0 & \text{if } \text{eligible}_i = \text{false} \\ 
\#F6E3E6 & \text{if } v_i \le \text{Cutoff}_1 \\ 
\#EDBFC6 & \text{if } \text{Cutoff}_1 < v_i \le \text{Cutoff}_2 \\ 
\#DB8B97 & \text{if } \text{Cutoff}_2 < v_i \le \text{Cutoff}_3 \\ 
\#B9505F & \text{if } \text{Cutoff}_3 < v_i \le \text{Cutoff}_4 \\ 
\#7B1E2E & \text{if } v_i > \text{Cutoff}_4 
\end{cases}$$

---

## 2. User Business & Store Ingestion Pipeline (`/api/stores`)

When an entrepreneur or retail brand configures their existing business outlets (via manual entry, CSV upload, or the on-page "Add Business" modal), the system stores and feeds these physical locations into the ML pipeline.

### 2.1 User Store Ingestion Schema
```json
{
  "_id": "6adcdeaac36e922cf531dd1e",
  "owner": "6adcdeaac36e922cf531dd1c",
  "name": "FreshMart Baner High Street",
  "category": "grocery",
  "loc": {
    "type": "Point",
    "coordinates": [73.786800, 18.559000]
  },
  "h3": "8860884203fffff",
  "annualRevenue": 56354813,
  "revenueEstimated": false,
  "chain": "own",
  "floorAreaSqft": 3500,
  "grossMargin": 0.22,
  "monthlyRentSqft": 145,
  "createdAt": "2026-10-24T16:36:58.271Z"
}
```

### 2.2 Ingestion Rules & Fallbacks
1. **Spatial Snapping**: Coordinates are snapped to the nearest H3 Res 8 centroid (`h3.latLngToCell(lat, lon, 8)`).
2. **Revenue Imputation**: If `annualRevenue` is not provided by the user, the model imputes baseline revenue using the cell's demographic density:
   $$\text{Revenue}_{\text{est}} = \text{ScoreCell}(h3, \text{category}).\text{revenue.p50}$$
   The store is tagged with `"revenueEstimated": true` and shown with a warning badge until actual receipts are provided.
3. **Display in "Shops Around" List**: Every registered user store is mapped as:
   - `relation`: `'Your store'`
   - `tag`: `'ink'` (visual dark badge)
   - `distKm`: Geodesic distance from active locality center
   - Sorted to the top of the shops list alongside competitors and anchor tenants.

---

## 3. Cannibalisation & Huff Gravity Interaction Matrices

When an enterprise brand considers opening a new store at cell $k$, the ML model evaluates how much customer demand will be drawn away from the brand's own existing stores versus competitors.

### 3.1 Huff Gravity Probability Formulation
The probability $\mathcal{P}_{ij}$ that a consumer in residential zone $i$ patronizes store $j$ is given by:

$$\mathcal{P}_{ij} = \frac{A_j^\alpha \cdot D_{ij}^{-\beta}}{\sum_{m \in \mathcal{S}_{\text{all}}} A_m^\alpha \cdot D_{im}^{-\beta}}$$

Where:
- $A_j$: Attractiveness of store $j$ (proportional to floor area $S_j$ and brand strength index).
- $D_{ij}$: Network travel distance (or Haversine distance with street-grid penalty factor 1.25) between residential centroid $i$ and store $j$.
- $\alpha$: Floor area sensitivity exponent ($\alpha = 1.0$).
- $\beta$: Distance friction coefficient ($\beta = 1.85$ for convenience/grocery, $\beta = 1.40$ for destination apparel/electronics).
- $\mathcal{S}_{\text{all}}$: Total set of retail outlets in the category (User's own network $\mathcal{S}_{\text{own}} \cup \text{Competitors} \mathcal{S}_{\text{comp}}$).

### 3.2 Cannibalisation Output Matrix Structure
```json
{
  "cannibalisation": {
    "hasOverlap": true,
    "nearestStore": {
      "id": "6adcdeaac36e922cf531dd1e",
      "name": "FreshMart Baner High Street",
      "distKm": 1.45
    },
    "takenRs": 2450000,
    "ratio": 0.038,
    "netNetworkProfit": 4247468,
    "affectedStores": [
      {
        "storeId": "6adcdeaac36e922cf531dd1e",
        "name": "FreshMart Baner High Street",
        "distKm": 1.45,
        "currentRevenue": 56354813,
        "lostRevenue": 1850000,
        "lostPct": 0.0328,
        "lostMargin": 407000,
        "isHot": false
      },
      {
        "storeId": "6adcdeaac36e922cf531dd20",
        "name": "FreshMart Balewadi Phata",
        "distKm": 2.10,
        "currentRevenue": 42100000,
        "lostRevenue": 600000,
        "lostPct": 0.0142,
        "lostMargin": 132000,
        "isHot": false
      }
    ]
  }
}
```

- `ratio`: $\frac{\text{takenRs}}{\text{newStoreRevenue.p50}}$ (Warning flag triggered if $\text{ratio} > 0.15$).
- `netNetworkProfit`: $\text{ExpectedProfit}_{\text{new}} - \sum_j \text{lostMargin}_j$.

---

## 4. Master Website Data Matrices

### Matrix 1: Spatial Grid & Hexagon Geometries
Consists of 949 H3 Resolution 8 cells covering Pune Municipal Corporation (PMC) and Pimpri Chinchwad Municipal Corporation (PCMC).

| Column Name | Type | Example | Description |
| :--- | :--- | :--- | :--- |
| `cell` | String (15 hex) | `"8860884203fffff"` | Unique H3 Res 8 spatial identifier. |
| `locality` | String | `"Baner"` | Sub-neighborhood cluster name. |
| `lat` | Float | `18.5590` | Centroid latitude (WGS 84). |
| `lon` | Float | `73.7868` | Centroid longitude (WGS 84). |
| `coordinates` | Array of 6 pairs | `[[73.784, 18.563], ...]` | Polygon coordinates closing GeoJSON ring. |
| `eligible` | Boolean | `true` | False if zoned non-commercial or environmentally protected. |
| `maskReasons` | Array of Strings | `["ZONING_DEFENCE"]` | Reason for disqualification when `eligible = false`. |

---

### Matrix 2: Catchment Demographics & Population Matrix
Used on `Location.jsx` ("Neighbourhood" tab) and `Check.jsx` (Catchment intelligence).

| Feature Column | Type | Unit | Description |
| :--- | :--- | :--- | :--- |
| `catchment_pop_2020` | Integer | Persons | Gridded WorldPop population within 1 km walking catchment. |
| `catchment_pop_growth_5yr` | Float | Ratio | 5-year compound population growth (+0.14 = +14%). |
| `households_count` | Integer | Households | Number of residential households in cell catchment. |
| `household_income_q1` | Float | Ratio | Lowest income quintile share (< ₹30,000/mo). |
| `household_income_q2` | Float | Ratio | Lower-middle quintile share (₹30,000–₹60,000/mo). |
| `household_income_q3` | Float | Ratio | Middle quintile share (₹60,000–₹1,20,000/mo). |
| `household_income_q4` | Float | Ratio | Upper-middle quintile share (₹1,20,000–₹2,50,000/mo). |
| `household_income_q5` | Float | Ratio | Affluent quintile share (> ₹2,50,000/mo). |
| `day_to_night_ratio` | Float | Ratio | Ratio of daytime influx (workers) to nighttime residents (e.g. 1.8 = high office cluster). |
| `landuse_residential` | Float | % | % of cell area designated residential. |
| `landuse_commercial` | Float | % | % of cell area designated retail/commercial. |
| `landuse_industrial` | Float | % | % of cell area designated industrial/warehousing. |
| `landuse_open` | Float | % | % parks, water bodies, or vacant plots. |

---

### Matrix 3: Footfall & Mobility Heatmap Matrix
Hourly and diurnal mobility indices driving store traffic predictions.

```json
{
  "mobility": {
    "dailyAverageFootfall": 14250,
    "weekendLift": 1.34,
    "hourlyProfile": [
      0.01, 0.00, 0.00, 0.00, 0.01, 0.02,
      0.04, 0.07, 0.11, 0.14, 0.12, 0.10,
      0.09, 0.08, 0.07, 0.09, 0.13, 0.16,
      0.18, 0.17, 0.14, 0.09, 0.05, 0.02
    ],
    "dayOfWeekIndex": {
      "Mon": 0.88, "Tue": 0.91, "Wed": 0.94,
      "Thu": 0.96, "Fri": 1.08, "Sat": 1.32, "Sun": 1.36
    }
  }
}
```

---

### Matrix 4: POI & Commercial Density Matrix
Direct inputs for competitor proximity and anchor pull evaluation.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `competitor_count_500m` | Integer | Direct competitors in the same category within 500m. |
| `competitor_count_2km` | Integer | Direct competitors in the same category within 2 km. |
| `dist_nearest_competitor_m` | Float | Distance in meters to closest direct competitor. |
| `anchor_count_schools` | Integer | Primary and secondary schools within 1 km. |
| `anchor_count_offices` | Integer | Tech parks, corporate centers, IT corridors within 1 km. |
| `anchor_count_transit` | Integer | Metro stations and major bus transit interchanges within 500m. |
| `anchor_count_hospitals` | Integer | Multi-speciality medical facilities within 1 km. |
| `road_frontage_dist_m` | Float | Distance to the nearest primary arterial commercial road. |

---

### Matrix 5: Probabilistic Financial Projection Matrix
The core engine output powering all recommendations, cards, and ranking.

| Column Name | Type | Unit | Formula / Description |
| :--- | :--- | :--- | :--- |
| `revenue.p10` | Float | INR / yr | Downside 10th percentile conservative annual revenue. |
| `revenue.p50` | Float | INR / yr | Median 50th percentile expected annual revenue. |
| `revenue.p90` | Float | INR / yr | Upside 90th percentile optimistic annual revenue. |
| `profit.exp` | Float | INR / yr | $\text{Rev}_{P50} \times \text{Margin} - (\text{Rent} \times \text{Area} \times 12) - \text{Opex}$. |
| `profit.p10` | Float | INR / yr | $\text{Rev}_{P10} \times \text{Margin} - (\text{Rent} \times \text{Area} \times 12) - \text{Opex}$. |
| `breakeven_rent` | Float | ₹/sq ft/mo | $\frac{\text{Rev}_{P50} \times \text{Margin} - \text{Opex}}{\text{Area} \times 12}$. |
| `market_rent` | Float | ₹/sq ft/mo | Prevailing commercial lease rate benchmark. |
| `capex` | Float | INR | One-time store fitout and capitalization cost. |
| `payback_period_yrs` | Float | Years | $\text{Capex} / \text{Profit}_{\text{exp}}$ (if $\text{Profit}_{\text{exp}} > 0$). |
| `tier` | Enum (`'A'`, `'B'`, `'C'`) | - | **Tier A**: $\text{profit.p10} > 0$<br>**Tier B**: $\text{profit.exp} > 0 \land \text{profit.p10} \le 0$<br>**Tier C**: $\text{profit.exp} \le 0$. |
| `confidence` | Enum | - | `'High'`, `'Medium'`, `'Low'` based on data density. |

---

### Matrix 6: 4-Factor Stress Testing Matrix
Evaluates whether a candidate site can survive economic headwinds.

| Scenario ID | Test Parameter | Evaluation Condition | Pass Threshold |
| :--- | :--- | :--- | :--- |
| `competitor500m` | New rival opens at 500m (-20% sales) | `profit_exp(rev * 0.80) > 0` | Stressed profit > ₹0 |
| `rentUp25` | 25% rent escalation on lease renewal | `profit_exp(rent * 1.25) > 0` | Stressed profit > ₹0 |
| `demandDown15` | 15% drop in neighborhood spending | `profit_exp(rev * 0.85) > 0` | Stressed profit > ₹0 |
| `marginDown2` | 200 bps contraction in gross margin | `profit_exp(margin - 0.02) > 0` | Stressed profit > ₹0 |

**Output Schema:**
```json
{
  "stress": {
    "passes": 3,
    "total": 4,
    "competitor500m": { "pass": true, "exp": 1420000, "tier": "B", "label": "Competitor opens within 500m" },
    "rentUp25": { "pass": true, "exp": 850000, "tier": "B", "label": "Rent rises 25%" },
    "demandDown15": { "pass": true, "exp": 320000, "tier": "B", "label": "Demand falls 15%" },
    "marginDown2": { "pass": false, "exp": -180000, "tier": "C", "label": "Margin down 2%" }
  }
}
```

---

### Matrix 7: SHAP Feature Attribution Matrix
Additive attribution explaining deviations from baseline citywide performance.

$$\text{Revenue}_{P50} = \text{CityBaseline} + \sum_{k \in \text{Drivers}} \text{SHAP}_k$$

| SHAP Key | Unit | Driving Factors |
| :--- | :--- | :--- |
| `Demand` | INR (±) | Population count, household affluence, SEC classification. |
| `Access` | INR (±) | Metro connectivity, arterial road frontage, parking ease. |
| `Network` | INR (±) | Clustered synergy or cannibalisation with existing brand footprint. |
| `Competition` | INR (±) | Proximity and saturation of competing brands. |
| `Cost` | INR (±) | Lease discount vs. market benchmark. |

---

### Matrix 8: Multi-Site Comparison Vector Matrix
Used on `Compare.jsx` to benchmark candidate locations side-by-side.

| Vector Dimension | Deccan Gymkhana | Baner High Street | Koregaon Park |
| :--- | :--- | :--- | :--- |
| **Tier** | A | A | A |
| **Expected Profit / yr** | ₹66,97,468 | ₹58,50,000 | ₹62,40,000 |
| **P10 Downside Profit / yr** | ₹35,59,805 | ₹29,80,000 | ₹31,20,000 |
| **P50 Revenue / yr** | ₹8,74,97,584 | ₹7,60,00,000 | ₹8,15,00,000 |
| **Break-Even Rent** | ₹285 / sq ft | ₹248 / sq ft | ₹265 / sq ft |
| **Prevailing Rent** | ₹174 / sq ft | ₹145 / sq ft | ₹168 / sq ft |
| **Stress Tests** | 4 / 4 | 4 / 4 | 4 / 4 |
| **Cannibalisation Ratio** | 1.8% | 3.8% | 0.4% |
| **Footfall / day** | 18,200 | 14,500 | 16,800 |
| **Households (1 km)** | 14,200 | 11,800 | 9,400 |

---

### Matrix 9: Submodular Portfolio Expansion Matrix
Powers `Portfolio.jsx` to compute the optimal multi-store rollout under budget constraints:

$$\max_{\mathcal{S} \subseteq \mathcal{C}, |\mathcal{S}| \le K} \sum_{s \in \mathcal{S}} \text{MarginalNetRevenue}(s \mid \mathcal{S} \setminus \{s\}) \quad \text{s.t.} \quad \text{Dist}(s_a, s_b) \ge R_{\text{min}}, \quad \text{Capex}(\mathcal{S}) \le B$$

Output provides:
- Sequence order of rollout (Step 1, Step 2, ... Step K)
- Marginal gain in network revenue per added store
- Cannibalisation surrender to prior stores in the sequence

---

## 5. Complete API Endpoints Contract (JSON Schemas)

### 5.1 `GET /api/cells` (Choropleth Layer)
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[73.784, 18.563], [73.789, 18.561], [73.791, 18.556], [73.789, 18.554], [73.784, 18.556], [73.782, 18.561], [73.784, 18.563]]]
      },
      "properties": {
        "id": "8860884203fffff",
        "locality": "Baner High Street",
        "tier": "A",
        "confidence": "High",
        "exp": 5850000,
        "p10": 2980000,
        "rent": 145,
        "eligible": true,
        "reasons": []
      }
    }
  ]
}
```

### 5.2 `POST /api/recommend` (Ranked Site Engine)
```json
{
  "category": "grocery",
  "modelVersion": "prod-v3.0.0",
  "grid": "res8",
  "picks": [
    {
      "cell": "886088508dfffff",
      "category": "grocery",
      "locality": "Deccan Gymkhana",
      "lat": 18.5164,
      "lon": 73.8307,
      "label": "Best overall",
      "icon": "award-line",
      "rule": "Highest expected profit meeting all operational constraints",
      "tier": "A",
      "confidence": "High",
      "rent": 174,
      "breakevenRent": 285,
      "profit": { "exp": 6697468, "p10": 3559805 },
      "revenue": { "p10": 73235478, "p50": 87497584, "p90": 103899006, "min": 60000000, "max": 120000000 },
      "stress": { "passes": 4, "total": 4 },
      "cannibalisation": { "ratio": 0.018, "takenRs": 1200000, "netNetworkProfit": 5497468 },
      "flags": ["HIGH_DENSITY", "TRANSIT_HUB"],
      "empty": false
    }
  ],
  "allLocations": []
}
```

### 5.3 `GET /api/shops` (Shops & User Stores Around Point)
```json
{
  "shops": [
    {
      "id": "6adcdeaac36e922cf531dd1e",
      "name": "FreshMart Baner High Street",
      "category": "grocery",
      "relation": "Your store",
      "distKm": 0.42,
      "lat": 18.5590,
      "lon": 73.7868,
      "cell": "8860884203fffff"
    },
    {
      "id": "osm_poi_8492019",
      "name": "Nature's Basket Baner",
      "category": "grocery",
      "relation": "Competitor",
      "distKm": 0.65,
      "lat": 18.5582,
      "lon": 73.7891,
      "cell": "8860884203fffff"
    },
    {
      "id": "osm_poi_3910248",
      "name": "HDFC Bank Baner Branch",
      "category": "bank",
      "relation": "Anchor",
      "distKm": 0.88,
      "lat": 18.5601,
      "lon": 73.7845,
      "cell": "8860884203fffff"
    }
  ],
  "total": 3,
  "counts": { "grocery": 2, "bank": 1 }
}
```

---

## 6. ML Pipeline Deployment Verification Checklist

Before publishing weights or pipeline outputs to the production database:
- [x] **Spatial Coordinates**: All points fall inside the official Pune & PCMC boundary polygon.
- [x] **Monotonicity**: Probabilistic revenue distributions strictly satisfy:
  $$\text{revenue.p10} \le \text{revenue.p50} \le \text{revenue.p90}$$
- [x] **Financial Invariants**:
  $$\text{profit.exp} = (\text{revenue.p50} \times \text{margin}) - (\text{rent} \times \text{area} \times 12) - \text{opex}$$
  $$\text{breakeven\_rent} = \frac{\text{revenue.p50} \times \text{margin} - \text{opex}}{\text{area} \times 12}$$
- [x] **H3 Standardization**: Every cell identifier is a valid 15-character lowercase Uber H3 index.
- [x] **Color Ramp Alignment**: Choropleth binning strictly maps to the 5 colors `#F6E3E6`, `#EDBFC6`, `#DB8B97`, `#B9505F`, `#7B1E2E` plus `#D9D4D0` for masked cells.
- [x] **User Store Inclusion**: Any user-added business from `/api/stores` is indexed into the Huff gravity network matrix and displayed with `relation: "Your store"` alongside other local businesses.
- [x] **Zero Mock/Simulation**: All metrics are derived from verified geospatial layers (OpenStreetMap POIs, WorldPop demographic grids, and real estate lease surveys).
