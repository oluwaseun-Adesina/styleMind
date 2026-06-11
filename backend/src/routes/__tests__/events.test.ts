import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { startTestDb, stopTestDb, clearDb, createUserWithToken } from '../../test/db.js';

beforeAll(startTestDb);
afterAll(stopTestDb);
afterEach(clearDb);

const event = { title: 'Dinner date', date: '2026-07-15', time: '19:30' };

describe('event routes', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/events')).status).toBe(401);
  });

  it('creates and lists events for the owner only, soonest first', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const bob = await createUserWithToken('bob@example.com');

    await request(app).post('/api/events').set('Authorization', alice.authHeader).send({ title: 'Later', date: '2026-08-01' });
    await request(app).post('/api/events').set('Authorization', alice.authHeader).send(event);

    const list = await request(app).get('/api/events').set('Authorization', alice.authHeader);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[0].date).toBe('2026-07-15'); // sorted ascending

    const bobList = await request(app).get('/api/events').set('Authorization', bob.authHeader);
    expect(bobList.body.data).toHaveLength(0);
  });

  it('filters by `from` date', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await request(app).post('/api/events').set('Authorization', alice.authHeader).send({ title: 'Past', date: '2020-01-01' });
    await request(app).post('/api/events').set('Authorization', alice.authHeader).send(event);

    const list = await request(app).get('/api/events?from=2026-01-01').set('Authorization', alice.authHeader);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].title).toBe('Dinner date');
  });

  it('rejects a malformed date', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const res = await request(app).post('/api/events').set('Authorization', alice.authHeader).send({ title: 'Bad', date: '15-07-2026' });
    expect(res.status).toBe(400);
  });

  it('does not let a user delete another user’s event (IDOR)', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const bob = await createUserWithToken('bob@example.com');
    const created = await request(app).post('/api/events').set('Authorization', alice.authHeader).send(event);
    const id = created.body.data.id;

    expect((await request(app).delete(`/api/events/${id}`).set('Authorization', bob.authHeader)).status).toBe(404);
    expect((await request(app).delete(`/api/events/${id}`).set('Authorization', alice.authHeader)).status).toBe(200);
  });
});
