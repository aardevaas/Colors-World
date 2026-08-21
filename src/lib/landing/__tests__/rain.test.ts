import { describe, expect, it } from 'vitest';
import { ROOM_IDS } from '@/lib/nav/tabs';
import {
  MAX_DROPS,
  RESTING_INTENSITY,
  buildDrops,
  fieldOpacity,
  rainIntensityAt,
  visibleDrops,
} from '../rain';

describe('buildDrops — the field itself', () => {
  it('is deterministic, because it renders on the server too', () => {
    // A field built from Math.random() would differ between the server render
    // and the client's first paint, and React would throw a hydration error.
    expect(buildDrops()).toEqual(buildDrops());
  });

  it('keeps every drop on screen', () => {
    for (const drop of buildDrops()) {
      expect(drop.left).toBeGreaterThanOrEqual(0);
      expect(drop.left).toBeLessThanOrEqual(100);
    }
  });

  it('starts mid-fall rather than empty', () => {
    // Positive delays would mean the first seconds of the page show no rain at
    // all, then a wave arriving together from the top edge.
    for (const drop of buildDrops()) {
      expect(drop.delay).toBeLessThanOrEqual(0);
    }
  });

  it('never falls perfectly vertically or in lockstep', () => {
    const drops = buildDrops();
    expect(new Set(drops.map((d) => d.duration)).size).toBeGreaterThan(20);
    expect(drops.some((d) => d.sway !== 0)).toBe(true);
  });

  it('does not land on a visible grid', () => {
    // The tell for a hashed scatter going wrong is even spacing. Sort the
    // horizontal positions and check the gaps are not near-uniform.
    const lefts = buildDrops().map((d) => d.left).sort((a, b) => a - b);
    const gaps = lefts.slice(1).map((v, i) => v - lefts[i]!);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const spread = Math.sqrt(
      gaps.reduce((sum, g) => sum + (g - mean) ** 2, 0) / gaps.length
    );
    expect(spread).toBeGreaterThan(mean * 0.4);
  });

  it('gives nearer drops more size and more speed', () => {
    // Depth drives both. If they disagree the parallax reads backwards — small
    // drops racing past big slow ones in front of them.
    for (const drop of buildDrops()) {
      if (drop.depth < 0.25) {
        expect(drop.size).toBeGreaterThan(15);
      }
      if (drop.depth > 0.75) {
        expect(drop.duration).toBeGreaterThan(13);
      }
    }
  });

  it('assigns every drop a real room', () => {
    for (const drop of buildDrops()) {
      expect(drop.roomIndex).toBeGreaterThanOrEqual(0);
      expect(drop.roomIndex).toBeLessThan(ROOM_IDS.length);
    }
  });

  it('survives nonsense counts', () => {
    expect(buildDrops(Number.NaN)).toEqual([]);
    expect(buildDrops(-5)).toEqual([]);
    expect(buildDrops(9999)).toHaveLength(MAX_DROPS);
  });
});

describe('visibleDrops — the top of the page stays the sparse end', () => {
  it('shows nothing at zero', () => {
    expect(visibleDrops(0)).toBe(0);
  });

  it('is genuinely sparse early, not merely reduced', () => {
    // A linear ramp already reads as weather by 0.2, which is why the curve is
    // quadratic.
    //
    // Stated as a fraction of the field rather than a drop count. The brief
    // moved once already — the page was asked to rain harder, MAX_DROPS went
    // from 54 to 76, and these read as failures when nothing about the shape
    // of the ramp had changed. What is actually being asserted is that the top
    // of the page is a small share of full rain, and that survives the next
    // density change too.
    expect(visibleDrops(0.2) / MAX_DROPS).toBeLessThan(0.08);
    expect(visibleDrops(0.35) / MAX_DROPS).toBeLessThan(0.16);
  });

  it('reaches the full field by the end', () => {
    expect(visibleDrops(1)).toBe(MAX_DROPS);
  });

  it('never decreases as intensity rises', () => {
    let previous = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const now = visibleDrops(t);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it('clamps rather than overflowing', () => {
    expect(visibleDrops(4)).toBe(MAX_DROPS);
    expect(visibleDrops(-2)).toBe(0);
    expect(visibleDrops(Number.NaN)).toBe(0);
  });
});

describe('fieldOpacity', () => {
  it('keeps the few resting drops visible rather than ghosted', () => {
    expect(fieldOpacity(0)).toBeGreaterThan(0.3);
  });

  it('rises to full', () => {
    expect(fieldOpacity(1)).toBeCloseTo(1, 5);
  });

  it('rises faster than the drop count, so early drops still read', () => {
    expect(fieldOpacity(0.25)).toBeGreaterThan(0.25);
  });
});

describe('rainIntensityAt — the scroll ramp', () => {
  it('rests low at the top of the page', () => {
    expect(rainIntensityAt(0)).toBeCloseTo(RESTING_INTENSITY, 5);
    // As above: a share of the field, not a count.
    expect(visibleDrops(rainIntensityAt(0)) / MAX_DROPS).toBeLessThan(0.2);
  });

  it('never rains less as you scroll further', () => {
    let previous = -1;
    for (let p = 0; p <= 8; p += 0.1) {
      const now = rainIntensityAt(p);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it('is still building a viewport in, rather than already done', () => {
    // The complaint the longer ramp answers: the rain used to arrive fully
    // formed almost as soon as the hero left.
    expect(rainIntensityAt(1)).toBeLessThan(0.6);
  });

  it('reaches full by the time the rooms are well under way', () => {
    expect(rainIntensityAt(4)).toBeCloseTo(1, 5);
    expect(visibleDrops(rainIntensityAt(4))).toBe(MAX_DROPS);
  });

  it('clamps rather than overshooting', () => {
    expect(rainIntensityAt(50)).toBe(1);
    expect(rainIntensityAt(-3)).toBeCloseTo(RESTING_INTENSITY, 5);
    expect(rainIntensityAt(Number.NaN)).toBeCloseTo(RESTING_INTENSITY, 5);
  });
});

describe('buildDrops — the field must not read as a loop', () => {
  it('spreads fall durations widely', () => {
    // Drops repeat forever on their own cycles. Bunched durations resynchronise
    // and you see the same rain again; a wide spread never realigns in a visit.
    const durations = buildDrops().map((d) => d.duration);
    expect(Math.max(...durations) - Math.min(...durations)).toBeGreaterThan(12);
  });

  it('starts every drop at a different point in its fall', () => {
    const delays = buildDrops().map((d) => Math.round(d.delay * 10) / 10);
    expect(new Set(delays).size).toBeGreaterThan(MAX_DROPS * 0.85);
  });
});

describe('buildDrops — the field must cover the full width at any intensity', () => {
  it('spreads even a handful of drops across the screen', () => {
    // Drops are revealed in index order, so a low intensity shows a prefix of
    // the field. Hashed positions clumped: the left of the screen was nearly
    // empty while the right carried most of the rain.
    const drops = buildDrops();
    for (const prefix of [6, 12, 24, MAX_DROPS]) {
      const lefts = drops.slice(0, prefix).map((d) => d.left);
      expect(Math.min(...lefts)).toBeLessThan(20);
      expect(Math.max(...lefts)).toBeGreaterThan(80);

      // And no empty half.
      const leftHalf = lefts.filter((l) => l < 50).length;
      expect(leftHalf).toBeGreaterThan(prefix * 0.3);
      expect(leftHalf).toBeLessThan(prefix * 0.7);
    }
  });
});
