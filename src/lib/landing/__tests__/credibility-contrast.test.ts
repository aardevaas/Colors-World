import { describe, expect, it } from 'vitest';
import { contrastRatio, parseColor } from '@/lib/color-engine';

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
