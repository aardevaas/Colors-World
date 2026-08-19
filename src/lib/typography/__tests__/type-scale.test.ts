import { describe, expect, it } from 'vitest';
import { DEFAULT_RATIO, SCALE_RATIOS, buildScale, ratioByValue } from '../type-scale';

describe('SCALE_RATIOS', () => {
  it('offers the eight conventional intervals, ascending', () => {
    expect(SCALE_RATIOS).toHaveLength(8);
    const values = SCALE_RATIOS.map((r) => r.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values[0]).toBe(1.067);
    expect(values[values.length - 1]).toBe(1.618);
  });

  it('includes the golden ratio and the default', () => {
    expect(ratioByValue(1.618)?.name).toBe('Golden ratio');
    expect(ratioByValue(DEFAULT_RATIO)).toBeDefined();
  });

  it('gives every ratio a reason to be picked', () => {
    for (const ratio of SCALE_RATIOS) expect(ratio.use.length).toBeGreaterThan(0);
  });
});

describe('buildScale', () => {
  it('pins body to exactly the base size', () => {
    // A scale whose body text drifts off its own base is unreasonable about.
    for (const ratio of SCALE_RATIOS) {
      const body = buildScale(1, ratio.value).find((e) => e.token === 'body');
      expect(body?.rem).toBe(1);
    }
  });

  it('ascends monotonically from caption to display', () => {
    const scale = buildScale(1, DEFAULT_RATIO);
    const ascending = [...scale].sort((a, b) => a.step - b.step);
    for (let i = 1; i < ascending.length; i += 1) {
      expect(ascending[i]!.rem).toBeGreaterThan(ascending[i - 1]!.rem);
    }
  });

  it('applies the ratio between adjacent steps', () => {
    const scale = buildScale(1, 1.5);
    const h4 = scale.find((e) => e.token === 'h4')!;
    const h3 = scale.find((e) => e.token === 'h3')!;
    expect(h4.rem).toBeCloseTo(1.5, 2);
    expect(h3.rem / h4.rem).toBeCloseTo(1.5, 1);
  });

  it('puts steps below the base under 1rem', () => {
    const scale = buildScale(1, DEFAULT_RATIO);
    expect(scale.find((e) => e.token === 'small')!.rem).toBeLessThan(1);
    expect(scale.find((e) => e.token === 'caption')!.rem).toBeLessThan(
      scale.find((e) => e.token === 'small')!.rem
    );
  });

  it('reports px consistent with rem at a 16px root', () => {
    for (const entry of buildScale(1, DEFAULT_RATIO)) {
      expect(entry.px).toBeCloseTo(entry.rem * 16, 1);
    }
  });

  it('scales with the base size', () => {
    const small = buildScale(0.875, DEFAULT_RATIO);
    const large = buildScale(1.25, DEFAULT_RATIO);
    for (let i = 0; i < small.length; i += 1) {
      expect(large[i]!.rem).toBeGreaterThan(small[i]!.rem);
    }
  });

  it('rejects a non-positive base and a ratio that cannot grow', () => {
    expect(() => buildScale(0, 1.25)).toThrow();
    expect(() => buildScale(-1, 1.25)).toThrow();
    expect(() => buildScale(1, 1)).toThrow();
    expect(() => buildScale(1, 0.9)).toThrow();
  });
});
