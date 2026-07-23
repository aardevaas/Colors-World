import {
  converter,
  formatHex as culoriFormatHex,
  parse as culoriParse,
} from 'culori';
import type { Gamut, Oklch } from './types';
import { normalizeHue } from './interpolate';

const toOklchColor = converter('oklch');
const toRgbColor = converter('rgb');

/** The RGB-family gamuts culori itself understands — 'print' is not one of them. */
type RgbGamut = Exclude<Gamut, 'print'>;

/** culori names the sRGB gamut 'rgb'; everywhere else we call it what it is. */
const GAMUT_MODE: Record<RgbGamut, string> = {
  srgb: 'rgb',
  p3: 'p3',
  rec2020: 'rec2020',
};

export function gamutMode(gamut: RgbGamut): string {
  return GAMUT_MODE[gamut];
}

/**
 * Parses any CSS colour string into canonical OKLCH.
 * Throws on unparseable input rather than silently yielding black — a silent
 * fallback here would poison an entire generated scale with a plausible-looking
 * but wrong hue.
 */
export function parseColor(input: string): Oklch {
  const parsed = culoriParse(input.trim());
  if (parsed === undefined) {
    throw new Error(`Unparseable colour: "${input}"`);
  }
  const converted = toOklchColor(parsed);
  if (converted === undefined) {
    throw new Error(`Colour could not be converted to OKLCH: "${input}"`);
  }
  return {
    l: converted.l,
    c: converted.c,
    // culori omits hue for achromatic colours; 0 is the conventional stand-in.
    h: converted.h === undefined ? 0 : normalizeHue(converted.h),
    ...(converted.alpha === undefined ? {} : { alpha: converted.alpha }),
  };
}

/** Accepts either a CSS string or an already-canonical OKLCH value. */
export function toOklch(input: string | Oklch): Oklch {
  return typeof input === 'string' ? parseColor(input) : input;
}

export function toCuloriOklch(color: Oklch) {
  return {
    mode: 'oklch' as const,
    l: color.l,
    c: color.c,
    h: color.h,
    ...(color.alpha === undefined ? {} : { alpha: color.alpha }),
  };
}

/**
 * Renders to hex. Lossy for anything outside sRGB — callers wanting wide-gamut
 * fidelity should use `formatOklchCss` instead.
 */
export function formatHex(color: Oklch): string {
  return culoriFormatHex(toCuloriOklch(color)) ?? '#000000';
}

/** 8-bit sRGB channel values, 0–255. Lossy for anything outside sRGB. */
export interface Rgb8 {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export function toRgb(color: Oklch): Rgb8 {
  const converted = toRgbColor(toCuloriOklch(color));
  return {
    r: Math.round(clamp01(converted?.r ?? 0) * 255),
    g: Math.round(clamp01(converted?.g ?? 0) * 255),
    b: Math.round(clamp01(converted?.b ?? 0) * 255),
  };
}

/** Renders as a CSS Color 4 space-separated `rgb()` function. */
export function formatRgb(color: Oklch): string {
  const { r, g, b } = toRgb(color);
  return `rgb(${r} ${g} ${b})`;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Renders as a CSS `oklch()` function, preserving wide-gamut values exactly. */
export function formatOklchCss(color: Oklch, precision = 4): string {
  const l = round(color.l * 100, 2);
  const c = round(color.c, precision);
  const h = round(color.h, 2);
  const alpha =
    color.alpha === undefined || color.alpha === 1
      ? ''
      : ` / ${round(color.alpha, 3)}`;
  return `oklch(${l}% ${c} ${h}${alpha})`;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export { clamp01, round };
