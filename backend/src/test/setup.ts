// Runs before any test module is imported. Set env vars here so that
// `config/env.ts` (which validates required vars at import time) succeeds with
// known test values. dotenv.config() does not override already-set vars, so
// these win over any real backend/.env on disk.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-prod';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/fitpick-test';
process.env.GOOGLE_CLIENT_ID = 'web-client.apps.googleusercontent.com';
process.env.GOOGLE_ALLOWED_AUDIENCES = 'android-client.apps.googleusercontent.com';

// Disable throttling so integration tests aren't rejected with 429.
process.env.RATE_LIMIT_MAX = '100000';
process.env.AUTH_RATE_LIMIT_MAX = '100000';
process.env.AI_RATE_LIMIT_MAX = '100000';

// Silence the app's informational request logging during tests. Warnings and
// errors still surface so genuine failures remain visible.
console.log = () => {};
console.info = () => {};
