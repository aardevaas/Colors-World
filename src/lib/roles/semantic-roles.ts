/**
 * Maps an arbitrary set of colors onto the semantic roles a UI actually needs.
 *
 * This is the **one** role model in the product. Every tab that turns dock
 * colors into an interface goes through here — `/visualizer` paints its
 * templates with it and `/typography` picks its text and page colors from it —
 * so the same dock produces the same meaning wherever you look. Before this was
 * shared, `/typography` mapped by collection *order* (`items[0]` = text,
 * `items[1]` = background), which made the result depend on the sequence you
 * happened to click colors in: three colors that read as a considered
 * interface in one tab read as violet-on-lurid-green in the other.
 *
 * The mapping is driven by OKLCH **lightness ordering**, not hue or input
 * order, because that is what decides whether an interface reads correctly:
 * the darkest color makes a sensible background in a dark UI, the lightest
 * makes readable text on it, and the most chromatic mid-tone is what the eye
 * takes as "the brand". Ordering by lightness is only meaningful in a
 * perceptually uniform space — this is the concrete payoff of the engine being
 * OKLCH throughout rather than HSL.
 *
 * Pure: no DOM, no React, no color parsing of unknown strings. Callers hand in
 * already-parsed OKLCH values so this module never has to fail on bad input.
 */

import { contrastRatio, formatHex, parseColor, type Oklch } from '@/lib/color-engine';

export type SemanticRole =
  | 'background'
  | 'surface'
  | 'primary'
  | 'text'
  | 'accent'
  | 'border'
  | 'onPrimary'
  | 'onAccent';

export const SEMANTIC_ROLES: readonly SemanticRole[] = [
  'background',
  'surface',
  'primary',
  'text',
  'accent',
  'border',
  'onPrimary',
  'onAccent',
];

/** The two roles that are INK ON A FILL rather than colours of their own. */
export const INK_ROLES: readonly SemanticRole[] = ['onPrimary', 'onAccent'];

export interface RoleColor {
  readonly hex: string;
  readonly oklch: Oklch;
}

export type RoleAssignment = Readonly<Record<SemanticRole, RoleColor>>;

/** Manual overrides win over the derived mapping, per role. */
export type RoleOverrides = Partial<Record<SemanticRole, RoleColor>>;

/**
 * A dark-UI fallback used to fill any role a palette is too small to supply.
 * Deliberately neutral: a palette of one brand color should produce a usable
 * interface around that color rather than six tinted variations of it, which
 * is what naive "just reuse the nearest color" filling produces.
 */
const FALLBACK: RoleAssignment = {
  background: neutral('#0B0B0C'),
  surface: neutral('#17171A'),
  primary: neutral('#7C5CFF'),
  text: neutral('#F2F2F5'),
  accent: neutral('#FFB454'),
  // #2A2A30 measured 1.25:1 against this surface and 1.38:1 against this
  // background — an edge nobody could see, on the set that fills in whenever a
  // palette is too small to supply one. #6B6B72 keeps the hue and clears 3:1
  // on both (3.38 and 3.72).
  border: neutral('#6B6B72'),
  // Placeholders only: `deriveRoles` recomputes both inks from their final
  // fill, so these are never what ends up on screen. Kept in step with
  // INK_LIGHT/INK_DARK below so the table cannot drift into a lie.
  onPrimary: neutral('#FFFFFF'),
  onAccent: neutral('#000000'),
};

/**
 * The two inks a fill can carry.
 *
 * Deliberately the extremes — and the dark one has to be an ACTUAL extreme.
 *
 * It was `#0A0A0B`, chosen as a softer near-black. That colour is not near
 * black where it counts: it parses to OKLCH lightness 0.145, and the gap it
 * gives up at the bottom is exactly what the mid-tones needed. Swept across
 * every in-gamut fill, `#FFFFFF`/`#0A0A0B` leaves **2.1% of them unservable** —
 * a band around lightness 0.55-0.61 where neither ink clears 4.5:1, bottoming
 * out at 4.4486:1. Not an exotic corner either: plain `#3E7CB1`, a mid blue,
 * lands at 4.4506:1, so the audit reported a failure on the one pair this
 * whole model promises cannot fail.
 *
 * With `#000000` the worst case over the same sweep is 4.5826:1 and nothing
 * falls below the bar — the guarantee is real rather than nearly real. The
 * cost is a label that is properly black instead of almost black, on a filled
 * control, which is what every design system ships anyway.
 *
 * That guarantee is what makes the contrast matrix satisfiable at all: a label
 * on a button can always be made legible, which was impossible while one
 * shared `text` had to read on the page, the panel AND both fills at once.
 */
const INK_LIGHT = neutral('#FFFFFF');
const INK_DARK = neutral('#000000');

/**
 * The ink this fill can actually carry.
 *
 * Not taken from the palette. A label on a filled control is not a colour
 * anyone chooses — it is whichever of the two extremes the fill can support,
 * and picking it any other way is how buttons end up with unreadable text.
 */
export function inkOn(fill: RoleColor): RoleColor {
  const light = contrastRatio(INK_LIGHT.oklch, fill.oklch);
  const dark = contrastRatio(INK_DARK.oklch, fill.oklch);
  return light >= dark ? INK_LIGHT : INK_DARK;
}

/**
 * Derives the OKLCH from the hex rather than letting the two be written out
 * side by side.
 *
 * They were written side by side, and every one of the six had drifted apart:
 * `accent` claimed `#FFB454` while its OKLCH was the visibly different
 * `#F5B75B`, and `primary` `#7C5CFF` against `#7F6AFC`. That split matters
 * because the two fields are read by different consumers — `rolesToCssVars`
 * paints from `hex` while the contrast audit and CVD simulation compute from
 * `oklch` — so a fallback role was graded against a color the screen was not
 * showing. Deriving one from the other makes the pair unable to disagree.
 */
function neutral(hex: string): RoleColor {
  return { hex, oklch: parseColor(hex) };
}

/** How far a colliding fallback is nudged in OKLCH lightness per attempt. */
const FALLBACK_NUDGE_L = 0.03;
/**
 * Six roles means at most five colors are already claimed when any one
 * fallback resolves, so six candidate lightnesses always contain a free one.
 * Doubled for headroom; see `claimFallback`.
 */
const FALLBACK_NUDGE_ATTEMPTS = 12;

/**
 * Tracks which colors a derivation has already handed out, so no two roles
 * can resolve to the same value.
 *
 * Comparison is on the lowercased hex because the two sources disagree on
 * case: `formatHex` (and therefore every derived color) emits lowercase,
 * while the fallback table and colors collected from other tabs are
 * uppercase. Comparing raw strings would let `#7C5CFF` and `#7c5cff` both be
 * assigned and report as distinct.
 */
class ClaimedColors {
  private readonly taken = new Set<string>();

  has(color: RoleColor): boolean {
    return this.taken.has(color.hex.toLowerCase());
  }

  claim(color: RoleColor): RoleColor {
    this.taken.add(color.hex.toLowerCase());
    return color;
  }
}

/**
 * Deterministic ordering: lightness first, hex as the tie-break.
 *
 * The tie-break is what makes the mapping genuinely order-independent. Array
 * sort is stable, so ordering on lightness alone leaves colors of *equal*
 * lightness in input order — and then the same three colors collected in a
 * different sequence produce a different interface, which is the exact failure
 * this module exists to prevent.
 */
function byLightnessThenHex(a: RoleColor, b: RoleColor): number {
  if (a.oklch.l !== b.oklch.l) return a.oklch.l - b.oklch.l;
  return a.hex.toLowerCase().localeCompare(b.hex.toLowerCase());
}

function byChromaThenHex(a: RoleColor, b: RoleColor): number {
  if (a.oklch.c !== b.oklch.c) return b.oklch.c - a.oklch.c;
  return a.hex.toLowerCase().localeCompare(b.hex.toLowerCase());
}

function dedupeByHex(palette: readonly RoleColor[]): RoleColor[] {
  const seen = new Set<string>();
  const out: RoleColor[] = [];
  for (const color of palette) {
    const key = color.hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(color);
  }
  return out;
}

/**
 * Derives a full role assignment from a palette.
 *
 * With enough colors the mapping is: darkest → background, lightest → text,
 * most chromatic remaining → primary, second-most → accent, the leftover
 * nearest the background in lightness → surface, and the least chromatic of
 * what is still unclaimed → border.
 *
 * **Every role resolves to a distinct color.** Each role claims a color out
 * of the pool, and a role the palette can no longer supply falls back to the
 * neutral set above rather than reusing a color another role already holds.
 * Without the claiming, palettes of two to five colors — which is what
 * designers actually collect — handed the same color to two roles: at three
 * colors `surface` and `primary` came out identical, so a card and the page
 * behind it were the same tan and text on them measured 1.19:1.
 *
 * Manual overrides are exempt: they are applied after derivation and are not
 * forced apart, because assigning one color to two roles on purpose is a
 * legitimate choice and not this function's to overrule.
 */
export function deriveRoles(
  palette: readonly RoleColor[],
  overrides: RoleOverrides = {}
): RoleAssignment {
  const derived = deriveFromPalette(palette);
  // Overrides are applied last so a manual choice is never recomputed away.
  const assigned = { ...derived, ...stripUndefined(overrides) };

  /*
   * AN INK FOLLOWS ITS FILL — INCLUDING WHEN AN OVERRIDE MOVES THE FILL.
   *
   * The inks were computed inside `deriveFromPalette`, from the fills the
   * PALETTE produced, and then overrides were spread over the top. So
   * reassigning `accent` swapped the fill and left the previous fill's ink
   * sitting on it. Measured in the visualizer: overriding accent to #7f7f85
   * kept `onAccent` at #FFFFFF and the label landed at 3.98:1, while `inkOn`
   * on the actual accent gives #0A0A0B at 4.97:1. The room then offered an
   * "auto-fix" for a role that is supposed to be unfailable by construction.
   *
   * That is not a rounding error, it is the guarantee this whole role model
   * rests on: a fill carries its own ink, which is what makes the contrast
   * matrix satisfiable at all. An ink computed from a colour that is no longer
   * on screen is not an ink, it is a leftover.
   *
   * Recomputed here, last, from whatever the fill finally is. Deliberately
   * NOT overridable: unlike every other role, an ink is not a choice. It is
   * whichever of white and near-black the fill can carry, and the reason
   * `inkOn` exists is that picking it any other way is how buttons end up
   * with unreadable labels. Honouring an `onAccent` override — from the UI or
   * from a hand-edited URL — would reopen exactly that door.
   */
  return { ...assigned, onPrimary: inkOn(assigned.primary), onAccent: inkOn(assigned.accent) };
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
  const pool = dedupeByHex(palette).sort(byLightnessThenHex);
  const claimed = new ClaimedColors();

  const take = (color: RoleColor): RoleColor => {
    pool.splice(pool.indexOf(color), 1);
    return claimed.claim(color);
  };

  // A single color can serve as background *or* text, never both — a
  // one-color palette should read as "this brand color on a neutral UI",
  // so the color is left in the pool for `primary` to claim below.
  const hasExtremes = pool.length >= 2;
  const background = hasExtremes ? take(pool[0]!) : claimFallback('background', claimed);
  const text = hasExtremes ? take(pool[pool.length - 1]!) : claimFallback('text', claimed);

  // "The brand color" is the most chromatic one — the color a viewer would
  // name if asked what this palette *is*. The lightness extremes are already
  // claimed above, so they are excluded from this without a second rule.
  const byChroma = [...pool].sort(byChromaThenHex);
  const primary = byChroma[0] !== undefined ? take(byChroma[0]) : claimFallback('primary', claimed);
  const accent = byChroma[1] !== undefined ? take(byChroma[1]) : claimFallback('accent', claimed);

  // Surface is the panel the background carries, so of what is left it should
  // be the color nearest the background — the smallest step up off the page.
  const nearestToBackground = [...pool].sort(
    (a, b) =>
      Math.abs(a.oklch.l - background.oklch.l) - Math.abs(b.oklch.l - background.oklch.l) ||
      byLightnessThenHex(a, b)
  )[0];
  const surface =
    nearestToBackground !== undefined
      ? take(nearestToBackground)
      : claimFallback('surface', claimed);

  // Border is structure, not color: the quietest thing still unclaimed.
  const leastChromatic = [...pool].sort(byChromaThenHex).pop();
  const border =
    leastChromatic !== undefined ? take(leastChromatic) : claimFallback('border', claimed);

  /*
   * The inks are DERIVED, never claimed from the pool.
   *
   * They are a consequence of the fills, not members of the palette: taking
   * them from the pool would mean a label whose legibility depends on what
   * happened to be left over.
   */
  return {
    background,
    surface,
    primary,
    text,
    accent,
    border,
    onPrimary: inkOn(primary),
    onAccent: inkOn(accent),
  };
}

/**
 * Hands back the neutral fallback for a role, or — if the palette happens to
 * contain that exact neutral and another role already holds it — the nearest
 * lightness to it that nobody has taken.
 *
 * The nudge keeps hue and chroma, so a substituted `border` is still a
 * neutral border and not some unrelated color borrowed from elsewhere in the
 * table. It cannot run out: at most five colors are claimed before any single
 * fallback resolves, and each attempt produces a distinct lightness.
 */
function claimFallback(role: SemanticRole, claimed: ClaimedColors): RoleColor {
  const base = FALLBACK[role];
  if (!claimed.has(base)) return claimed.claim(base);

  for (let step = 1; step <= FALLBACK_NUDGE_ATTEMPTS; step++) {
    for (const direction of [1, -1]) {
      const l = clamp01(base.oklch.l + direction * step * FALLBACK_NUDGE_L);
      const oklch: Oklch = { ...base.oklch, l };
      const candidate: RoleColor = { hex: formatHex(oklch), oklch };
      if (!claimed.has(candidate)) return claimed.claim(candidate);
    }
  }

  /* c8 ignore next 2 -- unreachable: 24 candidate lightnesses, ≤5 claimed */
  return base;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
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
    // The ink each fill carries. Without these a filled control has no legible
    // label to reach for, and the role would exist only in the audit.
    '--ui-on-primary': roles.onPrimary.hex,
    '--ui-on-accent': roles.onAccent.hex,
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
