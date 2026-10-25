import mongoose from 'mongoose';
import { config } from './config/index.js';
import { createApp } from './app.js';
import { loadState } from './ml/placeholder/state.js';
import { startScheduler } from './services/liveData.js';

async function start() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  const s = await loadState();
  if (!s.cells) console.warn('No cells found. Run `npm run seed` first.');
  console.log(`Loaded ${s.cells} cells, ${s.pois} POIs, ${s.profiles} category profiles · ML mode: ${config.mlServiceUrl ? 'remote ' + config.mlServiceUrl : 'placeholder'}`);
  const app = createApp();
  startScheduler(); // live OSM + registry competitor refresh (LIVE_REFRESH_HOURS, LIVE_DATA=off to disable)
  app.listen(config.port, () => console.log(`Karyakshetram API on http://localhost:${config.port}`));
}

start().catch((e) => { console.error('Failed to start:', e.message); process.exit(1); });
