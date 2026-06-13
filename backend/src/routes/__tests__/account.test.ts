import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { startTestDb, stopTestDb, clearDb, createUserWithToken } from '../../test/db.js';
import { User } from '../../models/User.js';
import { Wardrobe } from '../../models/Wardrobe.js';
import { SavedOutfit } from '../../models/SavedOutfit.js';
import { Event } from '../../models/Event.js';
import { sendPasswordResetEmail } from '../../services/emailService.js';

vi.mock('../../services/emailService.js', () => ({
  sendPasswordResetEmail: vi.fn(async () => {}),
}));

const sendResetMock = vi.mocked(sendPasswordResetEmail);

beforeAll(startTestDb);
afterAll(stopTestDb);
afterEach(async () => {
  sendResetMock.mockClear();
  await clearDb();
});

const signup = (email = 'reset@example.com', password = 'supersecret') =>
  request(app).post('/api/auth/signup').send({ email, password });

const requestResetCode = async (email = 'reset@example.com'): Promise<string> => {
  const res = await request(app).post('/api/auth/forgot-password').send({ email });
  expect(res.status).toBe(200);
  return sendResetMock.mock.calls[0][1];
};

describe('POST /api/auth/forgot-password', () => {
  it('emails a 6-digit code to an existing user', async () => {
    await signup();
    const code = await requestResetCode();
    expect(sendResetMock).toHaveBeenCalledWith('reset@example.com', expect.stringMatching(/^\d{6}$/));
    expect(code).toMatch(/^\d{6}$/);
  });

  it('returns 200 without sending email for an unknown address (no enumeration)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(sendResetMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/reset-password', () => {
  it('resets the password with a valid code and logs the user in', async () => {
    await signup();
    const code = await requestResetCode();

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'reset@example.com', code, newPassword: 'brand-new-pass' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();

    // Old password no longer works, new one does.
    expect((await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'supersecret' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'reset@example.com', password: 'brand-new-pass' })).status).toBe(200);
  });

  it('rejects a wrong code and a reused code', async () => {
    await signup();
    const code = await requestResetCode();
    const wrong = code === '000000' ? '000001' : '000000';

    const bad = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'reset@example.com', code: wrong, newPassword: 'brand-new-pass' });
    expect(bad.status).toBe(401);

    const good = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'reset@example.com', code, newPassword: 'brand-new-pass' });
    expect(good.status).toBe(200);

    // Code is cleared after use.
    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'reset@example.com', code, newPassword: 'another-pass-123' });
    expect(reuse.status).toBe(401);
  });

  it('locks out after too many wrong attempts', async () => {
    await signup();
    const code = await requestResetCode();
    const wrong = code === '000000' ? '000001' : '000000';

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ email: 'reset@example.com', code: wrong, newPassword: 'brand-new-pass' });
      expect(res.status).toBe(401);
    }

    // Even the correct code is refused once attempts are exhausted.
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'reset@example.com', code, newPassword: 'brand-new-pass' });
    expect(res.status).toBe(429);
  });

  it('rejects an expired code', async () => {
    await signup();
    const code = await requestResetCode();
    await User.updateOne({ email: 'reset@example.com' }, { resetCodeExpiresAt: new Date(Date.now() - 1000) });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ email: 'reset@example.com', code, newPassword: 'brand-new-pass' });
    expect(res.status).toBe(401);
  });
});

describe('account settings', () => {
  it('GET /api/auth/me returns the profile with hasPassword', async () => {
    const { body } = await signup('me@example.com');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@example.com');
    expect(res.body.data.hasPassword).toBe(true);
  });

  it('PATCH /api/auth/me updates the name', async () => {
    const { body } = await signup('rename@example.com');
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${body.data.token}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });

  it('requires auth for settings endpoints', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/change-password').send({ newPassword: 'whatever-123' })).status).toBe(401);
  });

  it('POST /api/auth/change-password verifies the current password', async () => {
    const { body } = await signup('change@example.com');
    const auth = { Authorization: `Bearer ${body.data.token}` };

    const wrong = await request(app)
      .post('/api/auth/change-password')
      .set(auth)
      .send({ currentPassword: 'not-it', newPassword: 'fresh-password' });
    expect(wrong.status).toBe(401);

    const missing = await request(app)
      .post('/api/auth/change-password')
      .set(auth)
      .send({ newPassword: 'fresh-password' });
    expect(missing.status).toBe(400);

    const ok = await request(app)
      .post('/api/auth/change-password')
      .set(auth)
      .send({ currentPassword: 'supersecret', newPassword: 'fresh-password' });
    expect(ok.status).toBe(200);

    expect((await request(app).post('/api/auth/login').send({ email: 'change@example.com', password: 'fresh-password' })).status).toBe(200);
  });

  it('lets a Google-only account set a password without a current one', async () => {
    // createUserWithToken creates a user with no password, like a Google signup.
    const { authHeader, email } = await createUserWithToken('google-only@example.com');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', authHeader)
      .send({ newPassword: 'their-first-pass' });
    expect(res.status).toBe(200);

    expect((await request(app).post('/api/auth/login').send({ email, password: 'their-first-pass' })).status).toBe(200);
  });
});

describe('DELETE /api/auth/me (account deletion)', () => {
  it('deletes the account and all user data with the correct password', async () => {
    const { body } = await signup('gone@example.com');
    const auth = { Authorization: `Bearer ${body.data.token}` };

    // Seed data in every collection that must be cascaded.
    await request(app)
      .post('/api/wardrobes')
      .set(auth)
      .send({ name: 'White Tee', color: 'white', type: 'top', formality: 'casual' });
    const user = await User.findOne({ email: 'gone@example.com' });
    await SavedOutfit.create({
      uid: user!._id,
      occasion: 'casual day',
      top: { name: 'White Tee', reason: 'clean' },
      bottom: { name: 'Jeans', reason: 'classic' },
      shoes: { name: 'Sneakers', reason: 'comfy' },
      accessory: { name: 'Watch', reason: 'timeless' },
    });
    await Event.create({ uid: user!._id, title: 'Dinner', date: '2026-07-01' });

    const res = await request(app)
      .delete('/api/auth/me')
      .set(auth)
      .send({ confirm: 'DELETE', password: 'supersecret' });
    expect(res.status).toBe(200);

    expect(await User.findOne({ email: 'gone@example.com' })).toBeNull();
    expect(await Wardrobe.countDocuments({ uid: user!._id })).toBe(0);
    expect(await SavedOutfit.countDocuments({ uid: user!._id })).toBe(0);
    expect(await Event.countDocuments({ uid: user!._id })).toBe(0);

    // Credentials no longer work.
    expect((await request(app).post('/api/auth/login').send({ email: 'gone@example.com', password: 'supersecret' })).status).toBe(401);
  });

  it('rejects a wrong or missing password and a missing confirm phrase', async () => {
    const { body } = await signup('stays@example.com');
    const auth = { Authorization: `Bearer ${body.data.token}` };

    expect((await request(app).delete('/api/auth/me').set(auth).send({ confirm: 'DELETE', password: 'wrong-pass' })).status).toBe(401);
    expect((await request(app).delete('/api/auth/me').set(auth).send({ confirm: 'DELETE' })).status).toBe(400);
    expect((await request(app).delete('/api/auth/me').set(auth).send({ password: 'supersecret' })).status).toBe(400);

    expect(await User.findOne({ email: 'stays@example.com' })).not.toBeNull();
  });

  it('lets a Google-only account delete without a password', async () => {
    const { authHeader, email } = await createUserWithToken('google-gone@example.com');

    const res = await request(app)
      .delete('/api/auth/me')
      .set('Authorization', authHeader)
      .send({ confirm: 'DELETE' });
    expect(res.status).toBe(200);

    expect(await User.findOne({ email })).toBeNull();
  });

  it('requires auth', async () => {
    expect((await request(app).delete('/api/auth/me').send({ confirm: 'DELETE' })).status).toBe(401);
  });
});
