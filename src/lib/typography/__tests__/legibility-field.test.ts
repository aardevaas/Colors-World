import { describe, expect, it } from 'vitest';
import { parseColor, type Oklch } from '@/lib/color-engine';
import { WEIGHT_STEPS } from '../legibility';
import { FIELD_SIZES, buildLegibilityField, findExits } from '../legibility-field';

/** Comfortably above 4.5 — body text works anywhere. */
const STRONG: readonly [Oklch, Oklch] = [parseColor('#F2F2F5'), parseColor('#0B0B0C')];
/** Between 3 and 4.5 — the interesting case, and the only one with a frontier. */
const MIDDLING: readonly [Oklch, Oklch] = [parseColor('#19D368'), parseColor('#5A3F73')];
/** Under 3 — no way to set type rescues it. */
const HOPELESS: readonly [Oklch, Oklch] = [parseColor('#CFA15D'), parseColor('#C8A97A')];

function field(pair: readonly [Oklch, Oklch]) {
  return buildLegibilityField(pair[0], pair[1]);
}

describe('buildLegibilityField — shape', () => {
  it('covers every size against every weight', () => {
    const f = field(STRONG);
    expect(f.rows).toHaveLength(WEIGHT_STEPS.length);
    for (const row of f.rows) expect(row).toHaveLength(FIELD_SIZES.length);
  });

  it('carries one ratio for the whole field, because the colours never change', () => {
    // The single most losable idea in a grid like this: the field varies
    // because the *requirement* moves, not because the pair does.
    const f = field(MIDDLING);
    const required = new Set(f.rows.flat().map((c) => c.required));
    expect(required.size).toBeGreaterThan(1);
    expect(f.ratio).toBeGreaterThan(1);
  });

  it('plots sizes in ascending order whatever order they arrive in', () => {
    const f = buildLegibilityField(STRONG[0], STRONG[1], { sizes: [24, 12, 18] });
    expect(f.sizes).toEqual([12, 18, 24]);
  });

  it('straddles both WCAG thresholds, or the frontier is invisible', () => {
    // Without sizes either side of 18.66 and 24 the grid implies a boundary
    // somewhere it is not.
    expect(FIELD_SIZES.some((s) => s < 18.66)).toBe(true);
    expect(FIELD_SIZES.some((s) => s >= 18.66 && s < 24)).toBe(true);
    expect(FIELD_SIZES.some((s) => s >= 24)).toBe(true);
  });
});

describe('buildLegibilityField — the three verdicts', () => {
  it('passes everywhere when the pair clears body text', () => {
    const f = field(STRONG);
    expect(f.verdict).toBe('passes-everywhere');
    expect(f.rows.flat().every((c) => c.passes)).toBe(true);
  });

  it('passes nowhere when no setting of type can rescue the pair', () => {
    const f = field(HOPELESS);
    expect(f.verdict).toBe('passes-nowhere');
    expect(f.rows.flat().some((c) => c.passes)).toBe(false);
  });

  it('passes only in the large-text region in between', () => {
    const f = field(MIDDLING);
    expect(f.verdict).toBe('passes-when-large');
    for (const cell of f.rows.flat()) {
      expect(cell.passes).toBe(cell.isLarge);
    }
  });
});

describe('buildLegibilityField — the frontier is an L, and its corner matters', () => {
  it('lets weight change the requirement only at or above 18.66px', () => {
    // The single most useful coordinate on the field: below it, thickening
    // does nothing at all as far as the standard is concerned.
    const f = field(MIDDLING);
    const bold = f.frontier.find((p) => p.weight === 700)!;
    const light = f.frontier.find((p) => p.weight === 300)!;
    expect(bold.minimumSize).toBe(20);
    expect(light.minimumSize).toBe(24);
  });

  it('reports no minimum at all for a pair nothing rescues', () => {
    for (const point of field(HOPELESS).frontier) {
      expect(point.minimumSize).toBeNull();
    }
  });

  it('reports the smallest size for a pair that passes everywhere', () => {
    for (const point of field(STRONG).frontier) {
      expect(point.minimumSize).toBe(FIELD_SIZES[0]);
    }
  });

  it('never lets a heavier weight require a larger size', () => {
    // The frontier has to be monotonic; a bump in weight can only ever help.
    const f = field(MIDDLING);
    const minimums = f.frontier.map((p) => p.minimumSize ?? Infinity);
    for (let i = 1; i < minimums.length; i++) {
      expect(minimums[i]!).toBeLessThanOrEqual(minimums[i - 1]!);
    }
  });
});

describe('findExits', () => {
  it('offers both type exits when the pair is in the middle band', () => {
    const exits = findExits(MIDDLING[0], MIDDLING[1], 20, 400);
    expect(exits.thicken).toBe(700);
    expect(exits.grow).toBe(24);
  });

  it('offers no weight exit below 18.66px, which is the honest answer', () => {
    // Thickening small text is a common instinct and does nothing here.
    const exits = findExits(MIDDLING[0], MIDDLING[1], 16, 400);
    expect(exits.thicken).toBeNull();
    // And staying at weight 400 means growing all the way to 24, not to 20:
    // 20px only counts as large when it is also bold. Getting that wrong is
    // exactly the confusion this field exists to make visible.
    expect(exits.grow).toBe(24);
  });

  it('offers no type exit at all when the pair is under 3:1', () => {
    const exits = findExits(HOPELESS[0], HOPELESS[1], 16, 400);
    expect(exits.thicken).toBeNull();
    expect(exits.grow).toBeNull();
  });

  it('always carries a colour exit, since that is the one that always exists', () => {
    const exits = findExits(MIDDLING[0], MIDDLING[1], 16, 400);
    expect(['recolour', 'thicken', 'unreachable', 'already-passes']).toContain(
      exits.recolour.status
    );
  });

  it('says a passing setting already passes rather than inventing a fix', () => {
    const exits = findExits(STRONG[0], STRONG[1], 16, 400);
    expect(exits.recolour.status).toBe('already-passes');
    expect(exits.grow).toBe(18);
  });

  it('never suggests moving backwards', () => {
    const exits = findExits(MIDDLING[0], MIDDLING[1], 20, 400);
    if (exits.grow !== null) expect(exits.grow).toBeGreaterThan(20);
    if (exits.thicken !== null) expect(exits.thicken).toBeGreaterThan(400);
  });
});

describe('the claim this feature rests on', () => {
  it('answers a question no contrast checker can', () => {
    // "Can I keep this colour if I bump the weight?" A pair that fails at
    // 18px/400 and passes at 20px/700 is not describable by a single ratio,
    // and every tool in this category reports exactly one ratio.
    const [text, background] = MIDDLING;
    const failing = buildLegibilityField(text, background, { sizes: [18], weights: [400] });
    const passing = buildLegibilityField(text, background, { sizes: [20], weights: [700] });

    expect(failing.rows[0]![0]!.passes).toBe(false);
    expect(passing.rows[0]![0]!.passes).toBe(true);
    // Same two colours, same measured contrast, opposite answers.
    expect(failing.ratio).toBeCloseTo(passing.ratio, 10);
  });
});
