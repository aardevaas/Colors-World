import { describe, expect, test } from 'vitest';
import { gradientCssString, sampleOklchGradient } from '../gradient';
import { parseColor } from '../color';

describe('sampleOklchGradient', () => {
  test('passes exactly through the first and last control colours', () => {
    const red = parseColor('#ff0000');
    const blue = parseColor('#0000ff');
    const stops = sampleOklchGradient([red, blue], 5);

    expect(stops[0]!.hex.toLowerCase()).toBe('#ff0000');
    expect(stops[stops.length - 1]!.hex.toLowerCase()).toBe('#0000ff');
  });

  test('produces the requested number of stops, evenly spaced by position', () => {
    const stops = sampleOklchGradient([parseColor('#ff0000'), parseColor('#00ff00')], 6);
    expect(stops).toHaveLength(6);
    expect(stops[0]!.position).toBe(0);
    expect(stops[stops.length - 1]!.position).toBe(1);
  });

  test('keeps chroma non-trivial at the midpoint instead of collapsing toward grey', () => {
    // Naive RGB interpolation of red -> blue desaturates hard through the middle
    // (both endpoints are far from a hue that shares much in common in sRGB
    // space). OKLCH interpolation with shortest-path hue should keep the
    // midpoint meaningfully saturated rather than near-neutral.
    const red = parseColor('#ff0000');
    const blue = parseColor('#0000ff');
    const stops = sampleOklchGradient([red, blue], 3);
    const midpoint = stops[1]!;
    expect(midpoint.oklch.c).toBeGreaterThan(0.05);
  });

  test('interpolates hue along the shortest circular path', () => {
    const nearRed = { l: 0.6, c: 0.15, h: 350 };
    const nearOrange = { l: 0.6, c: 0.15, h: 20 };
    const stops = sampleOklchGradient([nearRed, nearOrange], 3);
    // Shortest path from 350 to 20 crosses 0, so the midpoint hue should sit
    // near 5 (or 185 if it took the long way around, which would be wrong).
    expect(stops[1]!.oklch.h).toBeLessThan(30);
  });

  test('rejects fewer than 2 control colours', () => {
    expect(() => sampleOklchGradient([parseColor('#ff0000')], 5)).toThrow();
  });

  test('rejects fewer than 2 steps', () => {
    expect(() =>
      sampleOklchGradient([parseColor('#ff0000'), parseColor('#0000ff')], 1)
    ).toThrow();
  });

  test('supports more than 2 control colours', () => {
    const stops = sampleOklchGradient(
      [parseColor('#ff0000'), parseColor('#00ff00'), parseColor('#0000ff')],
      7
    );
    expect(stops).toHaveLength(7);
    expect(stops[0]!.hex.toLowerCase()).toBe('#ff0000');
    expect(stops[stops.length - 1]!.hex.toLowerCase()).toBe('#0000ff');
  });
});

describe('gradientCssString', () => {
  test('returns a linear-gradient() with percentage-positioned hex stops', () => {
    const css = gradientCssString([parseColor('#ff0000'), parseColor('#0000ff')], 4);
    expect(css).toMatch(/^linear-gradient\(90deg, #[0-9a-f]{6} 0\.0%.*#[0-9a-f]{6} 100\.0%\)$/i);
  });
});
