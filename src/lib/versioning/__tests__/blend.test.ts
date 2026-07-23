import { describe, expect, test } from 'vitest';
import { blendOklch } from '../blend';

const A = { l: 0.4, c: 0.1, h: 250 };
const B = { l: 0.8, c: 0.2, h: 20 };

describe('blendOklch', () => {
  test('t=0 returns the first colour exactly', () => {
    expect(blendOklch(A, B, 0)).toEqual(A);
  });

  test('t=1 returns the second colour exactly', () => {
    expect(blendOklch(A, B, 1)).toEqual(B);
  });

  test('t=0.5 sits at the midpoint of lightness and chroma', () => {
    const mid = blendOklch(A, B, 0.5);
    expect(mid.l).toBeCloseTo(0.6, 10);
    expect(mid.c).toBeCloseTo(0.15, 10);
  });

  test('clamps t outside [0, 1]', () => {
    expect(blendOklch(A, B, -5)).toEqual(A);
    expect(blendOklch(A, B, 5)).toEqual(B);
  });

  test('takes the short way around the hue wheel', () => {
    // 350 -> 10 should cross zero, landing near 0/360, not sweep through 180.
    const mid = blendOklch({ l: 0.5, c: 0.1, h: 350 }, { l: 0.5, c: 0.1, h: 10 }, 0.5);
    const distanceFromZero = Math.min(mid.h, 360 - mid.h);
    expect(distanceFromZero).toBeLessThan(1);
  });

  test('always returns a hue in [0, 360)', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      const blended = blendOklch(A, B, t);
      expect(blended.h).toBeGreaterThanOrEqual(0);
      expect(blended.h).toBeLessThan(360);
    }
  });
});
