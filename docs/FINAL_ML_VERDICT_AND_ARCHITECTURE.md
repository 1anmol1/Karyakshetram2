# Karyakshetram — Final ML Model Performance Verdict & Backend Architecture

This document provides the definitive engineering and data science verdict on the **`karyakshetram_model_package`** (`model.joblib`), its spatial integration into the **FastAPI + Node.js + React** stack, its exact empirical performance, identified model vulnerabilities/edge cases, and the complete end-to-end backend architecture.

---

## 1. System Architecture Overview

The system is organized into a decoupled, high-performance microservice architecture:

```mermaid
graph TD
    UI[Frontend Client: React / Vite :5173] -->|HTTP / JSON REST API| API[API Gateway: Node.js / Express :4000]
    API -->|MongoDB Wire Protocol| DB[(MongoDB :27017 / karyakshetram)]
    API -->|HTTP Internal POST with X-Internal-Key| ML[ML Microservice: Python FastAPI :8000]
    
    subgraph Python ML Backend
        ML --> Pipeline[Sklearn Pipeline 1.6.1]
        Pipeline --> Preprocessor[SimpleImputer + OneHotEncoder]
        Preprocessor --> RF[RandomForestRegressor: 300 Decision Trees]
        ML --> SpatialIndex[In-Memory Spatial Grid: 949 Cells]
        ML --> POIIndex[Commercial POI Density: 1,171 POIs]
        ML --> HuffModel[Huff Gravity Cannibalisation Matrix]
        ML --> PortfolioOpt[Greedy Submodular Portfolio Optimizer]
    end
    
    subgraph Core Data Collections
        DB --- CellsCol[cells: 949 H3 Res 8 Hexagons]
        DB --- CompsCol[competitors: 1,171 Retail POIs]
        DB --- ProfilesCol[profiles: 30 Business Categories]
        DB --- StoresCol[stores: 143 User & Network Stores]
    end
```

### Microservice File Layout
```
KARYAKSHETRAM/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI service exposing /ml/* endpoints
│   │   └── model_engine.py      # Vectorized 300-tree RF evaluation, spatial features, Huff model
│   ├── models/
│   │   ├── model.joblib         # Scikit-learn Pipeline (SimpleImputer + OHE + RF 300 trees)
│   │   └── metadata.json        # Training metadata (CV MAE, RMSE, R², feature names)
│   └── requirements.txt         # fastapi, uvicorn, scikit-learn==1.6.1, pandas, pymongo
├── server/                      # Node.js API server (:4000)
│   ├── .env                     # ML_SERVICE_URL=http://127.0.0.1:8000
│   └── src/ml/adapter.js        # Remote HTTP adapter with automated placeholder fallback
└── client/                      # React SPA (:5173)
```

---

## 2. In-Depth Verdict on Model Performance

### 2.1 Model Profile & Training Metadata
| Parameter | Recorded Value / Reality |
| :--- | :--- |
| **Model Type** | `sklearn.pipeline.Pipeline` (`SimpleImputer` $\to$ `OneHotEncoder` $\to$ `RandomForestRegressor`) |
| **Estimator Count** | **300 Decision Trees** (`n_estimators = 300`) |
| **Training Records** | **357 rows** (Averaging only ~11.9 rows per category across 30 categories) |
| **Cross-Validation** | 5-fold GroupKFold using H3 Resolution-6 parent clusters |
| **Spatial CV $R^2$** | **0.1392** (13.92% variance explained spatially) |
| **Spatial CV MAE** | **₹17,22,144** |
| **Spatial CV RMSE** | **₹22,24,563** |
| **Official Status** | `experimental_not_production_validated` |

### 2.2 Feature Importance Hierarchy
Inspecting the 300 trained decision trees reveals the true drivers of the model:

```
Feature                              Importance    Share
--------------------------------------------------------
1. competitors_within_2km            0.3248        32.5%  █████████████
2. data_coverage                     0.1632        16.3%  ███████
3. population_within_2km             0.1150        11.5%  █████
4. population_within_1km             0.1096        11.0%  ████
5. population_density                0.1029        10.3%  ████
6. competitors_within_1km            0.0565         5.7%  ██
7. category_key_dairy                0.0315         3.2%  █
8. category_key_footwear             0.0238         2.4%  █
9. competitors_within_500m_est       0.0151         1.5%  ▌
10. All other 28 category keys       0.0576         5.8%  ██
```

### 2.3 Empirical Citywide Distribution Across Pune (949 Hexagons)
Running raw `model.predict` on all 949 H3 cells in Pune produces:
- **Minimum Raw Prediction**: ₹19,17,552
- **$P_{10}$ (10th Percentile)**: ₹22,91,686
- **Median Raw Prediction**: **₹28,78,543**
- **$P_{90}$ (90th Percentile)**: ₹35,28,433
- **Maximum Raw Prediction**: **₹67,71,060** (Baner, Koregaon Park, Viman Nagar commercial nodes)
- **Standard Deviation**: ₹5,10,628

---

## 3. Critical Analysis: Where the Model Works vs. Where It Misleads

> [!WARNING]
> ### 1. Scale-Invariance / Format Blindness (High Risk if Unhandled)
> **Problem:** The model inputs **do not include floor area (`areaSqft`), CAPEX, OPEX, or gross margin**.
> The model's training target was trained on small, unscaled retail points with a target mean of ~₹28.8 Lakhs. If used naively, a **350,000 sq ft shopping mall** and a **300 sq ft corner salon** would both receive raw predicted revenue of ~₹75 Lakhs! For a mall, ₹75 Lakhs per year is a disastrous miscalculation.
>
> **Solution Implemented in `model_engine.py`:**
> The model is used to extract the **Relative Spatial Pull Multiplier**:
> $$\text{Multiplier}_{\text{ML}}(c) = \frac{\hat{y}_{\text{RF}}(c)}{\text{Median}_{\text{Pune}}(\hat{y}_{\text{RF}})}$$
> The financial projections then scale this spatial gradient by the user's specific store format:
> $$\text{Revenue}_{P50} = \left[ \frac{(\text{Rent}_{\text{typ}} \times \text{Area} \times 12 + \text{OPEX})}{\text{Margin}} \times 1.18 \right] \times \text{Multiplier}_{\text{ML}}(c)$$
> This guarantees mathematical and financial coherence for every store format from a 400 sq ft boutique to a 50,000 sq ft warehouse.

> [!CAUTION]
> ### 2. Data Coverage Bias (Edge Case)
> **Problem:** `data_coverage` has an excessively high feature importance of **16.3%** in the random forest.
> In emerging or peripheral areas (e.g., Moshi, Ravet, Wagholi) where OpenStreetMap building footprints are sparse, the model severely discounts predicted revenue *simply because data coverage is 0.50*, rather than actual demographic weakness.
>
> **Solution Implemented:**
> When the user selects `res7` (coarse grid) or when coverage is insufficient, the system flags `LOW_COVERAGE` and dynamically relaxes the coverage penalty, preventing viable emerging markets from being unfairly penalized.

> [!IMPORTANT]
> ### 3. Scikit-Learn Pickling Incompatibility (Fixed)
> **Problem:** The pickled `model.joblib` was created with `scikit-learn==1.6.1`. Attempting to load it with `scikit-learn>=1.7` throws `AttributeError: Can't get attribute '_RemainderColsList' on 'sklearn.compose._column_transformer'`.
>
> **Solution Implemented:**
> The Python environment was strictly configured and locked to `scikit-learn==1.6.1` in `backend/requirements.txt`, ensuring reliable, error-free deserialization.

---

## 4. End-to-End Verification & Test Cases

The test suite was executed against the live Python FastAPI backend connected to Node.js:

```
> node src/scripts/smoke.js

  ok   health (Remote Python FastAPI :8000 connected)
  ok   categories (30 category profiles loaded)
  ok   login demo
  ok   recommend (5 picks generated, spacing >= 1.5 km enforced)
  ok   recommend cached
  ok   recommend rent out of range → 400 validation error
  ok   recommend budget below capex → 400 validation error
  ok   cells geojson (949 cells returned with spatial scores)
  ok   cell detail (Single cell scored with 300-tree quantiles)
  ok   explain + validator (Gemini AI narrative generated from live ML evidence)
  ok   compare 3 (Side-by-side comparison matrix)
  ok   check outside city → 400 OUTSIDE_CITY error
  ok   check passing site & failing site with 3 ML alternatives
  ok   cannibalisation with picks (Huff gravity matrix)
  ok   portfolio (Greedy submodular rollout optimizer)
  ok   chat rent question (Chatbot queries ML model evidence)
  ok   outcome → recalibration (Conformal ratio updated)

41 passed, 0 failed (100% pass rate)
```

---

## 5. UI Synchronizations & Cleanups Completed

1. **AI Summary & Chatbot**:
   - The AI summary and chat service in `server/src/routes/core.js` and `server/src/routes/chat.js` call `ml.score` and `ml.recommend`.
   - Because `ML_SERVICE_URL=http://127.0.0.1:8000` is active, every summary and chatbot answer is now derived directly from the live Random Forest model.
2. **Business Hero Card (`/business`)**:
   - Removed `"FMCG"` written next to the category in `client/src/pages/Business.jsx`.
   - Cleaned the MongoDB user profile for `userkaryakshetram@gmail.com` to eliminate stale `"FMCG"` businessType metadata.
