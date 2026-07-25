import { describe, expect, test } from 'vitest';
import { formatHsl, toHsl } from '../color';
import { parseColor } from '../color';

describe('toHsl', () => {
  test('white is 0 saturation, 100 lightness', () => {
    const hsl = toHsl(parseColor('#ffffff'));
    expect(hsl.s).toBeCloseTo(0, 5);
    expect(hsl.l).toBeCloseTo(100, 5);
  });

  test('black is 0 saturation, 0 lightness', () => {
    const hsl = toHsl(parseColor('#000000'));
    expect(hsl.s).toBeCloseTo(0, 5);
    expect(hsl.l).toBeCloseTo(0, 5);
  });

  test('pure red is hue 0, fully saturated, mid lightness', () => {
    const hsl = toHsl(parseColor('#ff0000'));
    expect(hsl.h).toBeCloseTo(0, 0);
    expect(hsl.s).toBeCloseTo(100, 0);
    expect(hsl.l).toBeCloseTo(50, 0);
  });

  test('every channel stays within its valid range for an out-of-gamut OKLCH input', () => {
    const hsl = toHsl({ l: 0.7, c: 0.4, h: 250 });
    expect(hsl.h).toBeGreaterThanOrEqual(0);
    expect(hsl.h).toBeLessThan(360);
    expect(hsl.s).toBeGreaterThanOrEqual(0);
    expect(hsl.s).toBeLessThanOrEqual(100);
    expect(hsl.l).toBeGreaterThanOrEqual(0);
    expect(hsl.l).toBeLessThanOrEqual(100);
  });
});

describe('formatHsl', () => {
  test('renders the CSS Color 4 space-separated hsl() function', () => {
    expect(formatHsl(parseColor('#ff0000'))).toBe('hsl(0 100% 50%)');
  });
});
