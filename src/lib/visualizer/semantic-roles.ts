/**
 * Maps an arbitrary set of colours onto the semantic roles a UI actually needs.
 *
 * The mapping is driven by OKLCH **lightness ordering**, not hue or input
 * order, because that is what decides whether an interface reads correctly:
 * the darkest colour makes a sensible background in a dark UI, the lightest
 * makes readable text on it, and the most chromatic mid-tone is what the eye
 * takes as "the brand". Ordering by lightness is only meaningful in a
 * perceptually uniform space — this is the concrete payoff of the engine being
 * OKLCH throughout rather than HSL.
 *
 * Pure: no DOM, no React, no colour parsing of unknown strings. Callers hand in
 * already-parsed OKLCH values so this module never has to fail on bad input.
 */

import { formatHex, type Oklch } from '@/lib/color-engine';

export type SemanticRole =
  | 'background'
  | 'surface'
  | 'primary'
  | 'text'
  | 'accent'
  | 'border';

export const SEMANTIC_ROLES: readonly SemanticRole[] = [
  'background',
  'surface',
  'primary',
  'text',
  'accent',
  'border',
];

export interface RoleColor {
  readonly hex: string;
  readonly oklch: Oklch;
}

export type RoleAssignment = Readonly<Record<SemanticRole, RoleColor>>;

/** Manual overrides win over the derived mapping, per role. */
export type RoleOverrides = Partial<Record<SemanticRole, RoleColor>>;

/**
 * A dark-UI fallback used to fill any role a palette is too small to supply.
 * Deliberately neutral: a palette of one brand colour should produce a usable
 * interface around that colour rather than six tinted variations of it, which
 * is what naive "just reuse the nearest colour" filling produces.
 */
const FALLBACK: RoleAssignment = {
  background: { hex: '#0B0B0C', oklch: { l: 0.145, c: 0.002, h: 285 } },
  surface: { hex: '#17171A', oklch: { l: 0.205, c: 0.004, h: 285 } },
  primary: { hex: '#7C5CFF', oklch: { l: 0.62, c: 0.21, h: 285 } },
  text: { hex: '#F2F2F5', oklch: { l: 0.958, c: 0.002, h: 285 } },
  accent: { hex: '#FFB454', oklch: { l: 0.82, c: 0.13, h: 75 } },
  border: { hex: '#2A2A30', oklch: { l: 0.29, c: 0.006, h: 285 } },
};

function byLightness(a: RoleColor, b: RoleColor): number {
  return a.oklch.l - b.oklch.l;
}

/**
 * Derives a full role assignment from a palette.
 *
 * With enough colours the mapping is: darkest → background, next → surface,
 * lightest → text, most chromatic remaining → primary, second-most → accent,
 * and a low-lightness low-chroma one → border. Roles a palette cannot fill
 * fall back to the neutral dark set above rather than being duplicated, so the
 * result is always a complete, usable interface.
 */
export function deriveRoles(
  palette: readonly RoleColor[],
  overrides: RoleOverrides = {}
): RoleAssignment {
  const derived = deriveFromPalette(palette);
  // Overrides are applied last so a manual choice is never recomputed away.
  return { ...derived, ...stripUndefined(overrides) };
}

function stripUndefined(overrides: RoleOverrides): RoleOverrides {
  const out: RoleOverrides = {};
  for (const role of SEMANTIC_ROLES) {
    const value = overrides[role];
    if (value !== undefined) out[role] = value;
  }
  return out;
}

function deriveFromPalette(palette: readonly RoleColor[]): RoleAssignment {
  if (palette.length === 0) return FALLBACK;

  const sorted = [...palette].sort(byLightness);
  const darkest = sorted[0]!;
  const lightest = sorted[sorted.length - 1]!;

  // "The brand colour" is the most chromatic one — the colour a viewer would
  // name if asked what this palette *is*. Lightness extremes are excluded
  // because they are already carrying background/text duty.
  const middle = sorted.length > 2 ? sorted.slice(1, -1) : sorted;
  const byChroma = [...middle].sort((a, b) => b.oklch.c - a.oklch.c);

  const primary = byChroma[0] ?? FALLBACK.primary;
  const accent = byChroma[1] ?? FALLBACK.accent;

  // A single colour can serve as background *or* text, never both — a
  // one-colour palette should read as "this brand colour on a neutral UI".
  const background = sorted.length >= 2 ? darkest : FALLBACK.background;
  const text = sorted.length >= 2 ? lightest : FALLBACK.text;

  // Surface sits just above background; border just above surface. Both need a
  // colour genuinely distinguishable from the background, otherwise the
  // interface loses all its edges.
  const surface = sorted.length >= 3 ? sorted[1]! : FALLBACK.surface;
  const border =
    sorted.length >= 4 ? sorted[2]! : sorted.length >= 3 ? FALLBACK.border : FALLBACK.border;

  return { background, surface, primary, text, accent, border };
}

/** The CSS custom properties a template consumes. */
export function rolesToCssVars(roles: RoleAssignment): Record<string, string> {
  return {
    '--ui-background': roles.background.hex,
    '--ui-surface': roles.surface.hex,
    '--ui-primary': roles.primary.hex,
    '--ui-text': roles.text.hex,
    '--ui-accent': roles.accent.hex,
    '--ui-border': roles.border.hex,
  };
}

/**
 * Swaps the light/dark polarity without touching hue or chroma — the
 * "1-click dark/light flip that doesn't break the brand hue" the spec asks
 * for. Background/text trade lightness, surface and border move with the
 * background, and primary/accent are left alone precisely because they *are*
 * the brand.
 */
export function flipPolarity(roles: RoleAssignment): RoleAssignment {
  // The hex must be recomputed from the mirrored OKLCH, not carried over.
  // rolesToCssVars emits `hex` — mirroring only the `oklch` field would make
  // the whole flip a silent no-op on screen while every value in the object
  // looked correct.
  const mirror = (color: RoleColor): RoleColor => {
    const flipped: Oklch = { ...color.oklch, l: 1 - color.oklch.l };
    return { hex: formatHex(flipped), oklch: flipped };
  };

  return {
    ...roles,
    background: mirror(roles.background),
    surface: mirror(roles.surface),
    text: mirror(roles.text),
    border: mirror(roles.border),
  };
}
