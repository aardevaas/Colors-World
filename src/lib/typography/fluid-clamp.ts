/**
 * Fluid type: one CSS `clamp()` that interpolates a size linearly between two
 * viewport widths, then holds flat outside them.
 *
 * The middle term is a line through two points — (minViewport, minSize) and
 * (maxViewport, maxSize) — expressed as `Crem + Mvw`, where M is the slope in
 * viewport-percent and C is the y-intercept. `vw` is a percentage of viewport
 * width, so the slope must be multiplied by 100 to be expressed in it. Getting
 * that factor wrong produces a curve that looks plausible and is wrong
 * everywhere except by coincidence, which is exactly why `sizeAtViewport`
 * exists below and the tests assert the endpoints numerically rather than
 * string-matching the output.
 */

import { ROOT_PX } from './type-scale';

export interface FluidRange {
  readonly minRem: number;
  readonly maxRem: number;
  readonly minViewportPx: number;
  readonly maxViewportPx: number;
}

export interface FluidResult {
  readonly css: string;
  /** Slope expressed in vw units, as it appears in the clamp expression. */
  readonly vw: number;
  /** Y-intercept in rem, as it appears in the clamp expression. */
  readonly rem: number;
  /** True when the size is constant and no interpolation is needed. */
  readonly isStatic: boolean;
}

function round(value: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

/**
 * Solves the clamp for one size range.
 *
 * A zero-width viewport range or an unchanging size both collapse to a plain
 * fixed value — emitting `clamp(1rem, 1rem, 1rem)` would be noise, and a zero
 * range would divide by zero.
 */
export function fluidClamp(range: FluidRange): FluidResult {
  const { minRem, maxRem, minViewportPx, maxViewportPx } = range;
  const viewportSpan = maxViewportPx - minViewportPx;

  if (viewportSpan <= 0 || minRem === maxRem) {
    return { css: `${round(minRem, 4)}rem`, vw: 0, rem: minRem, isStatic: true };
  }

  const minVwRem = minViewportPx / ROOT_PX;
  const maxVwRem = maxViewportPx / ROOT_PX;

  const slope = (maxRem - minRem) / (maxVwRem - minVwRem);
  const intercept = minRem - slope * minVwRem;

  const vw = round(slope * 100, 4);
  const rem = round(intercept, 4);

  // clamp()'s first argument must be the smaller bound. For a size that shrinks
  // as the viewport grows (a legitimate choice for oversized display type) the
  // bounds have to be swapped or the browser discards the whole declaration.
  const lower = Math.min(minRem, maxRem);
  const upper = Math.max(minRem, maxRem);

  const sign = rem < 0 ? '-' : '+';
  const middle = `${vw}vw ${sign} ${round(Math.abs(rem), 4)}rem`;

  return {
    css: `clamp(${round(lower, 4)}rem, ${middle}, ${round(upper, 4)}rem)`,
    vw,
    rem,
    isStatic: false,
  };
}

/**
 * Evaluates what a fluid result actually resolves to at a given viewport,
 * including the clamping. Used by the tests to verify the endpoints land on the
 * requested sizes — checking the generated string would only prove it matches
 * whatever the generator happens to produce.
 */
export function sizeAtViewport(result: FluidResult, range: FluidRange, viewportPx: number): number {
  if (result.isStatic) return range.minRem;
  const preferred = (result.vw / 100) * (viewportPx / ROOT_PX) + result.rem;
  const lower = Math.min(range.minRem, range.maxRem);
  const upper = Math.max(range.minRem, range.maxRem);
  return Math.min(upper, Math.max(lower, preferred));
}

export interface FluidToken {
  readonly name: string;
  readonly result: FluidResult;
}

/** Formats a set of fluid sizes as ready-to-paste CSS custom properties. */
export function toCssVariables(tokens: readonly FluidToken[]): string {
  const lines = tokens.map((token) => `  --font-${token.name}: ${token.result.css};`);
  return `:root {\n${lines.join('\n')}\n}`;
}
