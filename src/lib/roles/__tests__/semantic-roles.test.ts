import { describe, expect, it } from 'vitest';
import { contrastRatio, formatHex, isInGamut, parseColor } from '@/lib/color-engine';
import {
  INK_ROLES,
  SEMANTIC_ROLES,
  deriveRoles,
  flipPolarity,
  inkOn,
  rolesToCssVars,
  type RoleColor,
  type SemanticRole,
} from '../semantic-roles';

function color(hex: string): RoleColor {
  return { hex, oklch: parseColor(hex) };
}

/** A realistic six-color brand palette, deliberately shuffled. */
const PALETTE: RoleColor[] = [
  color('#7C5CFF'), // vivid violet — should read as primary
  color('#0B0B0C'), // near-black — darkest
  color('#F2F2F5'), // near-white — lightest
  color('#FFB454'), // vivid amber — second most chromatic
  color('#17171A'), // dark grey
  color('#2A2A30'), // slightly lighter grey
];

describe('deriveRoles', () => {
  it('always returns every semantic role', () => {
    const roles = deriveRoles(PALETTE);
    for (const role of SEMANTIC_ROLES) {
      expect(roles[role]).toBeDefined();
      expect(roles[role].hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('puts the darkest color on background and the lightest on text', () => {
    const roles = deriveRoles(PALETTE);
    expect(roles.background.hex).toBe('#0B0B0C');
    expect(roles.text.hex).toBe('#F2F2F5');
  });

  it('picks the most chromatic mid-tone as primary, not the most saturated overall', () => {
    const roles = deriveRoles(PALETTE);
    expect(roles.primary.hex).toBe('#7C5CFF');
    expect(roles.accent.hex).toBe('#FFB454');
  });

  it('is order-independent — shuffling the input cannot change the mapping', () => {
    const shuffled = [...PALETTE].reverse();
    expect(deriveRoles(shuffled)).toEqual(deriveRoles(PALETTE));
  });

  it('produces a readable text/background pair', () => {
    const roles = deriveRoles(PALETTE);
    // The whole point of lightness-ordering: these two must be far apart.
    expect(Math.abs(roles.text.oklch.l - roles.background.oklch.l)).toBeGreaterThan(0.5);
  });
});

/**
 * The invariant the original tests were missing.
 *
 * They asserted every role was *defined* — which it always was, because the
 * fallback filled the gaps — and never that the roles were *distinct*. So a
 * derivation that handed the same tan to `surface` and `primary` passed a
 * green suite while dissolving the visualizer's cards into their own
 * background on screen. Every assertion below fails against that version.
 */
describe('deriveRoles — every role resolves to a distinct color', () => {
  /**
   * The three colors from the live report, in collection order. Chosen
   * because they are unremarkable — a violet, a green and a tan, no near
   * duplicates — so any collision is the algorithm's, not the palette's.
   */
  const COLLECTED = ['#5A3F73', '#19D368', '#CFA15D', '#0B0B0C', '#F2F2F5', '#2A2A30'];

  /*
   * Distinctness is asked of the PALETTE roles, not of the inks.
   *
   * `onPrimary` and `onAccent` are whichever of white and near-black their
   * fill can carry. Two light fills legitimately share the same dark ink, and
   * an ink legitimately equals `text` when the text is also near-white —
   * demanding they differ would be demanding an unreadable label.
   */
  const PALETTE_ROLES = SEMANTIC_ROLES.filter((role) => !INK_ROLES.includes(role));

  function collisions(roles: ReturnType<typeof deriveRoles>): string[] {
    const byHex = new Map<string, SemanticRole[]>();
    for (const role of PALETTE_ROLES) {
      const hex = roles[role].hex.toLowerCase();
      byHex.set(hex, [...(byHex.get(hex) ?? []), role]);
    }
    return [...byHex.entries()]
      .filter(([, held]) => held.length > 1)
      .map(([hex, held]) => `${held.join('+')} all resolved to ${hex}`);
  }

  // Sizes 1–6 individually, so a failure names the palette size that broke.
  for (let size = 1; size <= 6; size++) {
    it(`assigns six different colors for a ${size}-color palette`, () => {
      const roles = deriveRoles(COLLECTED.slice(0, size).map(color));
      expect(collisions(roles)).toEqual([]);
      expect(new Set(PALETTE_ROLES.map((r) => roles[r].hex.toLowerCase())).size).toBe(
        PALETTE_ROLES.length
      );
    });
  }

  it('stays distinct for an empty palette', () => {
    expect(collisions(deriveRoles([]))).toEqual([]);
  });

  it('stays distinct whatever order the colors were collected in', () => {
    // Order-independence and distinctness are the same guarantee from two
    // sides: a mapping that changes with input order will collide for some
    // orders and not others, and pass intermittently.
    for (let size = 1; size <= 6; size++) {
      const base = COLLECTED.slice(0, size);
      for (const permuted of [base, [...base].reverse(), [...base].sort()]) {
        expect(collisions(deriveRoles(permuted.map(color)))).toEqual([]);
      }
    }
  });

  it('stays distinct when the palette contains the neutral fallbacks themselves', () => {
    // The one case the fallback table cannot fill naively: the palette
    // already holds the exact color a role would fall back to.
    const roles = deriveRoles([color('#0B0B0C'), color('#17171A'), color('#2A2A30')]);
    expect(collisions(roles)).toEqual([]);
  });

  it('stays distinct when the same color is collected twice in different case', () => {
    const roles = deriveRoles([color('#5A3F73'), color('#5a3f73'), color('#19D368')]);
    expect(collisions(roles)).toEqual([]);
  });

  it('keeps text legible against surface at three colors', () => {
    // The live consequence of the collision: surface took primary's tan, and
    // text on a card measured 1.19:1 — invisible. Not a full contrast
    // guarantee (no palette can promise that), just a floor that the two
    // roles are no longer the same color wearing two hats.
    const roles = deriveRoles(COLLECTED.slice(0, 3).map(color));
    expect(contrastRatio(roles.text.oklch, roles.surface.oklch)).toBeGreaterThan(4.5);
  });

  it('still gives the palette its own colors before reaching for fallbacks', () => {
    // Distinctness must not be bought by ignoring the palette: with six
    // colors every role is a collected one, and nothing neutral leaks in.
    const supplied = new Set(COLLECTED.map((hex) => hex.toLowerCase()));
    const roles = deriveRoles(COLLECTED.map(color));
    // The inks are excluded on purpose: they are white or near-black by
    // derivation, so requiring them to come from the palette would require the
    // palette to contain one of those, which has nothing to do with this rule.
    for (const role of PALETTE_ROLES) {
      expect(supplied.has(roles[role].hex.toLowerCase())).toBe(true);
    }
  });
});

describe('deriveRoles — degenerate palettes', () => {
  it('returns a complete usable set for an empty palette', () => {
    const roles = deriveRoles([]);
    for (const role of SEMANTIC_ROLES) expect(roles[role]).toBeDefined();
  });

  it('never uses a single color as both background and text', () => {
    const roles = deriveRoles([color('#7C5CFF')]);
    expect(roles.background.hex).not.toBe(roles.text.hex);
    // The one supplied color should still be the brand.
    expect(roles.primary.hex).toBe('#7C5CFF');
  });

  it('keeps background and text distinct even when every color is the same lightness', () => {
    const flat = [color('#FF0000'), color('#00FF00'), color('#0000FF')];
    const roles = deriveRoles(flat);
    expect(roles.background.hex).not.toBe(roles.text.hex);
  });

  it('handles a two-color palette without leaving a role empty', () => {
    const roles = deriveRoles([color('#000000'), color('#FFFFFF')]);
    expect(roles.background.hex).toBe('#000000');
    expect(roles.text.hex).toBe('#FFFFFF');
    for (const role of SEMANTIC_ROLES) expect(roles[role].hex).toBeTruthy();
  });
});

describe('deriveRoles — manual overrides', () => {
  it('lets a manual choice win over the derived mapping', () => {
    const roles = deriveRoles(PALETTE, { primary: color('#19D368') });
    expect(roles.primary.hex).toBe('#19D368');
    // Everything else still derived.
    expect(roles.background.hex).toBe('#0B0B0C');
  });

  it('ignores explicitly-undefined overrides rather than blanking the role', () => {
    const roles = deriveRoles(PALETTE, { primary: undefined });
    expect(roles.primary.hex).toBe('#7C5CFF');
  });

  it('can override every role that is a choice, all at once', () => {
    const all = Object.fromEntries(SEMANTIC_ROLES.map((r) => [r, color('#123456')]));
    const roles = deriveRoles(PALETTE, all);
    for (const role of SEMANTIC_ROLES) {
      if (INK_ROLES.includes(role)) continue;
      expect(roles[role].hex).toBe('#123456');
    }
  });

  /*
   * An ink is not a choice, so it does not take an override — from the UI or
   * from a hand-edited URL. See `deriveRoles`.
   */
  it('refuses an ink override and keeps the ink its fill can carry', () => {
    const roles = deriveRoles(PALETTE, {
      onPrimary: color('#123456'),
      onAccent: color('#123456'),
    });
    expect(roles.onPrimary.hex).not.toBe('#123456');
    expect(roles.onAccent.hex).not.toBe('#123456');
    expect(roles.onPrimary).toEqual(inkOn(roles.primary));
    expect(roles.onAccent).toEqual(inkOn(roles.accent));
  });

  it('moves the ink when an override moves the fill under it', () => {
    /*
     * The concrete regression: overriding accent left `onAccent` as the ink
     * derived for the PREVIOUS accent. #FFFFFF on #7f7f85 measured 3.98:1 and
     * the visualizer offered an auto-fix for a pair that cannot fail.
     */
    const roles = deriveRoles(PALETTE, { accent: color('#7F7F85') });
    expect(roles.accent.hex).toBe('#7F7F85');
    expect(roles.onAccent).toEqual(inkOn(roles.accent));
    expect(contrastRatio(roles.onAccent.oklch, roles.accent.oklch)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps both ink pairs above AA for every fill an override can name', () => {
    /*
     * The whole sRGB gamut, not a line through it. The band where the two inks
     * trade places sits around lightness 0.55-0.61 and it is chroma-dependent,
     * so a sweep of greys walks straight past the failure: #3E7CB1, an
     * unremarkable mid blue, was the case that broke this.
     */
    let worst = Infinity;
    let worstFill = '';
    for (let l = 0.45; l <= 0.72; l += 0.005) {
      for (let c = 0; c <= 0.3; c += 0.02) {
        for (let h = 0; h < 360; h += 15) {
          const oklch = { l, c, h };
          if (!isInGamut(oklch, 'srgb')) continue;
          const fill = { hex: formatHex(oklch), oklch };
          const roles = deriveRoles(PALETTE, { primary: fill, accent: fill });
          const onP = contrastRatio(roles.onPrimary.oklch, roles.primary.oklch);
          const onA = contrastRatio(roles.onAccent.oklch, roles.accent.oklch);
          if (Math.min(onP, onA) < worst) {
            worst = Math.min(onP, onA);
            worstFill = fill.hex;
          }
        }
      }
    }
    expect(worst, `worst fill was ${worstFill}`).toBeGreaterThanOrEqual(4.5);
  });

  it('carries the mid blue that used to fail', () => {
    // 4.4506:1 while the dark ink was #0A0A0B, which is lightness 0.145 and
    // therefore not an extreme at all.
    const fill = { hex: '#3E7CB1', oklch: parseColor('#3E7CB1') };
    const roles = deriveRoles(PALETTE, { accent: fill });
    expect(contrastRatio(roles.onAccent.oklch, roles.accent.oklch)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('deriveRoles — the fallback set agrees with itself', () => {
  /**
   * `hex` and `oklch` are read by different consumers: `rolesToCssVars` paints
   * from the hex while the contrast audit and the CVD simulation compute from
   * the OKLCH. When the fallback table carried both as hand-written literals
   * they had all six drifted apart — `accent` was `#FFB454` as a hex and
   * `#F5B75B` as an OKLCH — so a fallback role was audited against a color
   * that was never on screen. These pin the two together.
   */
  const FALLBACK_ROLES = deriveRoles([]);

  for (const role of SEMANTIC_ROLES) {
    it(`round-trips ${role} between hex and oklch`, () => {
      expect(formatHex(FALLBACK_ROLES[role].oklch)).toBe(FALLBACK_ROLES[role].hex.toLowerCase());
    });
  }

  it('holds for palette colors too, not just fallbacks', () => {
    // Palette colors arrive already paired by the caller, so this is really a
    // guard on the derivation never rebuilding one field without the other.
    const roles = deriveRoles([color('#5A3F73'), color('#19D368'), color('#CFA15D')]);
    for (const role of SEMANTIC_ROLES) {
      expect(formatHex(roles[role].oklch)).toBe(roles[role].hex.toLowerCase());
    }
  });

  it('survives a polarity flip', () => {
    const flipped = flipPolarity(deriveRoles([]));
    for (const role of SEMANTIC_ROLES) {
      expect(formatHex(flipped[role].oklch)).toBe(flipped[role].hex.toLowerCase());
    }
  });
});

describe('rolesToCssVars', () => {
  it('emits one custom property per role', () => {
    const vars = rolesToCssVars(deriveRoles(PALETTE));
    expect(Object.keys(vars)).toHaveLength(SEMANTIC_ROLES.length);
    expect(vars['--ui-background']).toBe('#0B0B0C');
    expect(vars['--ui-primary']).toBe('#7C5CFF');
  });
});

describe('flipPolarity', () => {
  it('inverts background and text lightness', () => {
    const roles = deriveRoles(PALETTE);
    const flipped = flipPolarity(roles);
    expect(flipped.background.oklch.l).toBeCloseTo(1 - roles.background.oklch.l, 6);
    expect(flipped.text.oklch.l).toBeCloseTo(1 - roles.text.oklch.l, 6);
  });

  it('recomputes hex, not just the oklch field', () => {
    // Regression guard: mirroring `oklch` while carrying `hex` over unchanged
    // makes the flip a silent no-op, since rolesToCssVars emits hex.
    const roles = deriveRoles(PALETTE);
    const flipped = flipPolarity(roles);
    expect(flipped.background.hex).not.toBe(roles.background.hex);
    expect(flipped.text.hex).not.toBe(roles.text.hex);
    expect(rolesToCssVars(flipped)['--ui-background']).not.toBe(
      rolesToCssVars(roles)['--ui-background']
    );
  });

  it('leaves the brand colors untouched — the hue must survive the flip', () => {
    const roles = deriveRoles(PALETTE);
    const flipped = flipPolarity(roles);
    expect(flipped.primary).toEqual(roles.primary);
    expect(flipped.accent).toEqual(roles.accent);
  });

  it('still separates text from background after flipping', () => {
    const flipped = flipPolarity(deriveRoles(PALETTE));
    expect(Math.abs(flipped.text.oklch.l - flipped.background.oklch.l)).toBeGreaterThan(0.5);
  });

  it('round-trips back to the original lightness when applied twice', () => {
    const roles = deriveRoles(PALETTE);
    const twice = flipPolarity(flipPolarity(roles));
    expect(twice.background.oklch.l).toBeCloseTo(roles.background.oklch.l, 6);
    expect(twice.text.oklch.l).toBeCloseTo(roles.text.oklch.l, 6);
  });
});

/*
 * THE GUARANTEE, GENERALISED.
 *
 * `keeps text legible against surface at three colors` above asserted exactly
 * this, for exactly one palette, and the model did not hold it in general: a
 * five-colour palette handed `surface` whichever colour happened to be left
 * over, and a saturated green is not a panel. Measured on the live book,
 * text-on-surface came out 2.85:1 in dark and 2.17:1 in light — a failing
 * check the guideline correctly reported about its own interface.
 *
 * `inkOn` already establishes the principle for filled controls: a fill
 * carries an ink it can actually support, by construction rather than by luck.
 * A panel is the same promise. These pin it across palette sizes and both
 * polarities.
 */
describe('text is legible on surface, for every palette', () => {
  const PALETTES: readonly (readonly string[])[] = [
    ['#0a5cff', '#ff6b35', '#1b1b1f', '#f5f5f7', '#00a67e'],
    ['#0a5cff', '#ff6b35', '#1b1b1f'],
    ['#0a5cff', '#1b1b1f'],
    ['#0a5cff'],
    [],
    ['#7c5cff', '#22d3ee', '#facc15', '#0f172a', '#f8fafc', '#ec4899'],
    ['#808080', '#7f7f7f', '#818181'],
    ['#000000', '#ffffff'],
    ['#00a67e', '#00a67f', '#00a680'],
  ];

  const asColors = (hexes: readonly string[]) =>
    hexes.map((hex) => ({ hex, oklch: parseColor(hex) }));

  for (const hexes of PALETTES) {
    const label = hexes.length === 0 ? '(empty)' : hexes.join(' ');

    /*
     * CONDITIONAL, and the condition is the honest part. Some palettes cannot
     * hold text anywhere — three near-identical greys have no page/ink pair
     * that clears AA — and demanding a legible panel there would be demanding
     * the impossible. What the model CAN promise is that the panel is never
     * the weaker of the two: if the page holds text, the card does too.
     */
    it(`the panel holds text whenever the page does — ${label}`, () => {
      const roles = deriveRoles(asColors(hexes));
      const page = contrastRatio(roles.text.oklch, roles.background.oklch);
      if (page < 4.5) return;
      expect(contrastRatio(roles.text.oklch, roles.surface.oklch)).toBeGreaterThanOrEqual(4.5);
    });

    it(`the panel holds text whenever the page does, once flipped — ${label}`, () => {
      const roles = flipPolarity(deriveRoles(asColors(hexes)));
      const page = contrastRatio(roles.text.oklch, roles.background.oklch);
      if (page < 4.5) return;
      expect(contrastRatio(roles.text.oklch, roles.surface.oklch)).toBeGreaterThanOrEqual(4.5);
    });

    /*
     * Direction is chosen for LEGIBILITY first and convention second, which
     * is why this does not assert "the card is lighter in dark mode".
     *
     * The conventional card steps toward the ink — it lifts off a dark page,
     * settles into a light one. That costs contrast, and on a mid-tone page it
     * costs more than there is to spend, so the panel recedes instead. Black
     * text on a grey page gets a WHITE card rather than a darker one, which is
     * both legible and what a designer would have drawn anyway.
     *
     * What must hold in every case is that the panel is a panel: a colour of
     * its own, not the page wearing a second name. The original bug failed
     * this differently — the panel was distinct AND on the wrong side AND
     * illegible, at 2.17:1.
     */
    it(`the panel is never just the page again — ${label}`, () => {
      for (const roles of [deriveRoles(asColors(hexes)), flipPolarity(deriveRoles(asColors(hexes)))]) {
        expect(roles.surface.hex.toLowerCase()).not.toBe(roles.background.hex.toLowerCase());
      }
    });
  }
});
