import { describe, expect, it } from 'vitest';
import {
  STROKE_COUNT,
  STROKE_WIDTH,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  buildStrokes,
} from '../paint-stroke';

/** Pull the numeric y-coordinates out of a path so coverage can be checked. */
function ysOf(d: string): number[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  // Path is "M x y C x y, x y, x y" — every second number is a y.
  return nums.filter((_, i) => i % 2 === 1).map(Number);
}

describe('buildStrokes — geometry', () => {
  it('is deterministic, because cards render on the server', () => {
    expect(buildStrokes()).toEqual(buildStrokes());
  });

  it('covers the panel from top to bottom, running off both edges', () => {
    // The strokes *are* the card's surface. Centring the outermost strokes
    // inside the box left 295px of paint on a 331px card — unpainted bands
    // along the top and bottom. They have to overshoot.
    const strokes = buildStrokes();
    const centres = strokes.map((s) => ysOf(s.d)[0]!);

    expect(Math.min(...centres)).toBeLessThan(0);
    expect(Math.max(...centres)).toBeGreaterThan(VIEW_HEIGHT);

    // The relationship that actually matters: neighbouring strokes must be
    // closer together than they are wide, or the finished panel has seams.
    // Checked against the real stroke width rather than a guessed multiple of
    // the band — the first version of this test passed while leaving gaps.
    const sorted = [...centres].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i]! - sorted[i - 1]!).toBeLessThan(STROKE_WIDTH);
    }
  });

  it('overshoots both edges so the brush enters and leaves', () => {
    for (const stroke of buildStrokes()) {
      expect(stroke.d.startsWith('M -10 ')).toBe(true);
      expect(stroke.d).toContain('110 ');
    }
  });

  it('alternates direction', () => {
    // All one way reads as a progress bar rather than a brush.
    const froms = buildStrokes().map((s) => s.from);
    for (let i = 1; i < froms.length; i += 1) {
      expect(froms[i]).not.toBe(froms[i - 1]);
    }
  });

  it('never has two strokes bow identically', () => {
    const shapes = buildStrokes().map((s) => s.d);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('stays inside the authored viewBox horizontally', () => {
    for (const stroke of buildStrokes()) {
      const xs = (stroke.d.match(/-?\d+(?:\.\d+)?/g) ?? [])
        .filter((_, i) => i % 2 === 0)
        .map(Number);
      for (const x of xs) {
        expect(x).toBeGreaterThanOrEqual(-12);
        expect(x).toBeLessThanOrEqual(VIEW_WIDTH + 12);
      }
    }
  });
});

describe('buildStrokes — timing', () => {
  it('runs strokes in order', () => {
    const strokes = buildStrokes();
    for (let i = 1; i < strokes.length; i += 1) {
      expect(strokes[i]!.start).toBeGreaterThan(strokes[i - 1]!.start);
    }
  });

  it('overlaps them, so the painting never stutters', () => {
    // Each stroke must begin before its predecessor has finished, or the card
    // is painted as a sequence of separate wipes with pauses between.
    const strokes = buildStrokes();
    for (let i = 1; i < strokes.length; i += 1) {
      expect(strokes[i]!.start).toBeLessThan(strokes[i - 1]!.end);
    }
  });

  it('keeps every window inside 0..1 and forward-going', () => {
    for (const stroke of buildStrokes()) {
      expect(stroke.start).toBeGreaterThanOrEqual(0);
      expect(stroke.end).toBeLessThanOrEqual(1);
      expect(stroke.end).toBeGreaterThan(stroke.start);
    }
  });

  it('finishes the last stroke exactly at the end', () => {
    const strokes = buildStrokes();
    expect(strokes[strokes.length - 1]!.end).toBe(1);
  });
});

describe('buildStrokes — degenerate input', () => {
  it('returns nothing rather than throwing', () => {
    expect(buildStrokes(0)).toEqual([]);
    expect(buildStrokes(-3)).toEqual([]);
    expect(buildStrokes(Number.NaN)).toEqual([]);
  });

  it('caps absurd counts', () => {
    expect(buildStrokes(500).length).toBeLessThanOrEqual(24);
  });

  it('defaults to the tuned count', () => {
    expect(buildStrokes()).toHaveLength(STROKE_COUNT);
  });
});
