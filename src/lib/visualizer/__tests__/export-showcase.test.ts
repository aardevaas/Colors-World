import { describe, expect, it } from 'vitest';
import { showcaseLayout } from '../export-showcase';

describe('showcaseLayout', () => {
  it('adds the footer below the image, never over it', () => {
    const layout = showcaseLayout(1600, 1000);
    expect(layout.width).toBe(1600);
    expect(layout.height).toBeGreaterThan(1000);
    expect(layout.height).toBe(1000 + layout.footerHeight);
  });

  it('puts the crop line exactly at the bottom of the artwork', () => {
    // The whole point of a separate bar: one straight crop at cropY removes
    // the credit and leaves the mockup untouched.
    const layout = showcaseLayout(1600, 1000);
    expect(layout.cropY).toBe(1000);
    expect(layout.height - layout.cropY).toBe(layout.footerHeight);
  });

  it('scales the footer with image width so it stays proportionate', () => {
    const small = showcaseLayout(800, 500);
    const large = showcaseLayout(3200, 2000);
    expect(large.footerHeight).toBeGreaterThan(small.footerHeight);
  });

  it('never collapses the footer below a legible minimum', () => {
    const tiny = showcaseLayout(120, 80);
    expect(tiny.footerHeight).toBeGreaterThanOrEqual(36);
  });

  it('leaves the artwork width untouched', () => {
    for (const width of [320, 760, 1440, 2880]) {
      expect(showcaseLayout(width, 600).width).toBe(width);
    }
  });
});
