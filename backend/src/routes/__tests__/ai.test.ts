import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../services/geminiService.js', () => ({
  generateOutfitSuggestion: vi.fn(),
  analyzeItemImage: vi.fn(),
  generateOutfitImage: vi.fn(),
}));
vi.mock('../../services/weatherService.js', () => ({
  getWeather: vi.fn(async () => ({ temp: 18, description: 'light rain', city: 'Testville' })),
}));

import app from '../../app.js';
import { startTestDb, stopTestDb, clearDb, createUserWithToken } from '../../test/db.js';
import { Wardrobe } from '../../models/Wardrobe.js';
import { Event } from '../../models/Event.js';
import { generateOutfitSuggestion, analyzeItemImage, generateOutfitImage } from '../../services/geminiService.js';

const mockGenerate = vi.mocked(generateOutfitSuggestion);
const mockAnalyze = vi.mocked(analyzeItemImage);
const mockImage = vi.mocked(generateOutfitImage);
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8=';

beforeAll(startTestDb);
afterAll(stopTestDb);
afterEach(async () => {
  vi.clearAllMocks();
  await clearDb();
});

const seedWardrobe = async (uid: string) => {
  await Wardrobe.create([
    { uid, name: 'White Tee', color: 'White', type: 'top', formality: 'casual' },
    { uid, name: 'Black Jeans', color: 'Black', type: 'bottom', formality: 'casual' },
    { uid, name: 'Sneakers', color: 'White', type: 'shoes', formality: 'casual' },
    { uid, name: 'Cap', color: 'Navy', type: 'accessory', formality: 'casual' },
  ]);
};

const aiReply = (overrides: Partial<Record<string, any>> = {}) => ({
  occasion: 'Casual day',
  top: { name: 'White Tee', reason: 'breathable' },
  bottom: { name: 'Black Jeans', reason: 'versatile' },
  shoes: { name: 'Sneakers', reason: 'comfy' },
  accessory: { name: 'Cap', reason: 'sun' },
  stylistNote: 'Keep it easy.',
  ...overrides,
});

describe('POST /api/outfit-suggestion', () => {
  it('requires a prompt when not in auto mode', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await seedWardrobe(alice.userId);
    const res = await request(app).post('/api/outfit-suggestion').set('Authorization', alice.authHeader).send({});
    expect(res.status).toBe(400);
  });

  it('returns a 400 when the wardrobe is empty', async () => {
    const alice = await createUserWithToken('alice@example.com');
    mockGenerate.mockResolvedValue(aiReply());
    const res = await request(app)
      .post('/api/outfit-suggestion')
      .set('Authorization', alice.authHeader)
      .send({ auto: true });
    expect(res.status).toBe(400);
  });

  it('returns an auto pick with weather + time-of-day + season context', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await seedWardrobe(alice.userId);
    mockGenerate.mockResolvedValue(aiReply());

    const res = await request(app)
      .post('/api/outfit-suggestion')
      .set('Authorization', alice.authHeader)
      .send({ auto: true, lat: 51.5, lon: -0.12, localHour: 9, localDate: '2026-07-15' });

    expect(res.status).toBe(200);
    expect(res.body.data.occasion).toBe('Casual day');
    expect(res.body.data.context.weather).toEqual({ temp: 18, description: 'light rain', city: 'Testville' });
    expect(res.body.data.context.timeOfDay).toBe('morning');
    expect(res.body.data.context.season).toBe('summer');
  });

  it('passes the variety flag through to the generator', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await seedWardrobe(alice.userId);
    mockGenerate.mockResolvedValue(aiReply());

    await request(app)
      .post('/api/outfit-suggestion')
      .set('Authorization', alice.authHeader)
      .send({ auto: true, variety: true });

    const options = mockGenerate.mock.calls[0][5] as { variety?: boolean } | undefined;
    expect(options?.variety).toBe(true);
  });

  it('constrains the output to the wardrobe even if the model hallucinates an item', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await seedWardrobe(alice.userId);
    // Model returns a top the user does not own.
    mockGenerate.mockResolvedValue(aiReply({ top: { name: 'Imaginary Gucci Jacket', reason: 'flashy' } }));

    const res = await request(app)
      .post('/api/outfit-suggestion')
      .set('Authorization', alice.authHeader)
      .send({ auto: true });

    expect(res.status).toBe(200);
    // Remapped to a real wardrobe top, never the hallucinated name.
    expect(res.body.data.top.name).toBe('White Tee');
  });

  it('returns an options array when count > 1', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await seedWardrobe(alice.userId);
    mockGenerate.mockResolvedValue(aiReply());

    const res = await request(app)
      .post('/api/outfit-suggestion')
      .set('Authorization', alice.authHeader)
      .send({ auto: true, count: 3 });

    expect(res.status).toBe(200);
    expect(res.body.data.options).toHaveLength(3);
    expect(mockGenerate).toHaveBeenCalledTimes(3);
    // The top-level object mirrors the first option.
    expect(res.body.data.occasion).toBe(res.body.data.options[0].occasion);
  });

  it('omits the options array for a single look', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await seedWardrobe(alice.userId);
    mockGenerate.mockResolvedValue(aiReply());

    const res = await request(app)
      .post('/api/outfit-suggestion')
      .set('Authorization', alice.authHeader)
      .send({ auto: true });

    expect(res.body.data.options).toBeUndefined();
  });

  it('uses an event scheduled for today as the occasion in auto mode', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await seedWardrobe(alice.userId);
    await Event.create({ uid: alice.userId, title: 'Wedding reception', date: '2026-07-15', time: '17:00' });
    mockGenerate.mockResolvedValue(aiReply({ occasion: 'Wedding reception' }));

    await request(app)
      .post('/api/outfit-suggestion')
      .set('Authorization', alice.authHeader)
      .send({ auto: true, localHour: 9, localDate: '2026-07-15' });

    const promptArg = mockGenerate.mock.calls[0][0] as string;
    expect(promptArg).toContain('Wedding reception');
    expect(promptArg).toContain('17:00');
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/outfit-suggestion').send({ auto: true });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/analyze-items', () => {
  const photo = { imageBase64: 'A'.repeat(200), mimeType: 'image/jpeg' };
  const analysed = (name: string) => ({
    items: [{ name, color: 'Blue', type: 'top' as const, formality: 'casual' as const, notes: '' }],
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/analyze-items').send({ images: [photo] });
    expect(res.status).toBe(401);
  });

  it('returns one result per photo, in order, isolating failures', async () => {
    const alice = await createUserWithToken('alice@example.com');
    mockAnalyze
      .mockResolvedValueOnce(analysed('Blue Tee'))
      .mockRejectedValueOnce(new Error('No clothing item was detected.'))
      .mockResolvedValueOnce(analysed('Denim Shirt'));

    const res = await request(app)
      .post('/api/analyze-items')
      .set('Authorization', alice.authHeader)
      .send({ images: [photo, photo, photo] });

    expect(res.status).toBe(200);
    const { results } = res.body.data;
    expect(results).toHaveLength(3);
    expect(results.map((r: any) => r.index)).toEqual([0, 1, 2]);
    expect(results[1].error).toMatch(/No clothing/);
    expect(results[1].items).toEqual([]);
    const names = [results[0], results[2]].map((r: any) => r.items[0].name).sort();
    expect(names).toEqual(['Blue Tee', 'Denim Shirt']);
  });

  it('rejects an empty batch and more than 10 photos', async () => {
    const alice = await createUserWithToken('alice@example.com');
    const empty = await request(app).post('/api/analyze-items').set('Authorization', alice.authHeader).send({ images: [] });
    expect(empty.status).toBe(400);
    const tooMany = await request(app)
      .post('/api/analyze-items')
      .set('Authorization', alice.authHeader)
      .send({ images: Array.from({ length: 11 }, () => photo) });
    expect(tooMany.status).toBe(400);
    expect(mockAnalyze).not.toHaveBeenCalled();
  });
});

describe('POST /api/outfit-image', () => {
  it('passes the real item photos to the image generator', async () => {
    const alice = await createUserWithToken('alice@example.com');
    await Wardrobe.create([
      { uid: alice.userId, name: 'White Tee', color: 'White', type: 'top', formality: 'casual', image: PHOTO },
      { uid: alice.userId, name: 'Black Jeans', color: 'Black', type: 'bottom', formality: 'casual' },
      { uid: alice.userId, name: 'Sneakers', color: 'White', type: 'shoes', formality: 'casual' },
      { uid: alice.userId, name: 'Cap', color: 'Navy', type: 'accessory', formality: 'casual' },
    ]);
    mockImage.mockResolvedValue({ imageBase64: 'abc', mimeType: 'image/png', source: 'reference' });

    const res = await request(app)
      .post('/api/outfit-image')
      .set('Authorization', alice.authHeader)
      .send({ suggestion: aiReply() });

    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('reference');
    const details = mockImage.mock.calls[0][1]!;
    expect(details.top?.image).toBe(PHOTO);
    expect(details.bottom?.image).toBeUndefined();
  });
});
