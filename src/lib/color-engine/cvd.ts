import { converter } from 'culori';
import type { CvdType, Oklch } from './types';
import { toCuloriOklch } from './color';
import { normalizeHue } from './interpolate';

const toRgb = converter('rgb');
const toOklchColor = converter('oklch');

/**
 * Color vision deficiency simulation using the Machado, Oliveira & Fernandes
 * (2009) physiologically-based model, at full severity (dichromacy).
 *
 * These matrices operate on *linear* RGB. Applying them to gamma-encoded values
 * — a common shortcut — produces noticeably wrong results, generally
 * exaggerating the severity of the simulated deficiency.
 *
 * Reference: "A Physiologically-based Model for Simulation of Color Vision
 * Deficiency", IEEE TVCG 15(6), 2009.
 */
type Matrix3 = readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
];

const CVD_MATRICES: Record<Exclude<CvdType, 'achromatopsia'>, Matrix3> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/** Luminance weights for achromatopsia (total color blindness). */
const ACHROMATIC_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;

const SRGB_LINEAR_THRESHOLD = 0.04045;
const SRGB_ENCODE_THRESHOLD = 0.0031308;

function toLinear(channel: number): number {
  const value = clampUnit(channel);
  return value <= SRGB_LINEAR_THRESHOLD
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function toEncoded(channel: number): number {
  const value = clampUnit(channel);
  return value <= SRGB_ENCODE_THRESHOLD
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Returns how `color` is perceived by a viewer with the given deficiency.
 * The result is always mapped back into sRGB, since the simulation is only
 * meaningful as something you can actually display side by side with the
 * original.
 */
export function simulateCvd(color: Oklch, type: CvdType): Oklch {
  const rgb = toRgb(toCuloriOklch(color));
  const linear = {
    r: toLinear(rgb.r),
    g: toLinear(rgb.g),
    b: toLinear(rgb.b),
  };

  let simulated: { r: number; g: number; b: number };

  if (type === 'achromatopsia') {
    const luminance =
      ACHROMATIC_WEIGHTS.r * linear.r +
      ACHROMATIC_WEIGHTS.g * linear.g +
      ACHROMATIC_WEIGHTS.b * linear.b;
    simulated = { r: luminance, g: luminance, b: luminance };
  } else {
    const matrix = CVD_MATRICES[type];
    simulated = {
      r: matrix[0][0] * linear.r + matrix[0][1] * linear.g + matrix[0][2] * linear.b,
      g: matrix[1][0] * linear.r + matrix[1][1] * linear.g + matrix[1][2] * linear.b,
      b: matrix[2][0] * linear.r + matrix[2][1] * linear.g + matrix[2][2] * linear.b,
    };
  }

  const encoded = toOklchColor({
    mode: 'rgb' as const,
    r: toEncoded(simulated.r),
    g: toEncoded(simulated.g),
    b: toEncoded(simulated.b),
  });

  return {
    l: encoded.l,
    c: encoded.c,
    h: encoded.h === undefined ? 0 : normalizeHue(encoded.h),
    ...(color.alpha === undefined ? {} : { alpha: color.alpha }),
  };
}

export const CVD_TYPES: readonly CvdType[] = [
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
];
