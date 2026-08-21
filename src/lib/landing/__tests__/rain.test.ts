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

describe('visibleDrops — sparse at the top is the whole brief', () => {
  it('shows nothing at zero', () => {
    expect(visibleDrops(0)).toBe(0);
  });

  it('is genuinely sparse early, not merely reduced', () => {
    // "Very very lightly" at rest. A linear ramp already reads as weather by
    // 0.2, which is why the curve is quadratic.
    expect(visibleDrops(0.2)).toBeLessThan(4);
    expect(visibleDrops(0.35)).toBeLessThan(9);
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
    expect(visibleDrops(rainIntensityAt(0))).toBeLessThan(8);
  });

  it('never rains less as you scroll further', () => {
    let previous = -1;
    for (let p = 0; p <= 4; p += 0.1) {
      const now = rainIntensityAt(p);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it('reaches full by the time the rooms are painting', () => {
    expect(rainIntensityAt(2)).toBeCloseTo(1, 5);
    expect(visibleDrops(rainIntensityAt(2))).toBe(MAX_DROPS);
  });

  it('clamps rather than overshooting', () => {
    expect(rainIntensityAt(50)).toBe(1);
    expect(rainIntensityAt(-3)).toBeCloseTo(RESTING_INTENSITY, 5);
    expect(rainIntensityAt(Number.NaN)).toBeCloseTo(RESTING_INTENSITY, 5);
  });
});
