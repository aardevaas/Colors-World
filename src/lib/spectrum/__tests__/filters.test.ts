import { describe, expect, test } from 'vitest';
import {
  DEFAULT_FILTER_SELECTION,
  hasActiveFilters,
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
