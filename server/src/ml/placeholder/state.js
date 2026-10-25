// In-memory working set, loaded from MongoDB at startup (mirrors how the FastAPI service
// "loads features, Huff denominators and model artifacts from MongoDB at startup").
import { Cell, Poi, CategoryProfile, MlModel } from '../../models/index.js';
import { config } from '../../config/index.js';

export const state = { cells: [], byId: new Map(), pois: new Map(), profiles: new Map(), calib: new Map(), loadedAt: null };

export async function loadState() {
  const [cells, pois, profiles, models] = await Promise.all([
    Cell.find({}).lean(), Poi.find({ status: { $ne: 'closed' } }).lean(), CategoryProfile.find({}).lean(), MlModel.find({ version: config.modelVersion }).lean(),
  ]);
  state.cells = cells.map((c) => ({ ...c, lat: c.centroid.coordinates[1], lon: c.centroid.coordinates[0] }));
  state.byId = new Map(state.cells.map((c) => [c._id, c]));
  state.pois = new Map();
  for (const p of pois) {
    const arr = state.pois.get(p.category) || [];
    arr.push({ ...p, lat: p.loc.coordinates[1], lon: p.loc.coordinates[0] });
    state.pois.set(p.category, arr);
  }
  state.profiles = new Map(profiles.map((p) => [p.key, p]));
  state.calib = new Map(models.map((m) => [m.category, m.calibrationScale || 1]));
  state.loadedAt = new Date();
  caches.clear();
  return { cells: state.cells.length, pois: pois.length, profiles: profiles.length };
}

export const caches = new Map();

// fast planar distance in km (accurate to <0.5% at city scale)
export function distKm(aLat, aLon, bLat, bLon) {
  const dy = (aLat - bLat) * 110.57, dx = (aLon - bLon) * 111.32 * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
  return Math.sqrt(dx * dx + dy * dy);
}
