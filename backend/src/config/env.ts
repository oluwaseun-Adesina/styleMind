import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath =
  process.env.NODE_ENV === 'production'
    ? path.resolve(__dirname, '../../.env.production')
    : path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const env = {
  JWT_SECRET: required('JWT_SECRET'),
  GEMINI_API_KEY: required('GEMINI_API_KEY'),
  MONGODB_URI: required('MONGODB_URI'),
  GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID'),
  // Additional OAuth client IDs (e.g. Android/iOS native clients) whose tokens
  // are accepted. Comma-separated. GOOGLE_CLIENT_ID is always allowed.
  GOOGLE_ALLOWED_AUDIENCES: (process.env.GOOGLE_ALLOWED_AUDIENCES || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean),
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
  // Transactional email (password reset). Without a key, emails are logged to
  // the console instead of sent — fine for local development.
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM || 'FitPick <onboarding@resend.dev>',
  HF_TOKEN: process.env.HF_TOKEN,
  PORT: Number(process.env.PORT || 8787),
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Rate-limit ceilings (per window). Overridable so tests can disable throttling.
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX || 100),
  AUTH_RATE_LIMIT_MAX: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  AI_RATE_LIMIT_MAX: Number(process.env.AI_RATE_LIMIT_MAX || 10),
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
};
