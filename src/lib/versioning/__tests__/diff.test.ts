import { describe, expect, test } from 'vitest';
import { deltaEOk, diffSnapshots, shortestHueDelta } from '../diff';
import { parseColor } from '@/lib/color-engine';

describe('deltaEOk', () => {
  test('zero for identical colors', () => {
    const color = parseColor('#3b82f6');
    expect(deltaEOk(color, color)).toBeCloseTo(0, 10);
  });

  test('larger for black-vs-white than for two adjacent blues', () => {
    const black = parseColor('#000000');
    const white = parseColor('#ffffff');
    const blueA = parseColor('#3b82f6');
    const blueB = parseColor('#2563eb');

    expect(deltaEOk(black, white)).toBeGreaterThan(deltaEOk(blueA, blueB));
  });

  test('is symmetric', () => {
    const a = parseColor('#3b82f6');
    const b = parseColor('#f5d90a');
    expect(deltaEOk(a, b)).toBeCloseTo(deltaEOk(b, a), 10);
  });
});

describe('shortestHueDelta', () => {
  test('takes the short way across the 0/360 seam', () => {
    expect(shortestHueDelta(350, 10)).toBeCloseTo(20, 6);
    expect(shortestHueDelta(10, 350)).toBeCloseTo(-20, 6);
  });

  test('is a plain difference away from the seam', () => {
    expect(shortestHueDelta(100, 130)).toBeCloseTo(30, 6);
  });
});

describe('diffSnapshots', () => {
  test('flags a token present only in "after" as added', () => {
    const deltas = diffSnapshots({}, { 'brand-5': '#3b82f6' });
    expect(deltas).toEqual([
      { token: 'brand-5', kind: 'added', before: null, after: '#3b82f6' },
    ]);
  });

  test('flags a token present only in "before" as removed', () => {
    const deltas = diffSnapshots({ 'brand-5': '#3b82f6' }, {});
    expect(deltas).toEqual([
      { token: 'brand-5', kind: 'removed', before: '#3b82f6', after: null },
    ]);
  });

  test('flags an identical token as unchanged', () => {
    const deltas = diffSnapshots(
      { 'brand-5': '#3b82f6' },
      { 'brand-5': '#3b82f6' }
    );
    expect(deltas[0]!.kind).toBe('unchanged');
  });

  test('computes perceptual deltas for a changed token', () => {
    const deltas = diffSnapshots(
      { 'brand-5': '#3b82f6' },
      { 'brand-5': '#2563eb' }
    );
    const delta = deltas[0]!;
    expect(delta.kind).toBe('changed');
    expect(delta.deltaEOk).toBeGreaterThan(0);
    expect(typeof delta.deltaL).toBe('number');
    expect(typeof delta.deltaC).toBe('number');
    expect(typeof delta.deltaH).toBe('number');
  });

  test('a pure lightness change carries near-zero hue delta', () => {
    // Same hue and chroma, only lightness moves — the diff should attribute
    // the change almost entirely to L, not fabricate a hue shift.
    const deltas = diffSnapshots(
      { swatch: 'oklch(70% 0.15 250)' },
      { swatch: 'oklch(40% 0.15 250)' }
    );
    const delta = deltas[0]!;
    expect(Math.abs(delta.deltaH!)).toBeLessThan(0.01);
    expect(Math.abs(delta.deltaL!)).toBeGreaterThan(0.2);
  });

  test('a pure hue change carries near-zero lightness delta', () => {
    const deltas = diffSnapshots(
      { swatch: 'oklch(60% 0.15 100)' },
      { swatch: 'oklch(60% 0.15 200)' }
    );
    const delta = deltas[0]!;
    expect(Math.abs(delta.deltaL!)).toBeLessThan(0.01);
    expect(Math.abs(delta.deltaH!)).toBeCloseTo(100, 0);
  });

  test('sorts results by token name for a stable ordering', () => {
    const deltas = diffSnapshots(
      { zeta: '#000000', alpha: '#ffffff' },
      { zeta: '#000000', alpha: '#ffffff' }
    );
    expect(deltas.map((d) => d.token)).toEqual(['alpha', 'zeta']);
  });

  test('every token in either snapshot appears exactly once', () => {
    const deltas = diffSnapshots(
      { a: '#111111', b: '#222222' },
      { b: '#222222', c: '#333333' }
    );
    expect(deltas.map((d) => d.token)).toEqual(['a', 'b', 'c']);
  });
});
