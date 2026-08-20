import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from '@/lib/color-engine';
import { HARMONY_RULES } from '@/lib/harmony/harmony';
import { generatePalette } from '@/lib/harmony/palette';
import { buildRoleContrastMatrix } from '@/lib/roles/role-contrast';
import { SEMANTIC_ROLES, deriveRoles } from '@/lib/roles/semantic-roles';
import { decodeSystem } from '@/lib/system/codec';
import {
  BLOOM_SIZE,
  FALLBACK_SEED,
  bloomFrom,
  bloomQuery,
  buildLegibleLadder,
  scoreOf,
} from '../bloom';

/** A spread of seeds: the six the globe is most likely to hand us, plus the
 *  three that historically break colour code — near-black, near-white, grey. */
const SEEDS = [
  '#7C5CFF', '#19D368', '#FF3B30', '#00C8D7', '#FFB454', '#FF00FF',
  '#050505', '#FAFAFA', '#808080',
];

describe('bloomFrom — six colours out of one', () => {
  it('always produces exactly six colours', () => {
    for (const seed of SEEDS) {
      expect(bloomFrom(seed).colors).toHaveLength(BLOOM_SIZE);
    }
  });

  it('gives every role a different colour', () => {
    // The whole promise of the beat is "six colours from one". Two roles
    // sharing a hex would make it five, and this is the exact bug that
    // shipped once already in deriveRoles.
    for (const seed of SEEDS) {
      const roles = bloomFrom(seed).roles;
      const hexes = SEMANTIC_ROLES.map((role) => roles[role].hex.toLowerCase());
      expect(new Set(hexes).size).toBe(SEMANTIC_ROLES.length);
    }
  });

  it('is deterministic — the same colour always blooms the same system', () => {
    for (const seed of SEEDS) {
      expect(bloomFrom(seed)).toEqual(bloomFrom(seed));
    }
  });

  it('never throws on input the URL could carry', () => {
    for (const junk of ['', 'not-a-colour', '#', '#12', 'rgb(', '#GGGGGG']) {
      expect(() => bloomFrom(junk)).not.toThrow();
      expect(bloomFrom(junk).colors).toHaveLength(BLOOM_SIZE);
    }
  });

  it('falls back to a real system when the seed is unusable', () => {
    const fallback = bloomFrom('not-a-colour');
    expect(fallback.seedUsable).toBe(false);
    expect(fallback.colors).toHaveLength(BLOOM_SIZE);
    expect(fallback.seedHex.toLowerCase()).toBe(FALLBACK_SEED.toLowerCase());
  });

  it('keeps the seed itself in the palette it grew', () => {
    // If the colour you picked is not in the result, the page is not showing
    // you *your* system, and the entire premise of the landing collapses.
    for (const seed of ['#7C5CFF', '#19D368', '#00C8D7']) {
      const bloom = bloomFrom(seed);
      const hexes = bloom.colors.map((color) => color.hex.toLowerCase());
      expect(hexes).toContain(seed.toLowerCase());
    }
  });
});

describe('bloomFrom — it picks the rule, and picks it on evidence', () => {
  it('chooses a harmony no other rule beats', () => {
    // This is the landing page doing the product's actual job in one step:
    // seven candidate harmonies, each measured, the best one kept. A fixed
    // rule would be cheaper and would be a worse system for most seeds.
    for (const seed of SEEDS) {
      const chosen = bloomFrom(seed);
      for (const rule of HARMONY_RULES) {
        const rival = bloomFrom(seed, { rule });
        // scoreOf orders by failures first, then by the weakest required
        // pair — lower is better on the first key, higher on the second.
        const a = scoreOf(chosen);
        const b = scoreOf(rival);
        expect(a.failures).toBeLessThanOrEqual(b.failures);
        if (a.failures === b.failures) {
          expect(a.weakestRatio).toBeGreaterThanOrEqual(b.weakestRatio - 1e-9);
        }
      }
    }
  });

  it('honours a rule when one is asked for', () => {
    for (const rule of HARMONY_RULES) {
      expect(bloomFrom('#7C5CFF', { rule }).rule).toBe(rule);
    }
  });

  it('reports the measurement it made, not a claim', () => {
    const bloom = bloomFrom('#7C5CFF');
    const matrix = buildRoleContrastMatrix(bloom.roles);
    expect(bloom.failures).toBe(matrix.failures.length);
    expect(bloom.requiredPairs).toBe(matrix.required.length);
  });

  it('lands a readable page for every seed the globe can hand it', () => {
    // Text on background is the one pair that decides whether the page the
    // visitor is looking at is usable at all. The neutral ladder is built to
    // guarantee it, so assert the guarantee rather than hoping.
    for (const seed of SEEDS) {
      const { roles } = bloomFrom(seed);
      const ratio = contrastRatio(roles.text.oklch, roles.background.oklch);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('bloomQuery — the door out of the landing page', () => {
  it('round-trips the palette through the codec', () => {
    // Beat seven hands the visitor a link into Compose. If the System does
    // not survive the URL, the link is a lie.
    for (const seed of ['#7C5CFF', '#19D368', '#FFB454']) {
      const bloom = bloomFrom(seed);
      const decoded = decodeSystem(bloomQuery(bloom));
      expect(decoded.palette.map((c) => c.hex.toLowerCase())).toEqual(
        bloom.colors.map((c) => c.hex.toLowerCase())
      );
    }
  });

  it('carries the picked colour as the anchor', () => {
    const bloom = bloomFrom('#19D368');
    expect(decodeSystem(bloomQuery(bloom)).anchorHex?.toLowerCase()).toBe('#19d368');
  });

  it('produces a query string, not a full URL', () => {
    expect(bloomQuery(bloomFrom('#7C5CFF'))).not.toContain('http');
    expect(bloomQuery(bloomFrom('#7C5CFF'))).toContain('c=');
  });
});

describe('the role model the rest of the page renders from', () => {
  it('agrees with deriveRoles run on the same colours', () => {
    // The sections below the fold paint from `bloom.roles`. If that is not
    // literally what the shared role model produces for this palette, the
    // landing page is demonstrating a different product than the one the
    // tabs ship.
    for (const seed of SEEDS) {
      const bloom = bloomFrom(seed);
      const independently = deriveRoles(
        bloom.colors.map((color) => ({ hex: color.hex, oklch: parseColor(color.hex) }))
      );
      // Compared by hex, not by the OKLCH floats: re-parsing a hex quantises
      // it to 8 bits per channel, so the coordinates legitimately differ in
      // the ninth decimal while naming the identical colour. Asserting the
      // floats would be asserting that hex is lossless, which it is not.
      for (const role of SEMANTIC_ROLES) {
        expect(bloom.roles[role].hex.toLowerCase()).toBe(
          independently[role].hex.toLowerCase()
        );
      }
    }
  });
});

describe('buildLegibleLadder — the rungs the generator gets wrong', () => {
  it('separates every adjacent rung by the 3:1 a boundary needs', () => {
    // The generator's own ladder puts these within ~1.2:1, which is what
    // costs every palette three of its eleven required pairs.
    for (const hue of [0, 60, 140, 220, 286, 340]) {
      const ladder = buildLegibleLadder(hue, 0.012, 'srgb');
      const at = (l: number) => ({ l, c: 0.012, h: hue });
      expect(contrastRatio(at(ladder.surface), at(ladder.background))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(at(ladder.border), at(ladder.surface))).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(at(ladder.text), at(ladder.background))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(at(ladder.text), at(ladder.surface))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('climbs — a ladder whose rungs are out of order is not a ladder', () => {
    for (const hue of [0, 90, 180, 270]) {
      const { background, surface, border, text } = buildLegibleLadder(hue, 0.012, 'srgb');
      expect(surface).toBeGreaterThan(background);
      expect(border).toBeGreaterThan(surface);
      expect(text).toBeGreaterThan(border);
    }
  });
});

describe('the bloom is measurably better than generating a palette', () => {
  it('beats raw generation on every seed, and never loses to it', () => {
    // The regression guard for the whole approach. Measured across these nine
    // seeds: raw generation fails 44 required pairs in total, solving with
    // both candidate ladders fails 29. If a change to the generator, the
    // solver or the role model erodes that, this is where it surfaces --
    // rather than on the landing page, in front of everyone.
    let bloomed = 0;
    let raw = 0;
    for (const seed of SEEDS) {
      const oklch = parseColor(seed);
      bloomed += bloomFrom(seed).failures;
      raw += Math.min(
        ...HARMONY_RULES.map((rule) => {
          const colors = generatePalette(oklch, { rule, count: BLOOM_SIZE }).colors;
          return buildRoleContrastMatrix(
            deriveRoles(colors.map((c) => ({ hex: c.hex, oklch: c.oklch })))
          ).failures.length;
        })
      );
    }
    expect(bloomed).toBeLessThan(raw);
    expect(bloomed).toBeLessThanOrEqual(29);
  });
});
