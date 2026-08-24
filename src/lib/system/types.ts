/**
 * The System — the single document this product edits.
 *
 * Everything a person builds here is one object: the colors they collected,
 * which color plays which role, how type is set, and whether the whole thing
 * reads light or dark. Before this existed the app kept a color tray in one
 * place, role overrides in a component's `useState`, and type settings in
 * another component's `useState`, which is why five capable tabs behaved like
 * five unrelated products — nothing they each knew about survived a navigation
 * or could be sent to anyone.
 *
 * Pure data. No React, no DOM, no URL knowledge. The codec (codec.ts) turns
 * this into a query string and back; the reducer (system-reducer.ts) is the
 * only thing that changes it.
 */

import type { ControlPoint, Gamut, Oklch } from '@/lib/color-engine';
import type { SemanticRole } from '@/lib/roles/semantic-roles';

/** A color held in the System's palette. */
export interface SystemColor {
  readonly hex: string;
  readonly oklch: Oklch;
  /** Collection order is meaningful to people even though the role model
   *  deliberately ignores it — it is how the palette strip is laid out. */
  readonly addedAt: number;
}

/** Light or dark polarity for the whole System. */
export type SystemMode = 'dark' | 'light';

/**
 * Families chosen from the open catalogue, as Fontsource slugs.
 *
 * A slug rather than a family name because the slug is the key everything else
 * resolves on — the licence, the weights, the CSS URL. Absent means "use the
 * preset's", so a System that never left the presets stays exactly as short in
 * the URL as it was before this existed.
 *
 * This is NOT the locally-scanned font exclusion being reversed. A catalogue
 * face is servable from a CDN, so a shared link renders the typeface it
 * promises on a machine that has never seen it; a face scanned off the author's
 * own disk is not, which is why that one stays out.
 */
export interface TypeFamilies {
  readonly display?: string;
  readonly body?: string;
  readonly mono?: string;
}

/**
 * How type is set. Deliberately excludes the locally-scanned font family:
 * a face installed on one machine is not installed on another, so putting it
 * in a shared System would hand someone a link that silently renders in a
 * different typeface than the one it promises.
 */
export interface TypeSettings {
  readonly presetId: string;
  readonly ratio: number;
  readonly baseRem: number;
  readonly lineHeight: number;
  readonly tracking: number;
  readonly weight: number;
  /** Overrides the preset's faces, per role. Absent roles fall back to it. */
  readonly families?: TypeFamilies;
}

/**
 * What a person chose about one color's scale, and nothing else.
 *
 * Deliberately not the Builder's runtime entry, which also carries the anchor
 * color, its OKLCH, the anchor step and whether the name was customised --
 * every one of those is derivable from the palette and the step count, and
 * storing a derived value is how two sources of truth start disagreeing. Only
 * the decisions are here, and each is optional because a scale nobody has
 * touched should cost nothing to carry.
 */
export interface ScaleSettings {
  /** Present only when renamed; auto-names are regenerated, not stored. */
  readonly name?: string;
  readonly chromaIntensity?: number;
  readonly hueTorsion?: number;
  readonly lightnessCurve?: readonly ControlPoint[];
  readonly chromaCurve?: readonly ControlPoint[];
  readonly hueTorsionCurve?: readonly ControlPoint[];
}

/**
 * The scale half of the System.
 *
 * `byHex` rather than by position: a palette can be reordered or have a color
 * removed from the middle, and settings keyed by index would silently attach
 * themselves to a different color. The URL still writes indices, because the
 * palette is right there beside it and six characters per reference is not
 * worth paying twice.
 */
export interface ScaleSystem {
  readonly steps: number;
  readonly gamut: Gamut;
  readonly byHex: Readonly<Record<string, ScaleSettings>>;
}

export interface System {
  readonly palette: readonly SystemColor[];
  /** The color scales are built from. Null when the palette is empty. */
  readonly anchorHex: string | null;
  /** Manual role assignments, by hex. Absent roles are derived. */
  readonly roleOverrides: Readonly<Partial<Record<SemanticRole, string>>>;
  readonly type: TypeSettings;
  /**
   * The curve work: the most distinctive thing the product makes, and until
   * now the only part of it a shared link silently dropped.
   */
  readonly scales: ScaleSystem;
  readonly mode: SystemMode;
}
