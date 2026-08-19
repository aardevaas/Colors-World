/**
 * Modular typographic scales.
 *
 * A scale is one base size multiplied by a ratio, repeatedly — every step up is
 * `base * ratio^n`, every step down `base / ratio^n`. The ratios below are the
 * conventional musical intervals type has borrowed for a century; they are
 * named so a designer picks by intent ("classic editorial") rather than by
 * remembering that 1.333 is a perfect fourth.
 *
 * Pure: sizes in rem, no DOM, no CSS strings. Formatting lives in
 * fluid-clamp.ts so the maths can be tested independently of its output syntax.
 */

export interface ScaleRatio {
  readonly value: number;
  readonly name: string;
  /** What this ratio is actually good for — the reason to pick it. */
  readonly use: string;
}

export const SCALE_RATIOS: readonly ScaleRatio[] = [
  { value: 1.067, name: 'Minor second', use: 'Compact tables and mobile' },
  { value: 1.125, name: 'Major second', use: 'Clean UI' },
  { value: 1.2, name: 'Minor third', use: 'Balanced web app' },
  { value: 1.25, name: 'Major third', use: 'Gold-standard default' },
  { value: 1.333, name: 'Perfect fourth', use: 'Classic editorial' },
  { value: 1.414, name: 'Augmented fourth', use: 'High header contrast' },
  { value: 1.5, name: 'Perfect fifth', use: 'Hero marketing' },
  { value: 1.618, name: 'Golden ratio', use: 'Cinematic jumps' },
];

export const DEFAULT_RATIO = 1.25;

/** The rung names, largest first — `step` is the exponent applied to the base. */
export const SCALE_STEPS = [
  { token: 'display', step: 5 },
  { token: 'h1', step: 4 },
  { token: 'h2', step: 3 },
  { token: 'h3', step: 2 },
  { token: 'h4', step: 1 },
  { token: 'body', step: 0 },
  { token: 'small', step: -1 },
  { token: 'caption', step: -2 },
] as const;

export type ScaleToken = (typeof SCALE_STEPS)[number]['token'];

export interface ScaleEntry {
  readonly token: ScaleToken;
  readonly step: number;
  readonly rem: number;
  readonly px: number;
}

/** Browsers' default root font size, and the basis for every rem↔px conversion here. */
export const ROOT_PX = 16;

/** Rounded to a tenth of a pixel — finer than that is noise a renderer discards. */
function roundRem(rem: number): number {
  return Math.round(rem * ROOT_PX * 10) / 10 / ROOT_PX;
}

/**
 * Builds the full ladder for a base size and ratio.
 *
 * `body` is always exactly the base: a scale whose body text drifts off its own
 * base is the fastest way to end up with a design system nobody can reason
 * about, so step 0 is pinned rather than computed.
 */
export function buildScale(baseRem: number, ratio: number): readonly ScaleEntry[] {
  if (baseRem <= 0) throw new Error('Base size must be greater than zero.');
  if (ratio <= 1) throw new Error('Scale ratio must be greater than 1.');

  return SCALE_STEPS.map(({ token, step }) => {
    const rem = step === 0 ? baseRem : roundRem(baseRem * Math.pow(ratio, step));
    return { token, step, rem, px: Math.round(rem * ROOT_PX * 10) / 10 };
  });
}

export function ratioByValue(value: number): ScaleRatio | undefined {
  return SCALE_RATIOS.find((r) => r.value === value);
}
