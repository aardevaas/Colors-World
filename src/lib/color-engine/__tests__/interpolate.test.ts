import { describe, expect, test } from 'vitest';
import {
  monotoneHueInterpolator,
  monotoneInterpolator,
  normalizeHue,
} from '../interpolate';

describe('monotoneInterpolator', () => {
  test('passes exactly through every control point', () => {
    const points = [
      { x: 0, y: 0.97 },
      { x: 4, y: 0.62 },
      { x: 9, y: 0.24 },
    ];
    const interpolate = monotoneInterpolator(points);

    for (const point of points) {
      expect(interpolate(point.x)).toBeCloseTo(point.y, 10);
    }
  });

  test('never overshoots between control points', () => {
    // A natural cubic spline through this data overshoots above 1.0 near x=1.
    // Fritsch-Carlson must not.
    const interpolate = monotoneInterpolator([
      { x: 0, y: 1 },
      { x: 1, y: 0.99 },
      { x: 2, y: 0.2 },
      { x: 3, y: 0.1 },
    ]);

    for (let x = 0; x <= 3; x += 0.01) {
      const y = interpolate(x);
      expect(y).toBeLessThanOrEqual(1 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(0.1 - 1e-9);
    }
  });

  test('stays monotone across the whole domain', () => {
    const interpolate = monotoneInterpolator([
      { x: 0, y: 0.97 },
      { x: 2, y: 0.9 },
      { x: 5, y: 0.55 },
      { x: 9, y: 0.24 },
    ]);

    let previous = Number.POSITIVE_INFINITY;
    for (let x = 0; x <= 9; x += 0.05) {
      const y = interpolate(x);
      expect(y).toBeLessThanOrEqual(previous + 1e-9);
      previous = y;
    }
  });

  test('holds endpoint values outside the control range', () => {
    const interpolate = monotoneInterpolator([
      { x: 2, y: 0.8 },
      { x: 5, y: 0.3 },
    ]);
    expect(interpolate(-10)).toBe(0.8);
    expect(interpolate(99)).toBe(0.3);
  });

  test('a single control point yields a constant function', () => {
    const interpolate = monotoneInterpolator([{ x: 3, y: 0.42 }]);
    expect(interpolate(0)).toBe(0.42);
    expect(interpolate(100)).toBe(0.42);
  });

  test('rejects empty and non-ascending input', () => {
    expect(() => monotoneInterpolator([])).toThrow(/at least one/i);
    expect(() =>
      monotoneInterpolator([
        { x: 5, y: 1 },
        { x: 2, y: 0 },
      ])
    ).toThrow(/ascending/i);
  });
});

describe('monotoneHueInterpolator', () => {
  test('takes the short way around the color wheel', () => {
    // 350° -> 10° should pass through 0°, not sweep down through 180°.
    const interpolate = monotoneHueInterpolator([
      { x: 0, y: 350 },
      { x: 1, y: 10 },
    ]);
    const midpoint = interpolate(0.5);
    // The true midpoint is 360°, which normalises to 0 — so measure angular
    // distance from zero rather than comparing the raw number.
    const distanceFromZero = Math.min(midpoint, 360 - midpoint);
    expect(distanceFromZero).toBeLessThan(5);
  });

  test('always returns a hue in [0, 360)', () => {
    const interpolate = monotoneHueInterpolator([
      { x: 0, y: 350 },
      { x: 1, y: 30 },
    ]);
    for (let x = 0; x <= 1; x += 0.05) {
      const hue = interpolate(x);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

describe('normalizeHue', () => {
  test('wraps negative and over-range angles', () => {
    expect(normalizeHue(-90)).toBe(270);
    expect(normalizeHue(450)).toBe(90);
    expect(normalizeHue(360)).toBe(0);
    expect(normalizeHue(180)).toBe(180);
  });
});
