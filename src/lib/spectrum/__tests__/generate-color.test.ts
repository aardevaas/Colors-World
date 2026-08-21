import { describe, expect, test } from 'vitest';
import {
  SPECTRUM_STEPS,
  TOTAL_SPECTRUM_SIZE,
  composeIndex,
  decomposeIndex,
  indexToOklch,
  indexToSwatch,
} from '../generate-color';

describe('TOTAL_SPECTRUM_SIZE', () => {
  test('is exactly 256³ — the full 8-bit-per-channel color space', () => {
    expect(TOTAL_SPECTRUM_SIZE).toBe(16_777_216);
    expect(TOTAL_SPECTRUM_SIZE).toBe(SPECTRUM_STEPS ** 3);
  });
});

describe('decomposeIndex / composeIndex', () => {
  test('round-trip for the first index', () => {
    const coords = decomposeIndex(0);
    expect(coords).toEqual({ lightnessStep: 0, hueStep: 0, chromaStep: 0 });
    expect(composeIndex(coords)).toBe(0);
  });

  test('round-trip for the last index', () => {
    const last = TOTAL_SPECTRUM_SIZE - 1;
    const coords = decomposeIndex(last);
    expect(coords).toEqual({ lightnessStep: 255, hueStep: 255, chromaStep: 255 });
    expect(composeIndex(coords)).toBe(last);
  });

  test('chroma is the fastest-changing (innermost) axis', () => {
    expect(decomposeIndex(0)).toEqual({ lightnessStep: 0, hueStep: 0, chromaStep: 0 });
    expect(decomposeIndex(1)).toEqual({ lightnessStep: 0, hueStep: 0, chromaStep: 1 });
  });

  test('hue is the middle axis — advances only once chroma wraps', () => {
    expect(decomposeIndex(SPECTRUM_STEPS - 1)).toEqual({
      lightnessStep: 0,
      hueStep: 0,
      chromaStep: 255,
    });
    expect(decomposeIndex(SPECTRUM_STEPS)).toEqual({
      lightnessStep: 0,
      hueStep: 1,
      chromaStep: 0,
    });
  });

  test('lightness is the outer axis — advances only once hue wraps', () => {
    const lastOfFirstLightnessBand = SPECTRUM_STEPS * SPECTRUM_STEPS - 1;
    expect(decomposeIndex(lastOfFirstLightnessBand)).toEqual({
      lightnessStep: 0,
      hueStep: 255,
      chromaStep: 255,
    });
    expect(decomposeIndex(lastOfFirstLightnessBand + 1)).toEqual({
      lightnessStep: 1,
      hueStep: 0,
      chromaStep: 0,
    });
  });

  test('round-trips for arbitrary coordinates', () => {
    const coords = { lightnessStep: 200, hueStep: 47, chromaStep: 133 };
    expect(decomposeIndex(composeIndex(coords))).toEqual(coords);
  });
});

describe('indexToOklch', () => {
  test('index 0 is the lightest, reddest, most muted corner', () => {
    const oklch = indexToOklch(0);
    expect(oklch.l).toBeCloseTo(0.97, 2);
    expect(oklch.h).toBe(0);
    expect(oklch.c).toBeCloseTo(0, 5);
  });

  test('the last index is the darkest corner', () => {
    const oklch = indexToOklch(TOTAL_SPECTRUM_SIZE - 1);
    expect(oklch.l).toBeCloseTo(0.03, 2);
  });

  test('lightness decreases monotonically as lightnessStep increases', () => {
    const first = indexToOklch(composeIndex({ lightnessStep: 0, hueStep: 0, chromaStep: 0 }));
    const middle = indexToOklch(composeIndex({ lightnessStep: 128, hueStep: 0, chromaStep: 0 }));
    const last = indexToOklch(composeIndex({ lightnessStep: 255, hueStep: 0, chromaStep: 0 }));
    expect(first.l).toBeGreaterThan(middle.l);
    expect(middle.l).toBeGreaterThan(last.l);
  });

  test('hue sweeps the full 0-360° range across the hue axis', () => {
    const start = indexToOklch(composeIndex({ lightnessStep: 100, hueStep: 0, chromaStep: 0 }));
    const quarter = indexToOklch(composeIndex({ lightnessStep: 100, hueStep: 64, chromaStep: 0 }));
    const half = indexToOklch(composeIndex({ lightnessStep: 100, hueStep: 128, chromaStep: 0 }));
    expect(start.h).toBe(0);
    expect(quarter.h).toBeCloseTo(90, 0);
    expect(half.h).toBeCloseTo(180, 0);
  });

  test('chroma increases with chromaStep and never exceeds what the hue/lightness can display', () => {
    const muted = indexToOklch(composeIndex({ lightnessStep: 100, hueStep: 50, chromaStep: 0 }));
    const vivid = indexToOklch(composeIndex({ lightnessStep: 100, hueStep: 50, chromaStep: 255 }));
    expect(vivid.c).toBeGreaterThan(muted.c);
    expect(muted.c).toBeCloseTo(0, 5);
  });

  test('every generated coordinate produces a finite, non-negative chroma', () => {
    const samples = [0, 1, 12345, TOTAL_SPECTRUM_SIZE / 2, TOTAL_SPECTRUM_SIZE - 1];
    for (const index of samples) {
      const oklch = indexToOklch(Math.floor(index));
      expect(Number.isFinite(oklch.c)).toBe(true);
      expect(oklch.c).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('indexToSwatch', () => {
  test('returns the index, a valid hex string, and the underlying oklch', () => {
    const swatch = indexToSwatch(42);
    expect(swatch.index).toBe(42);
    expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(swatch.oklch.l).toBeGreaterThan(0);
  });

  test('is deterministic — same index always yields the same swatch', () => {
    expect(indexToSwatch(999_999)).toEqual(indexToSwatch(999_999));
  });
});
