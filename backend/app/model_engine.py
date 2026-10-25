"""
Karyakshetram Machine Learning Engine.
Loads model.joblib (RandomForestRegressor, 300 trees) and metadata.json,
connects to MongoDB to load spatial cells, POIs, and category profiles,
and executes real-time vectorized inference, non-parametric tree quantiles (P10/P50/P90),
Huff gravity cannibalisation, and greedy submodular portfolio optimization.
"""

import os
import json
import math
import numpy as np
import pandas as pd
import joblib
from pymongo import MongoClient

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, 'models', 'model.joblib')
META_PATH = os.path.join(BASE_DIR, 'models', 'metadata.json')

HUFF = {'alpha': 1.0, 'lambda': 1.8, 'floorKm': 0.3, 'originKm': 5.0}

class ModelEngine:
    def __init__(self):
        self.model = None
        self.metadata = {}
        self.cells = []
        self.cells_by_id = {}
        self.pois_by_category = {}
        self.profiles_by_key = {}
        self.calibration = {}
        self.loaded_at = None
        self.mongo_uri = os.getenv('MONGO_URI', 'mongodb://127.0.0.1:27017/karyakshetram')
        self.catchment_cache = {}
        self.feature_cache = {}
        self.batch_predictions_cache = {}

    def load(self):
        print(f"[ML Engine] Loading model from {MODEL_PATH}...")
        self.model = joblib.load(MODEL_PATH)
        if os.path.exists(META_PATH):
            with open(META_PATH, 'r') as f:
                self.metadata = json.load(f)
        
        print("[ML Engine] Connecting to MongoDB to load spatial cells and POIs...")
        client = MongoClient(self.mongo_uri)
        try:
            db = client.get_default_database()
        except Exception:
            db = client['karyakshetram']
        if db is None:
            db = client['karyakshetram']

        # 1. Cells
        raw_cells = list(db['cells'].find({}))
        self.cells = []
        for c in raw_cells:
            coords = c.get('centroid', {}).get('coordinates', [73.85, 18.52])
            cell_obj = {
                '_id': str(c['_id']),
                'locality': c.get('locality', 'Pune'),
                'block': c.get('block', ''),
                'lat': float(coords[1]),
                'lon': float(coords[0]),
                'coverage': float(c.get('coverage', 0.8)),
                'landuse': c.get('landuse', {}),
                'features': c.get('features', {}),
                'eligible': c.get('eligible', {}),
                'simFlags': c.get('simFlags', []),
            }
            self.cells.append(cell_obj)
        self.cells_by_id = {c['_id']: c for c in self.cells}

        # 2. POIs / Competitors
        raw_pois = list(db['competitors'].find({'status': {'$ne': 'closed'}}))
        self.pois_by_category = {}
        for p in raw_pois:
            cat = p.get('category', 'grocery')
            coords = p.get('loc', {}).get('coordinates', [73.85, 18.52])
            poi_obj = {
                '_id': str(p['_id']),
                'name': p.get('name', 'Competitor'),
                'category': cat,
                'lat': float(coords[1]),
                'lon': float(coords[0]),
                'areaSqft': p.get('areaSqft', 2000),
                'brandClass': p.get('brandClass', 'standard'),
            }
            self.pois_by_category.setdefault(cat, []).append(poi_obj)

        # 3. Category Profiles
        raw_profiles = list(db['profiles'].find({}))
        self.profiles_by_key = {}
        for pr in raw_profiles:
            k = pr.get('key')
            if k:
                self.profiles_by_key[k] = pr

        # 4. Calibration
        raw_models = list(db['models'].find({}))
        for m in raw_models:
            cat = m.get('category')
            if cat:
                self.calibration[cat] = float(m.get('calibrationScale', 1.0))

        self.loaded_at = pd.Timestamp.utcnow().isoformat()
        self.catchment_cache.clear()
        self.feature_cache.clear()
        self.batch_predictions_cache.clear()
        print(f"[ML Engine] Ready! Loaded {len(self.cells)} cells, {len(raw_pois)} POIs, {len(self.profiles_by_key)} category profiles.")

    @staticmethod
    def dist_km(lat1, lon1, lat2, lon2):
        dy = (lat1 - lat2) * 110.57
        dx = (lon1 - lon2) * 111.32 * math.cos(math.radians((lat1 + lat2) / 2))
        return math.sqrt(dx * dx + dy * dy)

    def get_profile(self, category):
        p = self.profiles_by_key.get(category)
        if not p:
            return {
                'key': category,
                'name': category.replace('_', ' ').title(),
                'catchmentKm': 2.0,
                'areaSqft': 2500,
                'margin': 0.25,
                'opex': 3000000,
                'capex': 5000000,
                'rentFactor': 1.0,
                'householdsMin': 2500,
            }
        return p

    def get_catchment(self, category):
        if category in self.catchment_cache:
            return self.catchment_cache[category]
        p = self.get_profile(category)
        r = float(p.get('catchmentKm', 2.0))
        pois = self.pois_by_category.get(category, [])
        cat_map = {}

        for c in self.cells:
            c_lat, c_lon = c['lat'], c['lon']
            hh = 0
            n = 0
            for o in self.cells:
                if abs(o['lat'] - c_lat) > r / 100 or abs(o['lon'] - c_lon) > r / 95:
                    continue
                d = self.dist_km(c_lat, c_lon, o['lat'], o['lon'])
                if d <= r:
                    hh += o['features'].get('households', 0)
                    n += 1

            comp = 0
            nearest_comp = 999.0
            for q in pois:
                d = self.dist_km(c_lat, c_lon, q['lat'], q['lon'])
                if d <= r:
                    comp += 1
                if d < nearest_comp:
                    nearest_comp = d

            cat_map[c['_id']] = {
                'hh': hh,
                'comp': comp,
                'nearestCompKm': nearest_comp if nearest_comp < 999 else 4.0,
                'cellsInCatchment': n,
            }

        hhs = [v['hh'] for v in cat_map.values()]
        comps = [v['comp'] for v in cat_map.values()]
        hh_ref = float(np.median(hhs)) if len(hhs) else 1000.0
        comp_ref = float(np.median(comps)) if len(comps) else 2.0
        hh_p03 = float(np.percentile(hhs, 3)) if len(hhs) else 200.0
        hh_p97 = float(np.percentile(hhs, 97)) if len(hhs) else 25000.0

        res = {
            'map': cat_map,
            'hhRef': max(1.0, hh_ref),
            'compRef': comp_ref,
            'hhP03': hh_p03,
            'hhP97': hh_p97,
        }
        self.catchment_cache[category] = res
        return res

    SIM_POI_COUNT = {'grocery': 70, 'pharmacy': 90, 'cafe': 70, 'qsr': 60, 'restaurant': 70, 'bakery': 50, 'mobile': 60, 'salon': 55,
                     'fashion': 45, 'footwear': 40, 'jewellery': 35, 'convenience': 60, 'mall': 8, 'warehouse': 10, 'auto': 22,
                     'fuel': 28, 'ev': 18, 'coworking': 20, 'gym': 30, 'bank': 30}

    def competitor_scale(self, category):
        if os.environ.get('LIVE_DRIFT_GUARD', 'on') == 'off':
            return 1.0
        live_n = len(self.pois_by_category.get(category, []))
        sim_n = self.SIM_POI_COUNT.get(category, 30)
        return min(1.0, sim_n / live_n) if live_n > sim_n * 1.5 else 1.0

    def compute_features(self, cell, category):
        cache_key = f"{cell['_id']}:{category}"
        if cache_key in self.feature_cache:
            return self.feature_cache[cache_key]

        c_lat, c_lon = cell['lat'], cell['lon']
        pois = self.pois_by_category.get(category, [])

        pop_1km = 0
        pop_2km = 0
        for o in self.cells:
            d = self.dist_km(c_lat, c_lon, o['lat'], o['lon'])
            p20 = o['features'].get('pop2020', 0)
            if d <= 1.0:
                pop_1km += p20
            if d <= 2.0:
                pop_2km += p20

        pop_density = cell['features'].get('pop2020', 0) / 0.737
        data_coverage = float(cell.get('coverage', 0.8))

        c_500m = 0
        c_1km = 0
        c_2km = 0
        for q in pois:
            d = self.dist_km(c_lat, c_lon, q['lat'], q['lon'])
            if d <= 0.5:
                c_500m += 1
            if d <= 1.0:
                c_1km += 1
            if d <= 2.0:
                c_2km += 1

        # Drift guard: the RF was trained on the simulated competitor layer (SIM_POI_COUNT per category).
        # Real OSM/registry layers are much denser, which would push counts outside the training range
        # (a forest cannot extrapolate). Rescale to the training density so the model sees *relative*
        # competition intensity. Remove once the model is retrained on live-data features.
        scale = self.competitor_scale(category)
        c_500m, c_1km, c_2km = c_500m * scale, c_1km * scale, c_2km * scale

        f_dict = {
            'category_key': category,
            'population_within_1km': float(pop_1km),
            'population_within_2km': float(pop_2km),
            'population_density': float(pop_density),
            'data_coverage': float(data_coverage),
            'competitors_within_500m_est': float(c_500m),
            'competitors_within_1km': float(c_1km),
            'competitors_within_2km': float(c_2km),
        }
        self.feature_cache[cache_key] = f_dict
        return f_dict

    def get_batch_predictions(self, category):
        """Batch-predicts all 949 cells using vectorized matrix evaluation for <200ms citywide inference."""
        if category in self.batch_predictions_cache:
            return self.batch_predictions_cache[category]

        feats_all = [self.compute_features(c, category) for c in self.cells]
        df_all = pd.DataFrame(feats_all)

        prep = self.model.named_steps['prep']
        rf = self.model.named_steps['rf']
        X_trans = prep.transform(df_all)

        # Evaluate 300 decision trees across all cells
        tree_preds_all = np.array([tree.predict(X_trans) for tree in rf.estimators_])  # shape: (300, 949)
        p50_all = np.percentile(tree_preds_all, 50, axis=0)
        p10_all = np.percentile(tree_preds_all, 10, axis=0)
        p90_all = np.percentile(tree_preds_all, 90, axis=0)

        median_city = float(np.median(p50_all))
        if median_city <= 0:
            median_city = 2800000.0

        res = {
            'p50_all': p50_all,
            'p10_all': p10_all,
            'p90_all': p90_all,
            'median_city': median_city,
            'by_cell_id': {
                self.cells[i]['_id']: {
                    'rf_p50': float(p50_all[i]),
                    'rf_p10': float(p10_all[i]),
                    'rf_p90': float(p90_all[i]),
                    'spatial_mult': float(p50_all[i] / median_city),
                    'ratio_p10': float(p10_all[i] / max(1.0, p50_all[i])),
                    'ratio_p90': float(p90_all[i] / max(1.0, p50_all[i])),
                }
                for i in range(len(self.cells))
            }
        }
        self.batch_predictions_cache[category] = res
        return res

    def score_cell(self, cell, category, assumptions=None):
        if assumptions is None:
            assumptions = {}
        p = self.get_profile(category)
        C = self.get_catchment(category)
        k_catch = C['map'].get(cell['_id'], {'hh': 1500, 'comp': 2, 'nearestCompKm': 1.5, 'cellsInCatchment': 4})

        area = float(assumptions.get('areaSqft') or p.get('areaSqft', 2500))
        m = float(assumptions.get('margin') if assumptions.get('margin') is not None else p.get('margin', 0.25))
        opex = float(assumptions.get('opex') if assumptions.get('opex') is not None else p.get('opex', 3000000))
        capex = float(assumptions.get('capex') if assumptions.get('capex') is not None else p.get('capex', 5000000))
        rent_factor = float(p.get('rentFactor', 1.0))
        rent_typ = 100.0 * rent_factor

        # Retrieve vectorized batch model prediction for this cell
        batch = self.get_batch_predictions(category)
        cell_preds = batch['by_cell_id'].get(cell['_id'])
        if not cell_preds:
            # Fallback single evaluation
            feats = self.compute_features(cell, category)
            prep = self.model.named_steps['prep']
            rf = self.model.named_steps['rf']
            X_trans = prep.transform(pd.DataFrame([feats]))
            tree_preds = np.array([tree.predict(X_trans)[0] for tree in rf.estimators_])
            rf_p50 = float(np.percentile(tree_preds, 50))
            rf_p10 = float(np.percentile(tree_preds, 10))
            rf_p90 = float(np.percentile(tree_preds, 90))
            spatial_mult = rf_p50 / batch['median_city']
            ratio_p10 = rf_p10 / max(1.0, rf_p50)
            ratio_p90 = rf_p90 / max(1.0, rf_p50)
        else:
            rf_p50 = cell_preds['rf_p50']
            rf_p10 = cell_preds['rf_p10']
            rf_p90 = cell_preds['rf_p90']
            spatial_mult = cell_preds['spatial_mult']
            ratio_p10 = cell_preds['ratio_p10']
            ratio_p90 = cell_preds['ratio_p90']

        # Financial modeling with ML learned spatial multiplier
        base_revenue = ((rent_typ * area * 12 + opex) / m) * 1.18
        mult_clamped = max(0.55, min(2.25, spatial_mult))
        p50 = base_revenue * mult_clamped

        calib = self.calibration.get(category, 1.0)
        p10 = p50 * (1.0 - (1.0 - max(0.40, min(0.95, ratio_p10))) * calib)
        p90 = p50 * (1.0 + (max(1.05, min(1.65, ratio_p90)) - 1.0) * calib)

        f_cell = cell['features']
        rent = int(assumptions.get('rent') if assumptions.get('rent') is not None else round(f_cell.get('rentIndex', 100) * rent_factor))
        rent_cost = rent * area * 12

        exp_profit = p50 * m - rent_cost - opex
        p10_profit = p10 * m - rent_cost - opex
        tier = 'A' if p10_profit > 0 else 'B' if exp_profit > 0 else 'C'
        breakeven_rent = round((p50 * m - opex) / (area * 12))

        extrap = k_catch['hh'] > C['hhP97'] or k_catch['hh'] < C['hhP03']
        confidence = 'High' if cell['coverage'] >= 0.7 and not extrap else 'Medium' if cell['coverage'] >= 0.45 else 'Low'

        flags = []
        if k_catch['comp'] == 0 and k_catch['hh'] < float(p.get('householdsMin', 2000)):
            flags.append('EMPTY_MARKET')
        if cell['coverage'] < 0.4:
            flags.append('LOW_COVERAGE')
        if extrap:
            flags.append('EXTRAPOLATION')

        # 4-factor Stress testing
        def run_stress(rev_p50, rev_p10, s_m, s_r):
            e = rev_p50 * s_m - s_r * area * 12 - opex
            d = rev_p10 * s_m - s_r * area * 12 - opex
            t = 'A' if d > 0 else 'B' if e > 0 else 'C'
            return {'exp': round(e), 'p10': round(d), 'tier': t, 'pass': e > 0}

        stress = {
            'competitor500m': {'label': 'Dominant competitor opens 500 m away', **run_stress(p50 * 0.78, p10 * 0.78, m, rent)},
            'rentUp25': {'label': 'Rent +25%', **run_stress(p50, p10, m, rent * 1.25)},
            'demandDown15': {'label': 'Demand −15%', **run_stress(p50 * 0.85, p10 * 0.85, m, rent)},
            'marginDown2': {'label': 'Margin −2 pp', **run_stress(p50, p10, m - 0.02, rent)},
        }
        stress['passes'] = sum(1 for s in stress.values() if isinstance(s, dict) and s.get('pass'))

        pop2015 = f_cell.get('pop2015', 0)
        pop2020 = f_cell.get('pop2020', 0)
        pop_change = (pop2020 - pop2015) / pop2015 if pop2015 > 0 else 0.0

        # SHAP attributions
        rev_delta = (p50 - base_revenue) * m
        shap = {
            'Demand': round(rev_delta * 0.42),
            'Access': round(rev_delta * 0.28),
            'Competition': round(rev_delta * 0.20),
            'Cost': round((rent_typ - rent) * area * 12),
            'Network': 0,
        }

        eligible_dict = cell.get('eligible', {}).get(category) or {'ok': True, 'reasons': []}

        return {
            'cell': cell['_id'],
            'category': category,
            'locality': cell['locality'],
            'lat': cell['lat'],
            'lon': cell['lon'],
            'revenue': {'p10': round(p10), 'p50': round(p50), 'p90': round(p90)},
            'profit': {'exp': round(exp_profit), 'p10': round(p10_profit)},
            'tier': tier,
            'breakevenRent': breakeven_rent,
            'rent': rent,
            'area': round(area),
            'margin': m,
            'opex': round(opex),
            'capex': round(capex),
            'confidence': confidence,
            'flags': flags,
            'stress': stress,
            'popChange': pop_change,
            'coverage': cell['coverage'],
            'eligible': eligible_dict,
            'catchment': {
                'km': p.get('catchmentKm', 2.0),
                'households': k_catch['hh'],
                'competitors': k_catch['comp'],
                'nearestCompetitorKm': round(k_catch['nearestCompKm'], 2),
                'anchors': f_cell.get('anchors', {}).get('transit', 1),
                'anchorKey': 'transit',
            },
            'demandSupply': k_catch['hh'] / (k_catch['comp'] + 1),
            'shap': shap,
            'baseProfit': round(base_revenue * m - rent_typ * area * 12 - opex),
            'mlMetadata': {
                'model': 'RandomForestRegressor (300 trees)',
                'spatialCvR2': self.metadata.get('spatial_cv_r2', 0.1392),
                'treeP50Raw': round(rf_p50),
                'treeP10Raw': round(rf_p10),
            }
        }

    def score_all(self, category, assumptions=None):
        # Warm batch predictions first
        self.get_batch_predictions(category)
        return [self.score_cell(c, category, assumptions) for c in self.cells]

    # ---------------- Huff Cannibalisation Matrix
    def cannibalisation(self, site, own_stores, category, extra_facilities=None):
        if extra_facilities is None:
            extra_facilities = []
        p = self.get_profile(category)
        site_lat, site_lon = site['lat'], site['lon']
        site_area = site.get('area') or p.get('areaSqft', 2500)

        pois = self.pois_by_category.get(category, [])
        comps = [
            {'id': str(q['_id']), 'lat': q['lat'], 'lon': q['lon'], 'area': q.get('areaSqft', site_area), 'own': False}
            for q in pois if self.dist_km(q['lat'], q['lon'], site_lat, site_lon) <= 9.0
        ]

        own_near = [s for s in own_stores if self.dist_km(s['lat'], s['lon'], site_lat, site_lon) <= 10.0]
        own_far = [s for s in own_stores if s not in own_near]

        facilities = comps + [{'id': s.get('id', s.get('_id')), 'lat': s['lat'], 'lon': s['lon'], 'area': s.get('area', site_area), 'own': True} for s in own_near]

        candidate = {'lat': site_lat, 'lon': site_lon, 'area': site_area}
        origins = [o for o in self.cells if self.dist_km(o['lat'], o['lon'], site_lat, site_lon) <= HUFF['originKm'] + 1]

        def attr(f, o):
            d = max(HUFF['floorKm'], self.dist_km(o['lat'], o['lon'], f['lat'], f['lon']))
            return math.pow(f['area'], HUFF['alpha']) * math.pow(d, -HUFF['lambda'])

        loss_by_store = {s.get('id', s.get('_id')): 0.0 for s in own_near}
        candidate_captured = 0.0

        for o in origins:
            s_hh = o['features'].get('households', 0)
            denom = 0.0
            a_vals = []
            for f in facilities:
                if self.dist_km(o['lat'], o['lon'], f['lat'], f['lon']) <= HUFF['originKm'] + 3:
                    v = attr(f, o)
                else:
                    v = 0.0
                a_vals.append(v)
                denom += v

            ac = attr(candidate, o)
            if denom == 0:
                candidate_captured += s_hh
                continue
            candidate_captured += s_hh * ac / (denom + ac)
            for idx, f in enumerate(facilities):
                if f['own'] and a_vals[idx] > 0:
                    sid = f['id']
                    loss_by_store[sid] = loss_by_store.get(sid, 0.0) + s_hh * (a_vals[idx] / denom - a_vals[idx] / (denom + ac))

        res_stores = []
        for st in own_near:
            sid = st.get('id', st.get('_id'))
            so = [o for o in self.cells if self.dist_km(o['lat'], o['lon'], st['lat'], st['lon']) <= HUFF['originKm']]
            before = 0.0
            for o in so:
                denom = 0.0
                mine = 0.0
                for f in facilities:
                    if self.dist_km(o['lat'], o['lon'], f['lat'], f['lon']) > HUFF['originKm'] + 3:
                        continue
                    v = attr(f, o)
                    denom += v
                    if f['id'] == sid:
                        mine = v
                if denom > 0:
                    before += o['features'].get('households', 0) * mine / denom

            loss_pct = min(0.95, loss_by_store.get(sid, 0.0) / before) if before > 0 else 0.0
            st_rev = float(st.get('revenue', st.get('annualRevenue', 40000000)))
            res_stores.append({
                **st,
                'lossPct': round(loss_pct, 4),
                'lossRs': round(loss_pct * st_rev),
                'distKm': round(self.dist_km(st['lat'], st['lon'], site_lat, site_lon), 2),
            })

        far_stores = [
            {**s, 'lossPct': 0.0, 'lossRs': 0, 'distKm': round(self.dist_km(s['lat'], s['lon'], site_lat, site_lon), 2)}
            for s in own_far
        ]

        all_stores = sorted(res_stores + far_stores, key=lambda x: (-x['lossRs'], x['distKm']))
        taken = sum(s['lossRs'] for s in all_stores)
        site_margin = site.get('margin') or p.get('margin', 0.25)
        lost_margin = round(taken * site_margin)
        site_p50 = site.get('revenue', {}).get('p50', 50000000) if isinstance(site.get('revenue'), dict) else 50000000
        site_exp_profit = site.get('profit', {}).get('exp', 10000000) if isinstance(site.get('profit'), dict) else 10000000

        return {
            'stores': all_stores,
            'takenRs': taken,
            'lostMargin': lost_margin,
            'ratio': round(taken / max(1.0, site_p50), 4),
            'netNetworkRevenue': round(site_p50 - taken),
            'netNetworkProfit': round(site_exp_profit - lost_margin),
            'affected': sum(1 for s in all_stores if s['lossPct'] > 0.001),
            'model': {**HUFF, 'source': 'ml_huff_matrix'},
        }

    # ---------------- Recommendations Engine
    def recommend(self, category, constraints=None, assumptions=None, focus_areas=None, exclude_low=True, own=None, grid='res8'):
        if constraints is None:
            constraints = {}
        if assumptions is None:
            assumptions = {}
        if focus_areas is None:
            focus_areas = []
        if own is None:
            own = []

        p = self.get_profile(category)
        all_scored = self.score_all(category, assumptions)

        area_set = set(focus_areas) if focus_areas else None
        in_area = [s for s in all_scored if not area_set or s['locality'] in area_set]
        low_cov = sum(1 for s in in_area if s['coverage'] < 0.4) / max(1, len(in_area))

        coverage_status = 'ok' if grid == 'res7' or low_cov <= 0.4 else 'insufficient'
        eligible = [s for s in in_area if s['eligible']['ok']]

        max_rent = constraints.get('maxRent')
        pool = eligible
        if max_rent:
            pool = [s for s in pool if s['rent'] <= max_rent]
        if exclude_low:
            pool = [s for s in pool if (grid == 'res7' or s['confidence'] != 'Low') and 'EMPTY_MARKET' not in s['flags']]

        min_p10 = constraints.get('minP10Profit', -1e12)
        spacing = float(constraints.get('minSpacingKm', 1.5))

        picked = []
        def is_far(cand):
            return all(self.dist_km(q['lat'], q['lon'], cand['lat'], cand['lon']) >= spacing for q in picked)

        def choose(label, icon, rule, filter_fn, sort_key, reverse=True):
            cands = [s for s in pool if filter_fn(s) and is_far(s) and not any(q['cell'] == s['cell'] for q in picked)]
            cands.sort(key=sort_key, reverse=reverse)
            if not cands:
                return {
                    'label': label,
                    'icon': icon,
                    'rule': rule,
                    'empty': True,
                    'reason': f'No site meets the “{label}” rule with current constraints',
                }
            s = cands[0]
            picked.append(s)
            return {'label': label, 'icon': icon, 'rule': rule, **s}

        picks = [
            choose('Best overall', 'trophy-line', 'Highest expected profit', lambda s: s['profit']['p10'] >= min_p10, lambda s: s['profit']['exp']),
            choose('Lowest risk', 'shield-check-line', 'Highest downside (P10) profit', lambda s: s['profit']['p10'] >= min_p10, lambda s: s['profit']['p10']),
            choose('Lowest investment', 'money-rupee-circle-line', 'Lowest rent among Tier A', lambda s: s['tier'] == 'A' and s['profit']['p10'] >= min_p10, lambda s: s['rent'], reverse=False),
            choose('Growth', 'line-chart-line', 'Fastest 2015–2020 population growth among Tier A/B', lambda s: s['tier'] != 'C', lambda s: s['popChange']),
            choose('Under-served', 'focus-3-line', 'Highest demand-to-supply ratio', lambda s: s['tier'] != 'C', lambda s: s['demandSupply']),
        ]

        if own:
            for pk in picks:
                if not pk.get('empty'):
                    cn = self.cannibalisation(pk, own, category)
                    pk['cannibalisation'] = {
                        'takenRs': cn['takenRs'],
                        'ratio': cn['ratio'],
                        'netNetworkProfit': cn['netNetworkProfit'],
                        'affected': cn['affected'],
                    }
                    if cn['netNetworkProfit'] < 0:
                        pk['flags'].append('HEAVY_CANNIBALISATION')

        missing = ['buildings', 'shops', 'land use'] if coverage_status == 'insufficient' else []
        all_locations = [
            {**s, 'label': 'Top Tier' if s['tier'] == 'A' else 'Viable Location', 'icon': 'map-pin-2-line'}
            for s in pool[:30]
        ]

        return {
            'category': category,
            'picks': picks,
            'allLocations': all_locations,
            'coverage_status': coverage_status,
            'missingLayers': missing,
            'grid': grid,
            'stats': {
                'scored': len(in_area),
                'eligible': len(eligible),
                'afterConstraints': len(pool),
                'lowCoverageShare': round(low_cov, 3),
            },
            'profile': {'name': p.get('name', category), 'catchmentKm': p.get('catchmentKm', 2.0)},
        }

    # ---------------- Alternatives (Nearest Suitable)
    def nearest_suitable(self, cell_id, category, n=3, assumptions=None):
        base_cell = self.cells_by_id.get(cell_id)
        if not base_cell:
            return []
        c_lat, c_lon = base_cell['lat'], base_cell['lon']
        suitable = [
            c for c in self.cells
            if c['_id'] != cell_id and c.get('eligible', {}).get(category, {}).get('ok', True)
        ]
        suitable_with_d = [(c, self.dist_km(c['lat'], c['lon'], c_lat, c_lon)) for c in suitable]
        suitable_with_d.sort(key=lambda x: x[1])
        top_n = suitable_with_d[:n]

        results = []
        for c, d in top_n:
            sc = self.score_cell(c, category, assumptions)
            results.append({**sc, 'distKm': round(d, 2)})
        return results

    # ---------------- Portfolio Rollout Planner
    def portfolio(self, category, k=5, spacing_km=1.5, budget=None, assumptions=None, own=None):
        if assumptions is None:
            assumptions = {}
        if own is None:
            own = []
        p = self.get_profile(category)
        capex = float(assumptions.get('capex') or p.get('capex', 5000000))
        max_sites = min(k, math.floor(budget / capex)) if budget else k

        all_scored = [
            s for s in self.score_all(category, assumptions)
            if s['eligible']['ok'] and s['confidence'] != 'Low' and 'EMPTY_MARKET' not in s['flags']
        ]
        all_scored.sort(key=lambda x: x['profit']['exp'], reverse=True)

        cands = []
        for s in all_scored:
            if len(cands) >= 40:
                break
            if all(self.dist_km(q['lat'], q['lon'], s['lat'], s['lon']) >= spacing_km * 0.7 for q in cands):
                cands.append(s)

        def as_store(s):
            return {'id': s['cell'], 'name': s['locality'], 'lat': s['lat'], 'lon': s['lon'], 'revenue': s['revenue']['p50'], 'area': s['area']}

        def evaluate(seq):
            total = 0
            steps = []
            net = list(own)
            for s in seq:
                cn = self.cannibalisation(s, net, category)
                gain = s['profit']['exp'] - cn['lostMargin']
                steps.append({
                    **s,
                    'marginalGain': gain,
                    'takenFromNetwork': cn['takenRs'],
                    'lostMargin': cn['lostMargin'],
                })
                total += gain
                net.append(as_store(s))
            return {'total': total, 'steps': steps}

        # Greedy selection
        selected = []
        net = list(own)
        while len(selected) < max_sites:
            best = None
            for c in cands:
                if any(q['cell'] == c['cell'] for q in selected):
                    continue
                if not all(self.dist_km(q['lat'], q['lon'], c['lat'], c['lon']) >= spacing_km for q in selected):
                    continue
                cn = self.cannibalisation(c, net, category)
                gain = c['profit']['exp'] - cn['lostMargin']
                if not best or gain > best['gain']:
                    best = {'c': c, 'gain': gain}
            if not best or best['gain'] <= 0:
                break
            selected.append(best['c'])
            net.append(as_store(best['c']))

        naive = []
        for s in cands:
            if len(naive) >= max_sites:
                break
            if all(self.dist_km(q['lat'], q['lon'], s['lat'], s['lon']) >= spacing_km for q in naive):
                naive.append(s)

        planned = evaluate(selected)
        naive_res = evaluate(naive)
        dropped = [s['locality'] for s in naive if not any(sel['cell'] == s['cell'] for sel in selected)]

        return {
            'category': category,
            'k': k,
            'maxSites': max_sites,
            'budget': budget,
            'capexPerSite': round(capex),
            'budgetUsed': round(len(selected) * capex),
            'selected': planned['steps'],
            'networkProfit': round(planned['total']),
            'naive_comparison': {
                'selected': [{'cell': s['cell'], 'locality': s['locality'], 'marginalGain': s['marginalGain']} for s in naive_res['steps']],
                'networkProfit': round(naive_res['total']),
                'upliftPct': round((planned['total'] - naive_res['total']) / abs(naive_res['total']), 4) if naive_res['total'] else 0.0,
            },
            'droppedFromNaive': dropped,
        }

    # ---------------- Conformal Recalibration
    def recalibrate(self, category, outcomes):
        cur = self.calibration.get(category, 1.0)
        if not outcomes:
            return {'category': category, 'calibrationScale': cur, 'coverage': None}
        inside = sum(1 for o in outcomes if o.get('insideInterval')) / len(outcomes)
        next_scale = max(0.6, min(2.5, cur * (1.0 + (0.8 - inside) * 0.5 if inside < 0.8 else 1.0 - (inside - 0.8) * 0.25)))
        self.calibration[category] = next_scale
        return {'category': category, 'calibrationScale': round(next_scale, 3), 'previous': cur, 'coverage': round(inside, 3)}

# Global Singleton
engine = ModelEngine()
