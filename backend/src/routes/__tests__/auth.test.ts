import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { startTestDb, stopTestDb, clearDb } from '../../test/db.js';

beforeAll(startTestDb);
afterAll(stopTestDb);
afterEach(async () => {
  vi.restoreAllMocks();
  await clearDb();
});

const signup = (email = 'new@example.com', password = 'supersecret') =>
  request(app).post('/api/auth/signup').send({ email, password });

describe('POST /api/auth/signup', () => {
  it('creates a user and returns an access + refresh token', async () => {
    const res = await signup();
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.email).toBe('new@example.com');
  });

  it('rejects a duplicate email', async () => {
    await signup();
    const res = await signup();
    expect(res.status).toBe(409);
  });

  it('rejects a short password', async () => {
    const res = await signup('x@example.com', 'short');
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects an unknown user / wrong password', async () => {
    await signup('login@example.com', 'supersecret');
    expect((await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'wrong' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'missing@example.com', password: 'supersecret' })).status).toBe(401);
  });

  it('logs in with valid credentials', async () => {
    await signup('login2@example.com', 'supersecret');
    const res = await request(app).post('/api/auth/login').send({ email: 'login2@example.com', password: 'supersecret' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });
});

describe('POST /api/auth/refresh', () => {
  it('exchanges a valid refresh token for a fresh pair', async () => {
    const { body } = await signup('refresh@example.com');
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: body.data.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
  });

  it('rejects an access token used as a refresh token', async () => {
    const { body } = await signup('refresh2@example.com');
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: body.data.token });
    expect(res.status).toBe(401);
  });

  it('rejects a garbage refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'not-a-jwt' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/google (audience verification)', () => {
  // Helper to stub the two Google network calls authService makes for access tokens.
  const stubGoogle = (tokeninfo: any, userinfo: any = { email: 'victim@example.com', email_verified: true }) => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = String(url).includes('tokeninfo') ? tokeninfo : userinfo;
      return { ok: true, json: async () => body } as Response;
    }));
  };

  it('rejects an access token minted for a different OAuth app', async () => {
    stubGoogle({ aud: 'attacker-app.apps.googleusercontent.com', email: 'victim@example.com' });
    const res = await request(app).post('/api/auth/google').send({ token: 'ya29.attacker-access-token' });
    expect(res.status).toBe(401);
  });

  it('accepts an access token whose audience is one of our client IDs', async () => {
    stubGoogle({ aud: 'web-client.apps.googleusercontent.com', email: 'victim@example.com', email_verified: true });
    const res = await request(app).post('/api/auth/google').send({ token: 'ya29.legit-access-token' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('victim@example.com');
    expect(res.body.data.token).toBeTruthy();
  });

  it('accepts a token bound via azp when aud is absent', async () => {
    stubGoogle({ azp: 'android-client.apps.googleusercontent.com', email: 'mobile@example.com', email_verified: true });
    const res = await request(app).post('/api/auth/google').send({ token: 'ya29.mobile-access-token' });
    expect(res.status).toBe(200);
  });
});
