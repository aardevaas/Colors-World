import type {
  Gamut,
  GeneratedScale,
  Oklch,
  ScaleAnchor,
  ScaleSpec,
  ScaleStep,
} from './types';
import {
  monotoneHueInterpolator,
  monotoneInterpolator,
  normalizeHue,
  type ControlPoint,
} from './interpolate';
import { formatHex, formatOklchCss, parseColor } from './color';
import { maxChroma } from './gamut';

const DEFAULT_STEPS = 10;
/** Exported so callers building a ScaleSpec from scratch (e.g. /builder's
 *  dock-ingestion, picking a sensible default anchor step for a newly
 *  collected color) can place a step against the same default ramp
 *  generateScale itself falls back to, without duplicating these numbers. */
export const DEFAULT_LIGHTNESS: readonly [number, number] = [0.971, 0.241];
const DEFAULT_CHROMA_INTENSITY = 1;

/** Minimum lightness separation between adjacent control points. */
const MIN_LIGHTNESS_GAP = 0.01;
const LIGHTNESS_CEILING = 0.995;
const LIGHTNESS_FLOOR = 0.02;

/** Saturation fraction above 1.0 means the gamut cannot deliver what was asked. */
const FULL_SATURATION = 1;

interface ResolvedAnchor {
  readonly step: number;
  readonly oklch: Oklch;
}

function resolveAnchors(
  anchors: readonly ScaleAnchor[],
  steps: number
): ResolvedAnchor[] {
  if (anchors.length === 0) {
    throw new Error('A scale needs at least one anchor to define its hue.');
  }

  const seen = new Set<number>();
  const resolved = anchors.map((anchor) => {
    if (!Number.isInteger(anchor.step)) {
      throw new Error(`Anchor step must be an integer, received ${anchor.step}`);
    }
    if (anchor.step < 0 || anchor.step >= steps) {
      throw new Error(
        `Anchor step ${anchor.step} is outside the scale range 0–${steps - 1}`
      );
    }
    if (seen.has(anchor.step)) {
      throw new Error(`Duplicate anchor at step ${anchor.step}`);
    }
    seen.add(anchor.step);
    return { step: anchor.step, oklch: parseColor(anchor.color) };
  });

  resolved.sort((a, b) => a.step - b.step);

  for (let i = 1; i < resolved.length; i += 1) {
    const previous = resolved[i - 1]!;
    const current = resolved[i]!;
    if (current.oklch.l >= previous.oklch.l) {
      throw new Error(
        `Anchors must get darker as step increases: step ${current.step} ` +
          `(L ${current.oklch.l.toFixed(3)}) is not darker than step ` +
          `${previous.step} (L ${previous.oklch.l.toFixed(3)}).`
      );
    }
  }

  return resolved;
}

function buildLightnessCurve(
  anchors: readonly ResolvedAnchor[],
  steps: number,
  range: readonly [number, number],
  customCurve?: readonly ControlPoint[]
): (step: number) => number {
  if (customCurve !== undefined && customCurve.length > 0) {
    const interpolator = monotoneInterpolator(customCurve);
    const lastIndex = steps - 1;
    return (step: number) => interpolator(step / lastIndex);
  }

  const points: ControlPoint[] = anchors.map((anchor) => ({
    x: anchor.step,
    y: anchor.oklch.l,
  }));

  const firstPoint = points[0]!;
  if (firstPoint.x !== 0) {
    // The declared top-of-scale lightness only applies if it is actually lighter
    // than the first anchor; otherwise the anchor wins and we sit just above it.
    const top = Math.max(range[0], firstPoint.y + MIN_LIGHTNESS_GAP);
    points.unshift({ x: 0, y: Math.min(LIGHTNESS_CEILING, top) });
  }

  const lastPoint = points[points.length - 1]!;
  if (lastPoint.x !== steps - 1) {
    const bottom = Math.min(range[1], lastPoint.y - MIN_LIGHTNESS_GAP);
    points.push({ x: steps - 1, y: Math.max(LIGHTNESS_FLOOR, bottom) });
  }

  return monotoneInterpolator(points);
}

function buildHueCurve(
  anchors: readonly ResolvedAnchor[]
): (step: number) => number {
  if (anchors.length === 1) {
    const hue = anchors[0]!.oklch.h;
    return () => hue;
  }
  return monotoneHueInterpolator(
    anchors.map((anchor) => ({ x: anchor.step, y: anchor.oklch.h }))
  );
}

/**
 * Chroma is carried through the scale as a *fraction of the chroma available at
 * that lightness and hue*, not as an absolute value.
 *
 * Absolute chroma cannot work: the gamut is lens-shaped, so a constant chroma
 * that looks right at step 5 is impossible at step 0 and timid at step 9. It
 * also cannot be fixed by a single analytic falloff curve, because the shape of
 * that lens differs sharply per hue. Expressing saturation as a percentage of
 * what is actually achievable makes the ramp hue-adaptive for free, and means a
 * generated step never needs rescuing by the gamut mapper afterwards.
 */
function buildSaturationCurve(
  anchors: readonly ResolvedAnchor[],
  gamut: Gamut,
  steps: number,
  customCurve?: readonly ControlPoint[]
): (step: number) => number {
  if (customCurve !== undefined && customCurve.length > 0) {
    const interpolator = monotoneInterpolator(customCurve);
    const lastIndex = steps - 1;
    return (step: number) => interpolator(step / lastIndex);
  }

  const fractions = anchors.map((anchor) => {
    const available = maxChroma(anchor.oklch.l, anchor.oklch.h, gamut);
    return {
      x: anchor.step,
      y: available <= 0 ? 0 : anchor.oklch.c / available,
    };
  });

  if (fractions.length === 1) {
    const fraction = fractions[0]!.y;
    return () => fraction;
  }
  return monotoneInterpolator(fractions);
}

/**
 * Shapes how hueTorsion's rotation is distributed across the scale. Default
 * is today's linear ramp, zeroed at the anchor's own progress so the pinned
 * color sits at zero rotation; a custom curve replaces that shape entirely.
 * The anchor step's hue is irrelevant either way — it gets overwritten by
 * the exact pinned color regardless of what this function returns for it.
 */
function buildTorsionShape(
  torsionOrigin: number,
  customCurve?: readonly ControlPoint[]
): (progress: number) => number {
  if (customCurve !== undefined && customCurve.length > 0) {
    return monotoneInterpolator(customCurve);
  }
  return (progress: number) => progress - torsionOrigin;
}

export function generateScale(spec: ScaleSpec): GeneratedScale {
  const steps = spec.steps ?? DEFAULT_STEPS;
  if (!Number.isInteger(steps) || steps < 2) {
    throw new Error(`A scale needs at least 2 steps, received ${steps}`);
  }

  const gamut = spec.gamut ?? 'srgb';
  const chromaIntensity = spec.chromaIntensity ?? DEFAULT_CHROMA_INTENSITY;
  const hueTorsion = spec.hueTorsion ?? 0;
  const lightnessRange = spec.lightness ?? DEFAULT_LIGHTNESS;

  const anchors = resolveAnchors(spec.anchors, steps);
  const anchorByStep = new Map(anchors.map((a) => [a.step, a.oklch]));

  const lightnessAt = buildLightnessCurve(anchors, steps, lightnessRange, spec.lightnessCurve);
  const hueAt = buildHueCurve(anchors);
  const saturationAt = buildSaturationCurve(anchors, gamut, steps, spec.chromaCurve);

  // Torsion is measured *relative to the primary anchor* so that the pinned
  // color sits at zero rotation. Anchoring at zero keeps the forced-exact
  // anchor continuous with its neighbours instead of creating a visible kink.
  const lastIndex = steps - 1;
  const torsionOrigin = anchors[0]!.step / lastIndex;
  const torsionShape = buildTorsionShape(torsionOrigin, spec.hueTorsionCurve);

  const generated: ScaleStep[] = [];

  for (let step = 0; step < steps; step += 1) {
    const pinned = anchorByStep.get(step);
    if (pinned !== undefined) {
      generated.push({
        step,
        oklch: pinned,
        hex: formatHex(pinned),
        css: formatOklchCss(pinned),
        isAnchor: true,
        gamutClamped: false,
      });
      continue;
    }

    const lightness = clamp(lightnessAt(step), LIGHTNESS_FLOOR, LIGHTNESS_CEILING);
    const progress = step / lastIndex;
    const hue = normalizeHue(hueAt(step) + hueTorsion * torsionShape(progress));

    const requested = Math.max(0, saturationAt(step) * chromaIntensity);
    const available = maxChroma(lightness, hue, gamut);
    const chroma = Math.min(requested, FULL_SATURATION) * available;

    const oklch: Oklch = { l: lightness, c: chroma, h: hue };

    generated.push({
      step,
      oklch,
      hex: formatHex(oklch),
      css: formatOklchCss(oklch),
      isAnchor: false,
      // Riding the gamut ceiling is the honest meaning of "clamped": the scale
      // wanted more saturation here than this gamut can physically show, so a
      // wider gamut would render this step differently.
      gamutClamped: requested > FULL_SATURATION,
    });
  }

  return { name: spec.name, spec, steps: generated };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
