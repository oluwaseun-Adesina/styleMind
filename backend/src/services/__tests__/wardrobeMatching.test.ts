import { describe, it, expect } from 'vitest';
import {
  findMatchingWardrobeItem,
  hasWardrobeItem,
  suggestionUsesWardrobe,
} from '../aiService.js';

const wardrobe = [
  { id: '1', name: 'White Linen Shirt', type: 'top' },
  { id: '2', name: 'Navy Chinos', type: 'bottom' },
  { id: '3', name: 'Brown Leather Loafers', type: 'shoes' },
  { id: '4', name: 'Silver Watch', type: 'accessory' },
];

describe('findMatchingWardrobeItem', () => {
  it('returns an exact (case-insensitive) match', () => {
    expect(findMatchingWardrobeItem(wardrobe, 'top', 'white linen shirt')).toBe('White Linen Shirt');
  });

  it('matches on substring overlap', () => {
    expect(findMatchingWardrobeItem(wardrobe, 'bottom', 'Chinos')).toBe('Navy Chinos');
  });

  it('matches on token overlap when no substring match', () => {
    expect(findMatchingWardrobeItem(wardrobe, 'shoes', 'Leather Boots')).toBe('Brown Leather Loafers');
  });

  it('falls back to the first item of that type when nothing matches', () => {
    expect(findMatchingWardrobeItem(wardrobe, 'top', 'Polka Dot Raincoat')).toBe('White Linen Shirt');
  });

  it('returns the suggested name unchanged when the user owns no item of that type', () => {
    const tops = wardrobe.filter((i) => i.type === 'top');
    expect(findMatchingWardrobeItem(tops, 'accessory', 'Gold Necklace')).toBe('Gold Necklace');
  });
});

describe('hasWardrobeItem', () => {
  it('is true when the suggested item exists in the wardrobe', () => {
    expect(hasWardrobeItem(wardrobe, { name: 'Navy Chinos' }, 'bottom')).toBe(true);
  });

  it('treats a missing category as a gap (true) rather than a violation', () => {
    const noAccessories = wardrobe.filter((i) => i.type !== 'accessory');
    expect(hasWardrobeItem(noAccessories, { name: 'Some Belt' }, 'accessory')).toBe(true);
  });

  it('is false when an item of an owned category is not in the wardrobe', () => {
    expect(hasWardrobeItem(wardrobe, { name: 'Red Cocktail Dress' }, 'top')).toBe(false);
  });

  it('is false when the suggested item has no name', () => {
    expect(hasWardrobeItem(wardrobe, undefined, 'top')).toBe(false);
  });
});

describe('suggestionUsesWardrobe', () => {
  const validSuggestion = {
    occasion: 'Brunch',
    top: { name: 'White Linen Shirt', reason: '' },
    bottom: { name: 'Navy Chinos', reason: '' },
    shoes: { name: 'Brown Leather Loafers', reason: '' },
    accessory: { name: 'Silver Watch', reason: '' },
    stylistNote: '',
  };

  it('accepts a suggestion built entirely from the wardrobe', () => {
    expect(suggestionUsesWardrobe(wardrobe, validSuggestion)).toBe(true);
  });

  it('rejects a suggestion that invents an item outside the wardrobe', () => {
    const hallucinated = { ...validSuggestion, top: { name: 'Designer Hoodie', reason: '' } };
    expect(suggestionUsesWardrobe(wardrobe, hallucinated)).toBe(false);
  });
});
