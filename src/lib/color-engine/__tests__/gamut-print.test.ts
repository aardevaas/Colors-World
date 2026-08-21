import { describe, expect, test } from 'vitest';
import { isInGamut, mapToGamut, maxChroma } from '../gamut';

describe("the 'print' pseudo-gamut", () => {
  test('holds strictly less chroma than sRGB for a saturated blue', () => {
    // Blue is one of the hues ink reproduces worst — this is the whole point
    // of the print warning existing at all.
    expect(maxChroma(0.55, 260, 'print')).toBeLessThan(maxChroma(0.55, 260, 'srgb'));
  });

  test('holds nearly as much chroma as sRGB for yellow', () => {
    const srgbMax = maxChroma(0.9, 60, 'srgb');
    const printMax = maxChroma(0.9, 60, 'print');
    expect(printMax).toBeLessThan(srgbMax);
    expect(printMax).toBeGreaterThan(srgbMax * 0.9);
  });

  test('is continuous across the 330°→0° wraparound', () => {
    const justBelow = maxChroma(0.6, 359.9, 'print');
    const atZero = maxChroma(0.6, 0, 'print');
    expect(Math.abs(justBelow - atZero)).toBeLessThan(0.01);
  });

  test('a color already inside the print boundary is not clamped', () => {
    const dull = { l: 0.6, c: 0.02, h: 260 };
    expect(isInGamut(dull, 'print')).toBe(true);
    expect(mapToGamut(dull, 'print').clamped).toBe(false);
  });

  test('a vivid color outside the print boundary clamps, preserving lightness and hue', () => {
    const vivid = { l: 0.6, c: 0.3, h: 260 };
    expect(isInGamut(vivid, 'print')).toBe(false);

    const { oklch, clamped } = mapToGamut(vivid, 'print');
    expect(clamped).toBe(true);
    expect(oklch.l).toBe(vivid.l);
    expect(oklch.h).toBe(vivid.h);
    expect(oklch.c).toBeLessThan(vivid.c);
  });
});
