import { describe, it, expect } from 'vitest';
import { getTimeOfDay, getSeason, buildStyleContext } from '../styleContext.js';

describe('getTimeOfDay', () => {
  it('maps hours to the right part of day', () => {
    expect(getTimeOfDay(6)).toBe('morning');
    expect(getTimeOfDay(11)).toBe('morning');
    expect(getTimeOfDay(12)).toBe('afternoon');
    expect(getTimeOfDay(16)).toBe('afternoon');
    expect(getTimeOfDay(17)).toBe('evening');
    expect(getTimeOfDay(20)).toBe('evening');
    expect(getTimeOfDay(21)).toBe('night');
    expect(getTimeOfDay(3)).toBe('night');
    expect(getTimeOfDay(0)).toBe('night');
  });
});

describe('getSeason', () => {
  it('uses northern hemisphere seasons by default', () => {
    expect(getSeason(0)).toBe('winter'); // January
    expect(getSeason(3)).toBe('spring'); // April
    expect(getSeason(6)).toBe('summer'); // July
    expect(getSeason(9)).toBe('autumn'); // October
  });

  it('flips seasons for the southern hemisphere', () => {
    expect(getSeason(0, -33.9)).toBe('summer'); // January in Sydney
    expect(getSeason(6, -33.9)).toBe('winter'); // July in Sydney
  });

  it('treats the equator/northern latitudes as northern', () => {
    expect(getSeason(6, 0)).toBe('summer');
    expect(getSeason(6, 51.5)).toBe('summer'); // July in London
  });
});

describe('buildStyleContext', () => {
  it('derives season from the provided local date month', () => {
    const ctx = buildStyleContext(9, '2026-07-15', 51.5);
    expect(ctx.timeOfDay).toBe('morning');
    expect(ctx.season).toBe('summer');
  });

  it('honors hemisphere via latitude', () => {
    const ctx = buildStyleContext(19, '2026-07-15', -33.9);
    expect(ctx.timeOfDay).toBe('evening');
    expect(ctx.season).toBe('winter');
  });

  it('falls back to the current date when no local date is given', () => {
    const ctx = buildStyleContext(14, undefined, 40);
    expect(ctx.timeOfDay).toBe('afternoon');
    expect(typeof ctx.season).toBe('string');
  });
});
