import { describe, it, expect } from 'vitest';
import {
  outfitSuggestionSchema,
  refreshSchema,
  signupSchema,
  wardrobeItemSchema,
} from '../schemas.js';

describe('outfitSuggestionSchema', () => {
  it('requires a prompt when not in auto mode', () => {
    const result = outfitSuggestionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('allows an empty prompt in auto mode and defaults variety to false', () => {
    const result = outfitSuggestionSchema.safeParse({ auto: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.variety).toBe(false);
      expect(result.data.auto).toBe(true);
    }
  });

  it('accepts a manual prompt without auto', () => {
    const result = outfitSuggestionSchema.safeParse({ prompt: 'job interview' });
    expect(result.success).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    expect(outfitSuggestionSchema.safeParse({ auto: true, lat: 200 }).success).toBe(false);
    expect(outfitSuggestionSchema.safeParse({ auto: true, lon: -999 }).success).toBe(false);
  });

  it('validates localHour and localDate shape', () => {
    expect(outfitSuggestionSchema.safeParse({ auto: true, localHour: 25 }).success).toBe(false);
    expect(outfitSuggestionSchema.safeParse({ auto: true, localDate: '07-15-2026' }).success).toBe(false);
    expect(outfitSuggestionSchema.safeParse({ auto: true, localHour: 9, localDate: '2026-07-15' }).success).toBe(true);
  });
});

describe('refreshSchema', () => {
  it('requires a refresh token', () => {
    expect(refreshSchema.safeParse({}).success).toBe(false);
    expect(refreshSchema.safeParse({ refreshToken: 'abc' }).success).toBe(true);
  });
});

describe('signupSchema', () => {
  it('enforces a minimum password length and valid email', () => {
    expect(signupSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
    expect(signupSchema.safeParse({ email: 'not-an-email', password: 'longenough' }).success).toBe(false);
    expect(signupSchema.safeParse({ email: 'a@b.com', password: 'longenough' }).success).toBe(true);
  });
});

describe('wardrobeItemSchema', () => {
  it('rejects invalid type/formality enums', () => {
    expect(
      wardrobeItemSchema.safeParse({ name: 'Tee', color: 'White', type: 'hat', formality: 'casual' }).success
    ).toBe(false);
  });

  it('accepts a well-formed item', () => {
    expect(
      wardrobeItemSchema.safeParse({ name: 'Tee', color: 'White', type: 'top', formality: 'casual' }).success
    ).toBe(true);
  });
});
