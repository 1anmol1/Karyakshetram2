import 'dotenv/config';

const list = (v, d) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : d);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/karyakshetram',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  corsOrigins: list(process.env.CORS_ORIGINS, ['http://localhost:5173', 'http://127.0.0.1:5173']),
  // ---- ML service (FastAPI, built separately). Leave empty to use the placeholder engine.
  mlServiceUrl: process.env.ML_SERVICE_URL || '',
  mlInternalKey: process.env.ML_INTERNAL_KEY || '',
  mlTimeoutMs: Number(process.env.ML_TIMEOUT_MS || 8000),
  // ---- LLM narrative provider (optional). Leave empty to use template narratives only.
  llmUrl: process.env.LLM_URL || '',
  llmApiKey: process.env.LLM_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '',
  modelVersion: process.env.MODEL_VERSION || 'placeholder-0.1.0',
  city: process.env.CITY || 'pune',
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN || 300),
};
