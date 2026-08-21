/**
 * Core types for the PRISM color engine.
 *
 * Canonical storage is OKLCH. Every other representation (hex, sRGB, P3, CMYK)
 * is a *projection* derived on demand — never a second source of truth. This is
 * deliberate: hex is lossy above sRGB, and round-tripping through it silently
 * destroys wide-gamut color.
 */

import type { ControlPoint } from './interpolate';

/** Perceptual polar coordinates. l ∈ [0,1], c ≥ 0, h ∈ [0,360). */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
  readonly alpha?: number;
}

/**
 * Gamuts we can target. 'print' is a pseudo-gamut — not an RGB space at all,
 * but an approximate CMYK press boundary — so the same gamut-mapping
 * machinery that keeps a scale inside sRGB can also honestly show how much a
 * vivid color dulls under ink. See gamut.ts for the caveat on accuracy.
 */
export type Gamut = 'srgb' | 'p3' | 'rec2020' | 'print';

/**
 * Subtractive color as printers see it. Each channel is a percentage, 0–100.
 * Derived on demand from OKLCH via the naive device-independent formula — see
 * cmyk.ts for why this is deliberately not press-accurate.
 */
export interface Cmyk {
  readonly c: number;
  readonly m: number;
  readonly y: number;
  readonly k: number;
}

/** Provenance of a datum — keeps seeded bulk data distinguishable from curated truth. */
export type Provenance = 'seed' | 'curated' | 'user' | 'measured';

/** A single pinned step in a scale. The user's explicit override. */
export interface ScaleAnchor {
  /** Zero-based index of the step this anchor pins. */
  readonly step: number;
  /** Any CSS color string — the exact value this step must resolve to. */
  readonly color: string;
}

/**
 * Declarative description of a tonal scale. The generator is a pure function of
 * this spec, so a spec round-trips losslessly through storage and version control.
 */
export interface ScaleSpec {
  readonly name: string;
  /** At least one anchor is required — it establishes hue and chroma reference. */
  readonly anchors: readonly ScaleAnchor[];
  /** Number of steps. Default 10, yielding the familiar 0–9 scale. */
  readonly steps?: number;
  /** OKLCH lightness at the first and last step. Default [0.971, 0.241]. */
  readonly lightness?: readonly [number, number];
  /**
   * Multiplier on the anchor's saturation, expressed as a fraction of the chroma
   * the gamut can deliver. 1 preserves the anchor's saturation; <1 mutes the
   * scale; >1 pushes it toward the gamut ceiling.
   */
  readonly chromaIntensity?: number;
  /** Total hue rotation in degrees applied across the scale (warm shadows etc.). */
  readonly hueTorsion?: number;
  /** Gamut every generated step is mapped into. Default 'srgb'. */
  readonly gamut?: Gamut;

  /**
   * Custom curve overrides for /builder's curve manipulator panel. Each is
   * defined over *normalized progress* (x: 0–1, "0% through the scale" to
   * "100% through the scale") rather than raw step index — step count is a
   * user-adjustable slider (1–10), and a curve pinned to step indices would
   * corrupt the moment someone changes it. Progress space survives that
   * change untouched.
   *
   * All three are optional and independently overridable; omitting one
   * falls back to today's anchor+range-derived behaviour exactly, so every
   * scale generated before this field existed keeps producing byte-identical
   * output. An anchor's own step still resolves to its exact pinned color
   * regardless of any curve — these only shape the steps in between.
   */
  /** y: lightness, 0–1. Replaces the anchor+range-derived lightness ramp. */
  readonly lightnessCurve?: readonly ControlPoint[];
  /** y: fraction of gamut-available chroma, 0–1 (same unit the default
   *  anchor-derived saturation curve already uses). Still scaled by
   *  chromaIntensity afterward — the curve shapes it, the intensity dial's
   *  meaning doesn't change. */
  readonly chromaCurve?: readonly ControlPoint[];
  /** y: torsion fraction, -1–1. Replaces the default linear "distance from
   *  the anchor's own progress" ramp; still scaled by hueTorsion afterward,
   *  same intensity-dial-plus-shape relationship as chromaCurve. */
  readonly hueTorsionCurve?: readonly ControlPoint[];
}

/** One resolved step of a generated scale. */
export interface ScaleStep {
  readonly step: number;
  readonly oklch: Oklch;
  readonly hex: string;
  readonly css: string;
  /** True when this step was pinned by an anchor rather than interpolated. */
  readonly isAnchor: boolean;
  /** True when gamut mapping had to reduce chroma to make the step displayable. */
  readonly gamutClamped: boolean;
}

export interface GeneratedScale {
  readonly name: string;
  readonly spec: ScaleSpec;
  readonly steps: readonly ScaleStep[];
}

/** WCAG 2.x conformance outcome for one text-size class. */
export interface WcagLevel {
  readonly aa: boolean;
  readonly aaa: boolean;
}

export interface ContrastReport {
  /** WCAG 2.x contrast ratio, 1–21. The legally-cited number. */
  readonly ratio: number;
  /** APCA lightness contrast, roughly −108…+106. Perceptual advisory. */
  readonly apcaLc: number;
  readonly normalText: WcagLevel;
  readonly largeText: WcagLevel;
  /** WCAG 2.2 SC 1.4.11 — UI components and graphical objects need ≥ 3:1. */
  readonly nonText: boolean;
}

export type CvdType =
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'achromatopsia';
