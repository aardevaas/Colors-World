import { describe, expect, it } from 'vitest';
import { contrastRatio, isInGamut, parseColor, type Oklch } from '@/lib/color-engine';
import { deriveRoles } from '@/lib/roles/semantic-roles';
import { HARMONY_RULES } from '../harmony';
import { DEFAULT_NEUTRAL_LADDER, generatePalette } from '../palette';
import {
  DEFAULT_CONTRAST_TARGETS,
  describeShortfall,
  solvePalette,
  unmetFromMatrix,
  type ContrastTarget,
} from '../solver';
import { buildRoleContrastMatrix } from '@/lib/roles/role-contrast';
import { randomSeed } from '../seed';

const VIOLET: Oklch = parseColor('#7C5CFF');
const TAN: Oklch = parseColor('#CFA15D');
const GREEN: Oklch = parseColor('#19D368');
const SEEDS = [VIOLET, TAN, GREEN, parseColor('#FF0000'), parseColor('#0080FF')];

function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ratioFor(result: ReturnType<typeof solvePalette>, target: ContrastTarget): number {
  return contrastRatio(
    result.roles[target.foreground].oklch,
    result.roles[target.background].oklch
  );
}

describe('solvePalette — the problem it exists for', () => {
  it('fixes the invisible panel edge the generator leaves behind', () => {
    // Measured on the shipped generator: a border sitting one rung above its
    // surface lands around 1.5:1, well under the 3:1 WCAG asks of a component
    // boundary. Every generated palette flags it, and no amount of rolling
    // fixes it, because it is a property of the ladder rather than the seed.
    const target = DEFAULT_CONTRAST_TARGETS.find((t) => t.label === 'A visible panel edge')!;

    const unsolved = generatePalette(VIOLET, { ladder: DEFAULT_NEUTRAL_LADDER });
    const before = deriveRoles(unsolved.colors.map((c) => ({ hex: c.hex, oklch: c.oklch })));
    expect(contrastRatio(before.border.oklch, before.surface.oklch)).toBeLessThan(3);

    const solved = solvePalette(VIOLET);
    expect(ratioFor(solved, target)).toBeGreaterThanOrEqual(3);
  });

  it('meets every default target, for every rule and seed', () => {
    for (const rule of HARMONY_RULES) {
      for (const seed of SEEDS) {
        const result = solvePalette(seed, { rule });
        expect(result.status).toBe('solved');
        for (const target of DEFAULT_CONTRAST_TARGETS) {
          expect(ratioFor(result, target)).toBeGreaterThanOrEqual(target.min);
        }
      }
    }
  });

  it('holds across many random seeds, not just hand-picked ones', () => {
    const random = seededRandom(11);
    let solved = 0;
    for (let i = 0; i < 120; i++) {
      if (solvePalette(randomSeed(random)).status === 'solved') solved += 1;
    }
    expect(solved).toBe(120);
  });
});

describe('solvePalette — what it refuses to touch', () => {
  it('never moves the brand colors', () => {
    // Silently relighting someone's brand to win a contrast argument is help
    // nobody asked for. Only neutrals are the solver's to move.
    const result = solvePalette(VIOLET, { rule: 'triad', chroma: 'proportional' });
    const reference = generatePalette(VIOLET, { rule: 'triad', chroma: 'proportional' });

    const brandOf = (colors: readonly { origin: string; hex: string }[]) =>
      colors.filter((c) => c.origin === 'harmony').map((c) => c.hex);

    expect(brandOf(result.palette.colors)).toEqual(brandOf(reference.colors));
  });

  it('keeps every color inside the gamut while it searches', () => {
    for (const seed of SEEDS) {
      for (const color of solvePalette(seed).palette.colors) {
        expect(isInGamut(color.oklch, 'srgb')).toBe(true);
      }
    }
  });

  it('still returns the number of colors asked for', () => {
    for (const count of [3, 4, 5, 6, 7, 8]) {
      expect(solvePalette(VIOLET, { count }).palette.colors).toHaveLength(count);
    }
  });
});

describe('solvePalette — failing usefully', () => {
  // A solver that answers a hard question with a blank screen is worse than no
  // solver. These pin the behaviour that keeps it from becoming the most
  // frustrating surface in the product.
  const impossible: ContrastTarget[] = [
    { foreground: 'text', background: 'background', min: 21, label: 'Text on the page' },
    { foreground: 'text', background: 'surface', min: 21, label: 'Text on a panel' },
  ];

  it('returns a palette even when it cannot meet the request', () => {
    const result = solvePalette(VIOLET, { targets: impossible });
    expect(result.status).toBe('relaxed');
    expect(result.palette.colors.length).toBeGreaterThan(0);
    expect(result.unmet.length).toBeGreaterThan(0);
  });

  it('reports what it actually reached, not just that it failed', () => {
    const result = solvePalette(VIOLET, { targets: impossible });
    for (const entry of result.unmet) {
      expect(entry.achieved).toBeGreaterThan(1);
      expect(entry.shortfall).toBeCloseTo(entry.target.min - entry.achieved, 6);
    }
  });

  it('names the binding constraint in words a person can act on', () => {
    const result = solvePalette(VIOLET, { targets: impossible });
    const message = describeShortfall(result.unmet)!;
    expect(message).toMatch(/21\.0:1/);
    expect(message).toMatch(/Text on/i);
  });

  it('says nothing when there is nothing to report', () => {
    expect(describeShortfall([])).toBeNull();
  });

  it('gets as close as it can rather than giving up at the first failure', () => {
    // The impossible request still has a best answer, and it should beat the
    // untouched default rather than returning it unchanged.
    const result = solvePalette(VIOLET, { targets: impossible });
    const target = impossible[0]!;
    const baseline = generatePalette(VIOLET);
    const baselineRoles = deriveRoles(
      baseline.colors.map((c) => ({ hex: c.hex, oklch: c.oklch }))
    );
    expect(ratioFor(result, target)).toBeGreaterThanOrEqual(
      contrastRatio(baselineRoles.text.oklch, baselineRoles.background.oklch) - 1e-9
    );
  });

  it('does not spin forever on a target between two brand colors', () => {
    // Neither side is a neutral, so there is nothing the solver may move.
    const brandOnly: ContrastTarget[] = [
      { foreground: 'primary', background: 'accent', min: 21, label: 'Brand against brand' },
    ];
    const result = solvePalette(VIOLET, { targets: brandOnly });
    expect(result.status).toBe('relaxed');
    expect(result.steps).toBe(0);
  });
});

describe('solvePalette — behaviour', () => {
  it('is deterministic', () => {
    expect(solvePalette(TAN, { rule: 'analogous' })).toEqual(
      solvePalette(TAN, { rule: 'analogous' })
    );
  });

  it('does no work when the defaults already satisfy the request', () => {
    const easy: ContrastTarget[] = [
      { foreground: 'text', background: 'background', min: 2, label: 'Text on the page' },
    ];
    const result = solvePalette(VIOLET, { targets: easy });
    expect(result.status).toBe('solved');
    expect(result.steps).toBe(0);
    expect(result.ladder).toEqual(DEFAULT_NEUTRAL_LADDER);
  });

  it('reports the ladder it settled on, so the result is reproducible', () => {
    const result = solvePalette(VIOLET);
    const replay = generatePalette(VIOLET, { ladder: result.ladder });
    expect(replay.colors.map((c) => c.hex)).toEqual(result.palette.colors.map((c) => c.hex));
  });

  it('keeps neutrals inside a usable lightness band', () => {
    for (const seed of SEEDS) {
      const { ladder } = solvePalette(seed);
      for (const value of Object.values(ladder)) {
        expect(value).toBeGreaterThan(0.03);
        expect(value).toBeLessThan(0.99);
      }
    }
  });

  it('survives degenerate seeds', () => {
    for (const seed of [parseColor('#000000'), parseColor('#FFFFFF'), { l: 0.5, c: 0, h: 0 }]) {
      expect(() => solvePalette(seed)).not.toThrow();
      expect(solvePalette(seed).palette.colors.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The two rooms have to read off one instrument.
 *
 * `/compose` graded four hand-picked pairs and `/visualizer` graded eleven, so
 * the room that made a palette and the room that showed it could publish
 * different verdicts about the same System — both of them arithmetically
 * correct. These lock the adapter that made them agree.
 */
describe('unmetFromMatrix', () => {
  it('reports exactly the failures the matrix reports, and no others', () => {
    for (const seed of SEEDS) {
      const result = solvePalette(seed);
      const roles = deriveRoles(
        result.palette.colors.map((c) => ({ hex: c.hex, oklch: c.oklch }))
      );
      const matrix = buildRoleContrastMatrix(roles);
      const unmet = unmetFromMatrix(matrix);

      expect(unmet.length).toBe(matrix.failures.length);
      expect(unmet.map((u) => u.target.label)).toEqual(
        matrix.failures.map((f) => `${f.foreground} on ${f.background}`)
      );
    }
  });

  it('carries the achieved ratio and the distance below the bar', () => {
    const result = solvePalette(TAN);
    const roles = deriveRoles(
      result.palette.colors.map((c) => ({ hex: c.hex, oklch: c.oklch }))
    );
    const matrix = buildRoleContrastMatrix(roles);
    for (const entry of unmetFromMatrix(matrix)) {
      expect(entry.shortfall).toBeGreaterThan(0);
      expect(entry.achieved).toBeLessThan(entry.target.min);
      expect(entry.achieved + entry.shortfall).toBeCloseTo(entry.target.min, 10);
    }
  });

  it('gives describeShortfall a sentence that names a pair from the audit', () => {
    const result = solvePalette(GREEN);
    const roles = deriveRoles(
      result.palette.colors.map((c) => ({ hex: c.hex, oklch: c.oklch }))
    );
    const matrix = buildRoleContrastMatrix(roles);
    const unmet = unmetFromMatrix(matrix);
    const sentence = describeShortfall(unmet);

    if (unmet.length === 0) {
      expect(sentence).toBeNull();
      return;
    }
    expect(sentence).not.toBeNull();
    // Whatever it names has to be a row the room is also showing.
    const named = matrix.failures.some(
      (f) =>
        sentence!.toLowerCase().includes(`${f.foreground} on ${f.background}`.toLowerCase())
    );
    expect(named).toBe(true);
  });

  it('is empty exactly when the palette clears every requirement', () => {
    const clean = buildRoleContrastMatrix(
      deriveRoles([
        { hex: '#000000', oklch: parseColor('#000000') },
        { hex: '#595959', oklch: parseColor('#595959') },
        { hex: '#ABABAB', oklch: parseColor('#ABABAB') },
        { hex: '#D1D1D1', oklch: parseColor('#D1D1D1') },
      ])
    );
    expect(unmetFromMatrix(clean).length).toBe(clean.failures.length);
  });
});
