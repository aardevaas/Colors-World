import { describe, expect, it } from 'vitest';
import { routeBarcodeGradient } from '../barcode-pattern';

describe('routeBarcodeGradient', () => {
  it('starts at 0% and ends at 100%', () => {
    const gradient = routeBarcodeGradient('/library');
    expect(gradient).toContain(' 0.000%');
    expect(gradient).toContain(' 100.000%');
  });

  it('is a linear-gradient using currentColor for bars and transparent for gaps', () => {
    const gradient = routeBarcodeGradient('/builder');
    expect(gradient.startsWith('linear-gradient(to right, ')).toBe(true);
    expect(gradient).toContain('currentColor');
    expect(gradient).toContain('transparent');
  });

  it('is deterministic for the same route', () => {
    expect(routeBarcodeGradient('/studio')).toBe(routeBarcodeGradient('/studio'));
  });

  it('produces a different pattern for a different route', () => {
    expect(routeBarcodeGradient('/studio')).not.toBe(routeBarcodeGradient('/visualizer'));
  });

  it('handles a route shorter than the bar count without throwing', () => {
    expect(() => routeBarcodeGradient('/x')).not.toThrow();
  });
});
