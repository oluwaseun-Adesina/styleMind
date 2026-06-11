import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { startTestDb, stopTestDb, clearDb, createUserWithToken } from '../../test/db.js';

beforeAll(startTestDb);
afterAll(stopTestDb);
afterEach(clearDb);

const outfit = {
  occasion: 'Brunch',
  top: { name: 'White Linen Shirt', reason: 'breathable' },
  bottom: { name: 'Navy Chinos', reason: 'smart' },
  shoes: { name: 'Loafers', reason: 'classic' },
  accessory: { name: 'Watch', reason: 'finishing touch' },
  stylistNote: 'Effortless.',
};

const saveOutfit = (authHeader: string) =>
  request(app).post('/api/saved_outfits').set('Authorization', authHeader).send(outfit);

describe('lookbook routes', () => {
  it('saves an outfit and lists it with a zero wear count', async () => {
    const alice = await createUserWithToken('alice@example.com');
    expect((await saveOutfit(alice.authHeader)).status).toBe(201);

    const list = await request(app).get('/api/saved_outfits').set('Authorization', alice.authHeader);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].wornCount).toBe(0);
    expect(list.body.data[0].lastWornAt).toBeNull();
  });

  it('strips transient context off the saved record', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await request(app)
      .post('/api/saved_outfits')
      .set('Authorization', alice.authHeader)
      .send({ ...outfit, context: { weather: { temp: 20, description: 'clear', city: 'X' } } });

    const list = await request(app).get('/api/saved_outfits').set('Authorization', alice.authHeader);
    expect(list.status).toBe(200);
    expect(list.body.data[0].context).toBeUndefined();
  });

  it('marks an outfit as worn, incrementing the count and stamping lastWornAt', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const saved = await saveOutfit(alice.authHeader);
    const id = saved.body.data.id;

    const worn = await request(app).post(`/api/saved_outfits/${id}/worn`).set('Authorization', alice.authHeader);
    expect(worn.status).toBe(200);
    expect(worn.body.data.wornCount).toBe(1);
    expect(worn.body.data.lastWornAt).toBeTruthy();

    const again = await request(app).post(`/api/saved_outfits/${id}/worn`).set('Authorization', alice.authHeader);
    expect(again.body.data.wornCount).toBe(2);
  });

  it('does not let a user mark or delete another user’s outfit (IDOR)', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const bob = await createUserWithToken('bob@example.com');
    const saved = await saveOutfit(alice.authHeader);
    const id = saved.body.data.id;

    expect((await request(app).post(`/api/saved_outfits/${id}/worn`).set('Authorization', bob.authHeader)).status).toBe(404);
    expect((await request(app).delete(`/api/saved_outfits/${id}`).set('Authorization', bob.authHeader)).status).toBe(404);
    expect((await request(app).delete(`/api/saved_outfits/${id}`).set('Authorization', alice.authHeader)).status).toBe(200);
  });
});
