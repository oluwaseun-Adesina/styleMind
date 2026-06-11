import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { startTestDb, stopTestDb, clearDb, createUserWithToken } from '../../test/db.js';

beforeAll(startTestDb);
afterAll(stopTestDb);
afterEach(clearDb);

const item = { name: 'White Linen Shirt', color: 'White', type: 'top', formality: 'smart casual' };

describe('wardrobe routes', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/wardrobes')).status).toBe(401);
    expect((await request(app).post('/api/wardrobes').send(item)).status).toBe(401);
  });

  it('adds and lists items for the owner only', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const bob = await createUserWithToken('bob@example.com');

    const add = await request(app).post('/api/wardrobes').set('Authorization', alice.authHeader).send(item);
    expect(add.status).toBe(201);

    const aliceList = await request(app).get('/api/wardrobes').set('Authorization', alice.authHeader);
    expect(aliceList.status).toBe(200);
    expect(aliceList.body.data).toHaveLength(1);

    const bobList = await request(app).get('/api/wardrobes').set('Authorization', bob.authHeader);
    expect(bobList.body.data).toHaveLength(0);
  });

  it('stores and returns an optional description', async () => {
    const alice = await createUserWithToken('alice@example.com');

    const add = await request(app)
      .post('/api/wardrobes')
      .set('Authorization', alice.authHeader)
      .send({ ...item, description: 'crisp lightweight linen weave, relaxed fit, mother-of-pearl buttons' });
    expect(add.status).toBe(201);
    expect(add.body.data.description).toBe('crisp lightweight linen weave, relaxed fit, mother-of-pearl buttons');

    const list = await request(app).get('/api/wardrobes').set('Authorization', alice.authHeader);
    expect(list.body.data[0].description).toBe('crisp lightweight linen weave, relaxed fit, mother-of-pearl buttons');

    // Items without a description stay valid and omit the field.
    const plain = await request(app).post('/api/wardrobes').set('Authorization', alice.authHeader).send(item);
    expect(plain.status).toBe(201);
    expect(plain.body.data.description).toBeUndefined();
  });

  it('rejects an invalid item body', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const res = await request(app)
      .post('/api/wardrobes')
      .set('Authorization', alice.authHeader)
      .send({ name: 'Tee', color: 'White', type: 'hat', formality: 'casual' });
    expect(res.status).toBe(400);
  });

  it('lets an owner update their item but not another user’s (IDOR)', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const bob = await createUserWithToken('bob@example.com');

    const add = await request(app).post('/api/wardrobes').set('Authorization', alice.authHeader).send(item);
    const id = add.body.data.id;
    const update = { ...item, name: 'Blue Linen Shirt', color: 'Blue', description: 'lightweight linen, relaxed fit' };

    // Bob cannot update Alice's item
    const bobUpdate = await request(app).put(`/api/wardrobes/${id}`).set('Authorization', bob.authHeader).send(update);
    expect(bobUpdate.status).toBe(404);

    // Alice can
    const aliceUpdate = await request(app).put(`/api/wardrobes/${id}`).set('Authorization', alice.authHeader).send(update);
    expect(aliceUpdate.status).toBe(200);
    expect(aliceUpdate.body.data.name).toBe('Blue Linen Shirt');
    expect(aliceUpdate.body.data.description).toBe('lightweight linen, relaxed fit');

    // Saving without a description clears it.
    const cleared = await request(app).put(`/api/wardrobes/${id}`).set('Authorization', alice.authHeader).send(item);
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.description).toBeUndefined();
  });

  it('lets an owner delete their item but not another user’s (IDOR)', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const bob = await createUserWithToken('bob@example.com');

    const add = await request(app).post('/api/wardrobes').set('Authorization', alice.authHeader).send(item);
    const id = add.body.data.id;

    // Bob cannot delete Alice's item
    const bobDelete = await request(app).delete(`/api/wardrobes/${id}`).set('Authorization', bob.authHeader);
    expect(bobDelete.status).toBe(404);

    // Alice can
    const aliceDelete = await request(app).delete(`/api/wardrobes/${id}`).set('Authorization', alice.authHeader);
    expect(aliceDelete.status).toBe(200);
  });
});
