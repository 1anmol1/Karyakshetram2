import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { errorHandler } from './middleware/index.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import storeRoutes from './routes/stores.js';
import coreRoutes from './routes/core.js';
import userRoutes from './routes/user.js';
import liveRoutes from './routes/live.js';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    origin: (origin, cb) => (!origin || config.corsOrigins.includes(origin) || config.corsOrigins.includes('*') ? cb(null, true) : cb(null, false)),
    credentials: true,
  }));
  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  if (config.env !== 'test') app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));

  const limiter = rateLimit({
    windowMs: 60_000, limit: config.rateLimitPerMin, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (req, res, next, opts) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: `Too many requests. Try again in ${Math.ceil(opts.windowMs / 1000)} s.`, field: null, retryAfterSec: Math.ceil(opts.windowMs / 1000) } }),
  });
  const authLimiter = rateLimit({ windowMs: 60_000, limit: 20, handler: (req, res) => res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Try again in 60 s.', field: null, retryAfterSec: 60 } }) });

  app.use('/api', limiter);
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/stores', storeRoutes);
  app.use('/api/live', liveRoutes);
  app.use('/api', userRoutes);
  app.use('/api', coreRoutes);
  app.use('/api', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route ${req.method} ${req.originalUrl}`, field: null } }));

  // Static SPA serving in production or when client/dist exists
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
