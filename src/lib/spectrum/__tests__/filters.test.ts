import { describe, expect, test } from 'vitest';
import {
  DEFAULT_FILTER_SELECTION,
  hasActiveFilters,
  matchesFilters,
  resolveSpectrumFilters,
} from '../filters';

describe('resolveSpectrumFilters', () => {
  test('the default selection resolves to no filters at all', () => {
    expect(resolveSpectrumFilters(DEFAULT_FILTER_SELECTION)).toEqual({});
  });

  test('a hue family resolves to its min/max hue bounds', () => {
    const result = resolveSpectrumFilters({ ...DEFAULT_FILTER_SELECTION, hueFamily: 'blues' });
    expect(result.minHue).toBe(210);
    expect(result.maxHue).toBe(260);
  });

  test('bands combine into one filter object', () => {
    const result = resolveSpectrumFilters({
      hueFamily: 'greens',
      lightnessBand: 'pastel',
      chromaBand: 'muted',
    });
    expect(result).toEqual({
      minHue: 100,
      maxHue: 160,
      minLightness: 0.85,
      maxChroma: 0.06,
    });
  });
});

describe('hasActiveFilters', () => {
  test('is false for the default selection', () => {
    expect(hasActiveFilters(DEFAULT_FILTER_SELECTION)).toBe(false);
  });

  test('is true when any single band is non-default', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTER_SELECTION, chromaBand: 'vivid' })).toBe(true);
  });
});

describe('matchesFilters', () => {
  test('an empty filter set matches everything', () => {
    expect(matchesFilters({ l: 0.5, c: 0.2, h: 180 }, {})).toBe(true);
  });

  test('rejects a colour outside the hue bounds', () => {
    const filters = { minHue: 210, maxHue: 260 };
    expect(matchesFilters({ l: 0.5, c: 0.1, h: 230 }, filters)).toBe(true);
    expect(matchesFilters({ l: 0.5, c: 0.1, h: 10 }, filters)).toBe(false);
  });

  test('rejects a colour outside the lightness bounds', () => {
    const filters = { minLightness: 0.85 };
    expect(matchesFilters({ l: 0.9, c: 0.05, h: 100 }, filters)).toBe(true);
    expect(matchesFilters({ l: 0.5, c: 0.05, h: 100 }, filters)).toBe(false);
  });

  test('rejects a colour outside the chroma bounds', () => {
    const filters = { maxChroma: 0.06 };
    expect(matchesFilters({ l: 0.5, c: 0.02, h: 100 }, filters)).toBe(true);
    expect(matchesFilters({ l: 0.5, c: 0.2, h: 100 }, filters)).toBe(false);
  });

  test('requires every active bound to pass at once', () => {
    const filters = { minHue: 100, maxHue: 160, minLightness: 0.85, maxChroma: 0.06 };
    expect(matchesFilters({ l: 0.9, c: 0.03, h: 130 }, filters)).toBe(true);
    expect(matchesFilters({ l: 0.5, c: 0.03, h: 130 }, filters)).toBe(false);
  });
});
