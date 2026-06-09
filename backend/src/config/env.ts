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
  OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
  HF_TOKEN: process.env.HF_TOKEN,
  PORT: Number(process.env.PORT || 8787),
  NODE_ENV: process.env.NODE_ENV || 'development',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),
};
