import { describe, expect, it } from 'vitest';
import { fluidClamp, sizeAtViewport, toCssVariables, type FluidRange } from '../fluid-clamp';

const RANGE: FluidRange = {
  minRem: 1,
  maxRem: 2,
  minViewportPx: 320,
  maxViewportPx: 1440,
};

describe('fluidClamp — the endpoints must actually land', () => {
  // These are the tests that matter. Asserting the generated string only proves
  // the generator agrees with itself; evaluating the expression proves the
  // maths — in particular the ×100 that converts a per-rem slope into vw.
  it('resolves to exactly minRem at the minimum viewport', () => {
    const result = fluidClamp(RANGE);
    expect(sizeAtViewport(result, RANGE, RANGE.minViewportPx)).toBeCloseTo(RANGE.minRem, 4);
  });

  it('resolves to exactly maxRem at the maximum viewport', () => {
    const result = fluidClamp(RANGE);
    expect(sizeAtViewport(result, RANGE, RANGE.maxViewportPx)).toBeCloseTo(RANGE.maxRem, 4);
  });

  it('interpolates linearly through the midpoint', () => {
    const result = fluidClamp(RANGE);
    const midViewport = (RANGE.minViewportPx + RANGE.maxViewportPx) / 2;
    const expected = (RANGE.minRem + RANGE.maxRem) / 2;
    expect(sizeAtViewport(result, RANGE, midViewport)).toBeCloseTo(expected, 4);
  });

  it('holds flat outside the range rather than running away', () => {
    const result = fluidClamp(RANGE);
    expect(sizeAtViewport(result, RANGE, 100)).toBeCloseTo(RANGE.minRem, 4);
    expect(sizeAtViewport(result, RANGE, 4000)).toBeCloseTo(RANGE.maxRem, 4);
  });
});

describe('fluidClamp — output shape', () => {
  it('emits a three-argument clamp with a vw term', () => {
    const { css } = fluidClamp(RANGE);
    expect(css).toMatch(/^clamp\(.+rem, .+vw [+-] .+rem, .+rem\)$/);
  });

  it('orders the clamp bounds smallest-first even when the size shrinks', () => {
    // A size that gets smaller as the viewport grows is legitimate for display
    // type. clamp() requires the lower bound first or the browser drops the
    // whole declaration.
    const shrinking: FluidRange = { ...RANGE, minRem: 3, maxRem: 1.5 };
    const { css } = fluidClamp(shrinking);
    const [, lower, , upper] = css.match(/^clamp\(([\d.]+)rem, (.+), ([\d.]+)rem\)$/) ?? [];
    expect(Number(lower)).toBeLessThan(Number(upper));
  });

  it('still lands on both endpoints when the size shrinks with viewport', () => {
    const shrinking: FluidRange = { ...RANGE, minRem: 3, maxRem: 1.5 };
    const result = fluidClamp(shrinking);
    expect(sizeAtViewport(result, shrinking, shrinking.minViewportPx)).toBeCloseTo(3, 4);
    expect(sizeAtViewport(result, shrinking, shrinking.maxViewportPx)).toBeCloseTo(1.5, 4);
  });

  it('formats a negative intercept with a minus rather than "+ -"', () => {
    const steep: FluidRange = { minRem: 1, maxRem: 6, minViewportPx: 320, maxViewportPx: 1440 };
    const { css } = fluidClamp(steep);
    expect(css).not.toContain('+ -');
    expect(css).toContain('-');
  });
});

describe('fluidClamp — degenerate input', () => {
  it('collapses to a fixed size when min and max match', () => {
    const flat = fluidClamp({ ...RANGE, maxRem: RANGE.minRem });
    expect(flat.isStatic).toBe(true);
    expect(flat.css).toBe('1rem');
    expect(flat.css).not.toContain('clamp');
  });

  it('collapses rather than dividing by zero on a zero-width viewport range', () => {
    const degenerate = fluidClamp({ ...RANGE, maxViewportPx: RANGE.minViewportPx });
    expect(degenerate.isStatic).toBe(true);
    expect(Number.isFinite(degenerate.vw)).toBe(true);
  });
});

describe('toCssVariables', () => {
  it('emits one custom property per token inside :root', () => {
    const css = toCssVariables([
      { name: 'h1', result: fluidClamp(RANGE) },
      { name: 'body', result: fluidClamp({ ...RANGE, minRem: 1, maxRem: 1.125 }) },
    ]);
    expect(css.startsWith(':root {')).toBe(true);
    expect(css).toContain('--font-h1: clamp(');
    expect(css).toContain('--font-body: clamp(');
    expect(css.trimEnd().endsWith('}')).toBe(true);
  });
});
