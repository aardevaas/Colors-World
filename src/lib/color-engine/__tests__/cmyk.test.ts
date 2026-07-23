import { describe, expect, test } from 'vitest';
import { formatCmyk, toCmyk } from '../cmyk';
import { parseColor } from '../color';

describe('toCmyk', () => {
  test('white is 0/0/0/0', () => {
    const cmyk = toCmyk(parseColor('#ffffff'));
    expect(cmyk).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  test('black is all key, no ink', () => {
    const cmyk = toCmyk(parseColor('#000000'));
    expect(cmyk).toEqual({ c: 0, m: 0, y: 0, k: 100 });
  });

  test('pure red has no cyan and no key', () => {
    const cmyk = toCmyk(parseColor('#ff0000'));
    expect(cmyk.c).toBe(0);
    expect(cmyk.k).toBe(0);
    expect(cmyk.m).toBeGreaterThan(0);
    expect(cmyk.y).toBeGreaterThan(0);
  });

  test('every channel stays within 0–100 for an out-of-gamut OKLCH input', () => {
    // Chroma 0.4 at this lightness/hue is unreachable in sRGB — toCmyk must
    // gamut-map before converting rather than producing negative/>100 channels.
    const cmyk = toCmyk({ l: 0.7, c: 0.4, h: 250 });
    for (const channel of [cmyk.c, cmyk.m, cmyk.y, cmyk.k]) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(100);
    }
  });
});

describe('formatCmyk', () => {
  test('renders the compact print-shop notation', () => {
    expect(formatCmyk({ c: 76, m: 47, y: 0, k: 4 })).toBe('C:76 M:47 Y:0 K:4');
  });
});
