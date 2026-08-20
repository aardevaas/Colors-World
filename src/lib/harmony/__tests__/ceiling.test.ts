import { describe, expect, it } from 'vitest';
import { isInGamut, maxChroma } from '@/lib/color-engine';
import { ceilingAt, chromaCeilingProfile } from '../ceiling';

describe('chromaCeilingProfile', () => {
  it('samples the whole wheel', () => {
    const profile = chromaCeilingProfile(0.55);
    expect(profile.samples).toHaveLength(72);
    expect(profile.samples[0]!.hue).toBe(0);
    expect(profile.samples.at(-1)!.hue).toBeCloseTo(355, 6);
  });

  it('agrees with the gamut mapper it is built on', () => {
    for (const sample of chromaCeilingProfile(0.62, 'srgb', 24).samples) {
      expect(sample.maxChroma).toBeCloseTo(maxChroma(0.62, sample.hue, 'srgb'), 10);
    }
  });

  it('reports a ceiling that is actually reachable', () => {
    for (const sample of chromaCeilingProfile(0.55, 'srgb', 24).samples) {
      expect(isInGamut({ l: 0.55, c: sample.maxChroma, h: sample.hue }, 'srgb')).toBe(true);
    }
  });

  it('finds the spread the whole approach rests on', () => {
    // The measurement behind every claim about perceptual harmony: at a fixed
    // lightness, hues are nowhere near equally saturable, so a rotation at
    // constant chroma leaves some hues clipped.
    const profile = chromaCeilingProfile(0.55);
    expect(profile.spread).toBeGreaterThan(2.5);
    expect(profile.weakest.maxChroma).toBeLessThan(profile.strongest.maxChroma);
  });

  it('puts the weakest hue in the blue-green region and the strongest in the magenta-violet one', () => {
    // Not an arbitrary assertion: it is the shape of sRGB, and if it ever
    // changes the wheel is drawing something other than this gamut.
    const profile = chromaCeilingProfile(0.55);
    expect(profile.weakest.hue).toBeGreaterThan(150);
    expect(profile.weakest.hue).toBeLessThan(240);
    expect(profile.strongest.hue).toBeGreaterThan(250);
    expect(profile.strongest.hue).toBeLessThan(340);
  });

  it('widens the ceiling for a wider gamut', () => {
    const srgb = chromaCeilingProfile(0.55, 'srgb', 24);
    const p3 = chromaCeilingProfile(0.55, 'p3', 24);
    const total = (p: typeof srgb) => p.samples.reduce((sum, s) => sum + s.maxChroma, 0);
    expect(total(p3)).toBeGreaterThan(total(srgb));
  });

  it('survives lightness extremes without reporting Infinity as a finding', () => {
    for (const l of [0, 1]) {
      const profile = chromaCeilingProfile(l);
      expect(Number.isFinite(profile.spread)).toBe(true);
      expect(profile.spread).toBeGreaterThanOrEqual(1);
    }
  });

  it('clamps a nonsensical sample count instead of hanging or returning nothing', () => {
    expect(chromaCeilingProfile(0.5, 'srgb', 0).samples.length).toBeGreaterThanOrEqual(8);
    expect(chromaCeilingProfile(0.5, 'srgb', 100000).samples.length).toBeLessThanOrEqual(360);
    expect(chromaCeilingProfile(0.5, 'srgb', Number.NaN).samples.length).toBeGreaterThanOrEqual(8);
  });

  it('is deterministic', () => {
    expect(chromaCeilingProfile(0.6)).toEqual(chromaCeilingProfile(0.6));
  });
});

describe('ceilingAt', () => {
  it('returns the sample exactly on a sample hue', () => {
    const profile = chromaCeilingProfile(0.55, 'srgb', 36);
    expect(ceilingAt(profile, 40)).toBeCloseTo(profile.samples[4]!.maxChroma, 10);
  });

  it('interpolates between samples rather than snapping', () => {
    // A spoke drawn at its own hue has to meet the perimeter it is drawn
    // against; snapping to the nearest sample makes it visibly miss.
    const profile = chromaCeilingProfile(0.55, 'srgb', 36);
    const a = profile.samples[4]!.maxChroma;
    const b = profile.samples[5]!.maxChroma;
    const mid = ceilingAt(profile, 45);
    expect(mid).toBeGreaterThan(Math.min(a, b) - 1e-9);
    expect(mid).toBeLessThan(Math.max(a, b) + 1e-9);
    expect(mid).not.toBeCloseTo(a, 6);
  });

  it('wraps around the wheel', () => {
    const profile = chromaCeilingProfile(0.55, 'srgb', 36);
    expect(ceilingAt(profile, 360)).toBeCloseTo(ceilingAt(profile, 0), 10);
    expect(ceilingAt(profile, -10)).toBeCloseTo(ceilingAt(profile, 350), 10);
    expect(ceilingAt(profile, 725)).toBeCloseTo(ceilingAt(profile, 5), 10);
  });

  it('never returns something outside the sampled range', () => {
    const profile = chromaCeilingProfile(0.55);
    for (let hue = 0; hue < 360; hue += 3.7) {
      const value = ceilingAt(profile, hue);
      expect(value).toBeGreaterThanOrEqual(profile.weakest.maxChroma - 1e-9);
      expect(value).toBeLessThanOrEqual(profile.strongest.maxChroma + 1e-9);
    }
  });
});
