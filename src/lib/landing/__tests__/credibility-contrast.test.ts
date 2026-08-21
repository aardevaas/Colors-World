import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaEOk, parseColor } from '@/lib/color-engine';
import { TEXT_MIN_RATIO, solveForeground } from '../room-theme';

/**
 * The credibility strip's palette, guarded.
 *
 * Every color in the six rooms is solved at runtime and proved by
 * `room-theme.test.ts`. The strip is the exception on this page: its paper and
 * ink are hand-picked constants in `credibility-strip.module.css`, so nothing
 * would stop a later tweak from quietly dropping a note below AA — on the one
 * section whose entire job is to be believed, in a product about contrast.
 *
 * These values are duplicated from that stylesheet by necessity: a CSS module
 * cannot export them. Change them there and this fails, which is the point.
 */
const PAPER = parseColor('oklch(96.5% 0.004 95)');
const INK = parseColor('oklch(17% 0.012 275)');
const INK_QUIET = parseColor('oklch(44% 0.012 275)');

describe('the credibility strip palette', () => {
  it('clears AA for normal text on every pair it uses', () => {
    const pairs = [
      ['ink on paper — heading and values', INK, PAPER],
      ['quiet ink on paper — labels and notes', INK_QUIET, PAPER],
      ['paper on ink — the action at rest', PAPER, INK],
      ['ink on paper — the action on hover', INK, PAPER],
    ] as const;

    for (const [, foreground, background] of pairs) {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('holds the quiet ink well clear of the floor, not just over it', () => {
    // The notes are the smallest type in the section and the most likely thing
    // to be darkened "just a little" later. Some headroom means that edit has
    // to be a large one before it becomes a failure.
    expect(contrastRatio(INK_QUIET, PAPER)).toBeGreaterThan(6);
  });
});

/**
 * The option colours the spec sheet tells its values apart with.
 *
 * Duplicated from CredibilityStrip.tsx for the same reason as the palette
 * above: a component cannot export them to a test without shipping them.
 *
 * This exists because the first version got it wrong in a way that looked
 * plausible. The hues were solved against `{ l: 0.5, c: 0.12, h }` — a mid-tone
 * of each hue rather than the paper they actually sit on — so they cleared
 * 4.5:1 against a background that is nowhere on the page, and rendered as pale
 * tints on near-white. On the section about contrast.
 */
describe('the spec sheet option colours', () => {
  const PAPER_INK = parseColor('oklch(96.5% 0.004 95)');
  const HUES = [25, 150, 262, 88, 320, 200];

  it('clears AA against the paper, every one of them', () => {
    for (const h of HUES) {
      const solved = solveForeground(
        { l: PAPER_INK.l, c: PAPER_INK.c, h },
        TEXT_MIN_RATIO,
        undefined,
        'darker'
      );
      expect(contrastRatio(solved, PAPER_INK)).toBeGreaterThanOrEqual(TEXT_MIN_RATIO);
    }
  });

  it('keeps them coloured rather than solving to grey', () => {
    // The point of them is to tell options apart at a glance. A set that
    // desaturates to near-neutral would clear contrast and communicate nothing.
    for (const h of HUES) {
      const solved = solveForeground(
        { l: PAPER_INK.l, c: PAPER_INK.c, h },
        TEXT_MIN_RATIO,
        undefined,
        'darker'
      );
      expect(solved.c).toBeGreaterThan(0.04);
    }
  });

  it('keeps them distinguishable from one another', () => {
    const solved = HUES.map((h) =>
      solveForeground({ l: PAPER_INK.l, c: PAPER_INK.c, h }, TEXT_MIN_RATIO, undefined, 'darker')
    );
    for (let i = 0; i < solved.length; i += 1) {
      for (let j = i + 1; j < solved.length; j += 1) {
        const a = solved[i];
        const b = solved[j];
        if (a === undefined || b === undefined) continue;
        expect(deltaEOk(a, b)).toBeGreaterThan(0.05);
      }
    }
  });
});
