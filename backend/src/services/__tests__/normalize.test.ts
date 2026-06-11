import { describe, it, expect } from 'vitest';
import {
  normalizeItemType,
  normalizeFormality,
  normalizeBase64ImageData,
  normalizeAnalyzedItems,
} from '../geminiService.js';

describe('normalizeItemType', () => {
  it('lowercases and accepts valid types', () => {
    expect(normalizeItemType('TOP')).toBe('top');
    expect(normalizeItemType(' Shoes ')).toBe('shoes');
  });

  it('falls back to accessory for unknown values', () => {
    expect(normalizeItemType('hat')).toBe('accessory');
    expect(normalizeItemType(undefined)).toBe('accessory');
  });
});

describe('normalizeFormality', () => {
  it('accepts valid formalities case-insensitively', () => {
    expect(normalizeFormality('Formal')).toBe('formal');
    expect(normalizeFormality('SMART CASUAL')).toBe('smart casual');
  });

  it('falls back to casual for unknown values', () => {
    expect(normalizeFormality('black tie')).toBe('casual');
  });
});

describe('normalizeBase64ImageData', () => {
  it('strips a data-URI prefix and whitespace', () => {
    expect(normalizeBase64ImageData('data:image/png;base64,AAAA BBBB')).toBe('AAAABBBB');
  });

  it('leaves raw base64 untouched (aside from whitespace)', () => {
    expect(normalizeBase64ImageData('AAAA\nBBBB')).toBe('AAAABBBB');
  });
});

describe('normalizeAnalyzedItems', () => {
  it('keeps valid items and normalizes their fields', () => {
    const result = normalizeAnalyzedItems({
      items: [
        { name: '  Blue Jeans ', color: ' Blue ', type: 'BOTTOM', formality: 'Casual', notes: ' x ' },
      ],
    });
    expect(result.items).toEqual([
      { name: 'Blue Jeans', color: 'Blue', type: 'bottom', formality: 'casual', notes: 'x' },
    ]);
  });

  it('drops items missing a name or color', () => {
    const result = normalizeAnalyzedItems({
      items: [
        { name: '', color: 'Red', type: 'top', formality: 'casual', notes: '' },
        { name: 'Hat', color: '', type: 'accessory', formality: 'casual', notes: '' },
        { name: 'Tee', color: 'White', type: 'top', formality: 'casual', notes: '' },
      ],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Tee');
  });

  it('returns an empty array for malformed payloads', () => {
    expect(normalizeAnalyzedItems(null).items).toEqual([]);
    expect(normalizeAnalyzedItems({}).items).toEqual([]);
    expect(normalizeAnalyzedItems({ items: 'nope' }).items).toEqual([]);
  });
});
