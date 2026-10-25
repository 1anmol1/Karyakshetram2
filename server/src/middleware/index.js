import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { config } from '../config/index.js';
import { ApiError } from '../utils/index.js';
import { User } from '../models/index.js';

export function sign(user) { return jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: config.jwtExpires }); }

export async function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue');
    let payload;
    try { payload = jwt.verify(token, config.jwtSecret); } catch (e) {
      throw new ApiError(401, e.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED', e.name === 'TokenExpiredError' ? 'Your session expired. Please sign in again.' : 'Invalid session');
    }
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Account not found');
    req.user = user;
    next();
  } catch (e) { next(e); }
}

// Optional auth: attaches user if a valid token is present, never blocks
export async function optionalAuth(req, res, next) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return next();
  try { const p = jwt.verify(h.slice(7), config.jwtSecret); req.user = await User.findById(p.sub); } catch { /* ignore */ }
  next();
}

export const validate = (schema, where = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[where]);
  if (!r.success) return next(r.error);
  req[where === 'body' ? 'body' : 'q'] = r.data;
  next();
};

// Stable error schema: { error: { code, message, field } }
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    const i = err.issues[0];
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: i.message, field: i.path.join('.') || null, issues: err.issues.map((x) => ({ field: x.path.join('.'), message: x.message })) } });
  }
  if (err instanceof ApiError) return res.status(err.status).json({ error: { code: err.code, message: err.message, field: err.field || null } });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large', field: null } });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: 'File must be 1 MB or smaller', field: 'file' } });
  if (err?.code === 11000) return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Already exists', field: Object.keys(err.keyPattern || {})[0] || null } });
  if (err?.name === 'SyntaxError' && 'body' in err) return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON body', field: null } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side', field: null } });
}
