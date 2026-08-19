import { describe, expect, it } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { WCAG_AA_LARGE, WCAG_AA_NORMAL } from '@/lib/visualizer/auto-fix';
import { assessLegibility, isLargeText, requiredRatio, suggestLegibilityFix } from '../legibility';

const c = parseColor;

describe('isLargeText — WCAG size/weight rule', () => {
  it('treats 24px and above as large at any weight', () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(23.9, 400)).toBe(false);
  });

  it('lowers the size threshold for bold text', () => {
    expect(isLargeText(18.66, 700)).toBe(true);
    expect(isLargeText(18.66, 600)).toBe(false);
    expect(isLargeText(18, 700)).toBe(false);
  });

  it('maps large text to the 3:1 requirement and everything else to 4.5:1', () => {
    expect(requiredRatio(30, 400)).toBe(WCAG_AA_LARGE);
    expect(requiredRatio(14, 400)).toBe(WCAG_AA_NORMAL);
    expect(requiredRatio(19, 700)).toBe(WCAG_AA_LARGE);
  });
});

describe('assessLegibility', () => {
  it('reports the real ratio and whether it clears the requirement', () => {
    const result = assessLegibility(c('#FFFFFF'), c('#000000'), 16, 400);
    expect(result.ratio).toBeGreaterThan(20);
    expect(result.passes).toBe(true);
    expect(result.margin).toBeGreaterThan(0);
  });

  it('gives a negative margin when text fails', () => {
    const result = assessLegibility(c('#5A3F73'), c('#0B0B0C'), 16, 400);
    expect(result.passes).toBe(false);
    expect(result.margin).toBeLessThan(0);
  });

  it('can pass at display size while failing at body size, unchanged colours', () => {
    // ~3.45:1 — above the large threshold, below the normal one. The same
    // colours are legible as a headline and not as body copy, which is the
    // whole reason size belongs in this calculation.
    const text = c('#6B5BA8');
    const bg = c('#0B0B0C');
    expect(assessLegibility(text, bg, 32, 400).passes).toBe(true);
    expect(assessLegibility(text, bg, 14, 400).passes).toBe(false);
  });
});

describe('suggestLegibilityFix', () => {
  it('does nothing when the text already reads', () => {
    expect(suggestLegibilityFix(c('#FFFFFF'), c('#000000'), 16, 400).status).toBe('already-passes');
  });

  it('prefers thickening when weight alone crosses the large-text threshold', () => {
    // 20px at 400 needs 4.5:1; at 700 it becomes "large" and needs only 3:1.
    // ~3.45:1 sits between the two, so bold fixes it without touching colour.
    const fix = suggestLegibilityFix(c('#6B5BA8'), c('#0B0B0C'), 20, 400);
    expect(fix.status).toBe('thicken');
    if (fix.status === 'thicken') {
      expect(fix.weight).toBeGreaterThanOrEqual(700);
      expect(fix.ratio).toBeGreaterThanOrEqual(fix.required);
    }
  });

  it('recolours when no weight can rescue it — small text stays small', () => {
    // At 12px, weight never reaches the large-text threshold, so the only
    // lever left is colour.
    const fix = suggestLegibilityFix(c('#5A3F73'), c('#0B0B0C'), 12, 400);
    expect(fix.status).toBe('recolour');
    if (fix.status === 'recolour') {
      expect(fix.achievedRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      expect(fix.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('preserves hue and chroma when it recolours', () => {
    const text = c('#5A3F73');
    const fix = suggestLegibilityFix(text, c('#0B0B0C'), 12, 400);
    if (fix.status !== 'recolour') throw new Error('expected a recolour');
    expect(fix.color.h).toBe(text.h);
    expect(fix.color.c).toBe(text.c);
  });

  it('rescues even text sitting exactly on its own background', () => {
    // Worth stating why this is a `recolour` and not `unreachable`: a neutral
    // grey has almost no chroma, so its lightness can travel all the way to
    // black without gamut clipping, and black clears 4.5:1 against mid-grey.
    // An earlier version of this test assumed identical colours were
    // unfixable — they are the *easiest* case, not the hardest.
    //
    // `unreachable` is a genuine branch but needs a target no lightness can
    // reach for a given hue/chroma; since this API derives its target from
    // WCAG size/weight rules rather than accepting one, that path is exercised
    // directly in auto-fix.test.ts instead of contrived through here.
    const fix = suggestLegibilityFix(c('#808080'), c('#808080'), 12, 400);
    expect(fix.status).toBe('recolour');
    if (fix.status === 'recolour') {
      expect(fix.achievedRatio).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    }
  });

  it('never recommends a weight lighter than the current one', () => {
    const fix = suggestLegibilityFix(c('#6B5BA8'), c('#0B0B0C'), 20, 600);
    if (fix.status === 'thicken') expect(fix.weight).toBeGreaterThan(600);
  });
});
