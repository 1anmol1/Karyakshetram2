import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const Point = new Schema({ type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } }, { _id: false });

// ---------- users & business profile (onboarding 5 steps, editable from Profile)
const UserSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  failedLogins: { type: Number, default: 0 },
  lockedUntil: Date,
  profile: {
    businessName: String,
    businessActivity: String,
    businessType: String,
    categories: [String],
    challengesNote: String,
    challenges: [String],
    role: { type: String, enum: ['expansion_manager', 'finance_analyst', 'regional_head', 'independent_owner'], default: 'expansion_manager' },
    category: { type: String, default: 'grocery' },
    city: { type: String, default: 'pune' },
    focusAreas: [String],
    grid: { type: String, enum: ['res8', 'res7'], default: 'res8' },
    hasStores: Boolean,
    competitorBrands: [String],
    format: {
      areaSqft: Number, margin: Number, opex: Number, capex: Number, staff: Number,
      extras: { type: Schema.Types.Mixed, default: {} },
      drivers: { type: Schema.Types.Mixed, default: {} },
    },
    goals: {
      budget: Number, maxRent: Number, minSpacingKm: { type: Number, default: 1.5 }, minP10Profit: { type: Number, default: 0 },
      k: { type: Number, default: 5 }, risk: { type: String, enum: ['conservative', 'balanced', 'aggressive'], default: 'balanced' },
      excludeLowConfidence: { type: Boolean, default: true },
    },
    onboardingStep: { type: Number, default: 1 },
    completed: { type: Boolean, default: false },
  },
}, { timestamps: true });
UserSchema.methods.toJSON = function () { const o = this.toObject(); delete o.passwordHash; delete o.failedLogins; delete o.lockedUntil; return o; };
export const User = model('User', UserSchema);

// ---------- H3 cells with features (written by the offline pipeline; seeded here)
const CellSchema = new Schema({
  _id: String, // H3 index
  centroid: Point,
  locality: String,
  block: String, // res-6 parent, used for spatial CV
  features: { type: Schema.Types.Mixed, default: {} },
  landuse: { res: Number, com: Number, ind: Number, green: Number, water: Number },
  coverage: Number,
  eligible: { type: Schema.Types.Mixed, default: {} }, // { category: { ok, reasons[] } }
  simFlags: [String],
}, { versionKey: false });
CellSchema.index({ centroid: '2dsphere' });
export const Cell = model('Cell', CellSchema);

// ---------- simulated chain stores and the user's own stores
const StoreSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  name: String,
  category: { type: String, index: true },
  loc: Point,
  h3: { type: String, index: true },
  annualRevenue: Number,
  revenueEstimated: { type: Boolean, default: false },
  chain: { type: String, enum: ['own', 'sim'], default: 'own' },
}, { timestamps: true });
StoreSchema.index({ loc: '2dsphere' });
export const Store = model('Store', StoreSchema);

// ---------- competitors and complementary anchors (OSM POIs)
const PoiSchema = new Schema({
  osmId: String, name: String, category: { type: String, index: true }, brandClass: String, areaSqft: Number,
  loc: Point, h3: { type: String, index: true }, locality: String,
  // live data: where the record came from and whether it still exists
  source: { type: String, default: 'simulated' }, // simulated | osm | gplaces | ocm | registry | platform | multi
  sources: [String], platforms: [String], // every connector / platform that confirmed this business
  brand: String, regNo: String,
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  closedReason: String, // NOT_IN_LATEST_OSM | REGISTRY_CANCELLED | USER_REPORTED | WHAT_IF
  firstSeen: Date, lastSeen: Date, statusChangedAt: Date,
}, { versionKey: false });
PoiSchema.index({ loc: '2dsphere' });
export const Poi = model('Poi', PoiSchema, 'competitors');

const ProfileSchema = new Schema({
  key: { type: String, unique: true }, order: Number, name: String, icon: String, group: String, catchmentKm: Number, areaSqft: Number,
  margin: Number, opex: Number, capex: Number, rentFactor: Number, householdsMin: Number, drivers: String, ruleText: String,
  rules: [{ kind: String, args: [Schema.Types.Mixed] }], fields: [Schema.Types.Mixed], p0: Boolean, version: Number,
}, { versionKey: false });
export const CategoryProfile = model('CategoryProfile', ProfileSchema, 'profiles');

// ---------- cached scores (Express caches by model version + parameter hash)
const ScoreSchema = new Schema({
  _id: String, modelVersion: { type: String, index: true }, category: String, paramsHash: String, cell: String,
  revenue: { p10: Number, p50: Number, p90: Number }, profit: { exp: Number, p10: Number }, tier: String, breakevenRent: Number, rent: Number,
  confidence: String, flags: [String], stress: Schema.Types.Mixed, popChange: Number, rank: Number,
}, { versionKey: false });
ScoreSchema.index({ modelVersion: 1, category: 1, paramsHash: 1, rank: 1 });
export const Score = model('Score', ScoreSchema);

const ModelSchema = new Schema({
  version: String, category: String, metrics: Schema.Types.Mixed, featureList: [String], manifestHash: String,
  calibrationScale: { type: Number, default: 1 }, source: { type: String, default: 'placeholder' }, artifact: String,
}, { timestamps: true });
ModelSchema.index({ version: 1, category: 1 }, { unique: true });
export const MlModel = model('MlModel', ModelSchema, 'models');

export const Outcome = model('Outcome', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' }, cell: String, category: { type: String, index: true }, openedOn: Date,
  actualMonthlyRevenue: Number, predicted: { p10: Number, p50: Number, p90: Number }, insideInterval: Boolean, modelVersionAtPrediction: String,
}, { timestamps: true }));

export const Feedback = model('Feedback', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' }, cell: String, category: { type: String, index: true },
  rating: { type: String, enum: ['up', 'down'] }, reasonCode: String, comment: String,
}, { timestamps: true }));

export const Job = model('Job', new Schema({ type: String, status: { type: String, index: true }, progress: Number, error: String, result: Schema.Types.Mixed }, { timestamps: true }));

const SavedSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', index: true }, cell: String, category: String, name: String, list: { type: String, default: 'Shortlist' },
  snapshot: Schema.Types.Mixed, note: String,
}, { timestamps: true });
SavedSchema.index({ user: 1, cell: 1, category: 1 }, { unique: true });
export const Saved = model('Saved', SavedSchema);

export const SearchLog = model('SearchLog', new Schema({ user: { type: Schema.Types.ObjectId, ref: 'User' }, locality: String, category: String, q: String }, { timestamps: true }));

export const SiteVisit = model('SiteVisit', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' }, author: String, cell: String, category: String, quotedRent: Number, footfall: Number, notes: String,
}, { timestamps: true }));

// ---------- live data sync log (one row per category per sync)
const LiveSyncSchema = new Schema({
  category: { type: String, index: true }, ok: Boolean, error: String, durationMs: Number,
  fetched: Number, osm: Number, registry: Number, both: Number, open: Number,
  added: Number, closed: Number, reopened: Number, nameCoverage: Number, feasibility: Number,
  bySource: Schema.Types.Mixed, warnings: [String],
}, { timestamps: true, versionKey: false });
export const LiveSync = model('LiveSync', LiveSyncSchema, 'live_syncs');
