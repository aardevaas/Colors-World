import { describe, expect, it } from 'vitest';
import { psychologyProfile } from '../color-psychology';
import { HUE_FAMILIES } from '../hue-family';

describe('psychologyProfile', () => {
  it('has a distinct profile for every hue family, not a silent fallback', () => {
    // Every family's own midpoint hue should produce ITS OWN archetype, not
    // all collapse to the same fallback — this is the test that would catch
    // HUE_PROFILES drifting out of sync with HUE_FAMILIES (two separately
    // hand-maintained objects, by design — see the module's own comment on
    // why that risk exists).
    const archetypes = HUE_FAMILIES.map((family) => {
      const midpointHue = (family.minHue + family.maxHue) / 2;
      return psychologyProfile({ l: 0.5, c: 0.1, h: midpointHue }).archetype;
    });
    expect(new Set(archetypes).size).toBe(HUE_FAMILIES.length);
  });

  it('normalizes a negative hue to its 0-360 equivalent rather than a different family', () => {
    // -1° and 359° are the same angle — HUE_FAMILIES has no family spanning
    // the 360/0 seam itself (pinks ends at 360, reds starts at 0), so this
    // tests hue normalization, not a same-family wraparound.
    const negative = psychologyProfile({ l: 0.5, c: 0.1, h: -1 });
    const equivalent = psychologyProfile({ l: 0.5, c: 0.1, h: 359 });
    expect(negative.archetype).toBe(equivalent.archetype);
  });

  it('buckets temperature from lightness: light/mid/dark', () => {
    expect(psychologyProfile({ l: 0.9, c: 0.1, h: 0 }).temperature).toBe('light');
    expect(psychologyProfile({ l: 0.5, c: 0.1, h: 0 }).temperature).toBe('mid');
    expect(psychologyProfile({ l: 0.1, c: 0.1, h: 0 }).temperature).toBe('dark');
  });

  it('buckets intensity from chroma: subtle/balanced/bold', () => {
    expect(psychologyProfile({ l: 0.5, c: 0.02, h: 0 }).intensity).toBe('subtle');
    expect(psychologyProfile({ l: 0.5, c: 0.1, h: 0 }).intensity).toBe('balanced');
    expect(psychologyProfile({ l: 0.5, c: 0.2, h: 0 }).intensity).toBe('bold');
  });

  it('always includes at least one emotional tag and non-empty prose fields', () => {
    const profile = psychologyProfile({ l: 0.6, c: 0.12, h: 210 });
    expect(profile.emotionalTags.length).toBeGreaterThan(0);
    expect(profile.culturalNotes.length).toBeGreaterThan(0);
    expect(profile.physiological.length).toBeGreaterThan(0);
  });

  it('handles a negative hue input without throwing', () => {
    expect(() => psychologyProfile({ l: 0.5, c: 0.1, h: -30 })).not.toThrow();
  });
});
