import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();
vi.mock('../../config/ai', () => ({
  getAI: () => ({ models: { generateContent } }),
}));

import { generateOutfitImage, parseImageDataUrl } from '../geminiService.js';

const PHOTO_B64 = '/9j/4AAQSkZJRgABAQ==';
const PHOTO = `data:image/jpeg;base64,${PHOTO_B64}`;

const suggestion = {
  occasion: 'Brunch',
  top: { name: 'White Tee', reason: '' },
  bottom: { name: 'Black Jeans', reason: '' },
  shoes: { name: 'Sneakers', reason: '' },
  accessory: { name: 'Cap', reason: '' },
  stylistNote: '',
};

const imageReply = (data = 'OUT') => ({
  candidates: [{ content: { parts: [{ inlineData: { data, mimeType: 'image/png' } }] } }],
});

beforeEach(() => generateContent.mockReset());

describe('parseImageDataUrl', () => {
  it('splits a valid data URL and rejects anything else', () => {
    expect(parseImageDataUrl(PHOTO)).toEqual({ mimeType: 'image/jpeg', base64: PHOTO_B64 });
    expect(parseImageDataUrl('https://example.com/a.jpg')).toBeNull();
    expect(parseImageDataUrl(undefined)).toBeNull();
  });
});

describe('generateOutfitImage', () => {
  it('sends real item photos as reference images and labels the result', async () => {
    generateContent.mockResolvedValue(imageReply());

    const result = await generateOutfitImage(suggestion, { top: { color: 'White', image: PHOTO } });

    expect(result).toEqual({ imageBase64: 'OUT', mimeType: 'image/png', source: 'reference' });
    const contents = generateContent.mock.calls[0][0].contents as any[];
    const inline = contents.filter((part) => part.inlineData);
    expect(inline).toHaveLength(1);
    expect(inline[0].inlineData).toEqual({ data: PHOTO_B64, mimeType: 'image/jpeg' });
  });

  it('falls back to text-only generation, labelled as such, when the reference call fails', async () => {
    generateContent.mockRejectedValueOnce(new Error('quota')).mockResolvedValueOnce(imageReply('TXT'));

    const result = await generateOutfitImage(suggestion, { top: { image: PHOTO } });

    expect(result.source).toBe('text');
    expect(result.imageBase64).toBe('TXT');
    expect(typeof generateContent.mock.calls[1][0].contents).toBe('string');
  });

  it('uses text-only generation when no item has a photo', async () => {
    generateContent.mockResolvedValue(imageReply());

    const result = await generateOutfitImage(suggestion, { top: { color: 'White' } });

    expect(result.source).toBe('text');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
