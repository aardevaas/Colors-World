import { describe, expect, it } from 'vitest';
import { buildPaintSurface, decodeNormal } from '../paint-surface';

/** A solid horizontal bar, thick enough to have a real plateau in the middle. */
function bar(width: number, height: number, thickness: number) {
  const coverage = new Float32Array(width * height);
  const top = Math.floor((height - thickness) / 2);
  for (let y = top; y < top + thickness; y += 1) {
    for (let x = 0; x < width; x += 1) coverage[y * width + x] = 1;
  }
  return coverage;
}

const WIDTH = 40;
const HEIGHT = 40;
const RADIUS = 6;

function surfaceOfBar(thickness = 20) {
  return buildPaintSurface(bar(WIDTH, HEIGHT, thickness), WIDTH, HEIGHT, RADIUS);
}

function normalAt(surface: Uint8Array, x: number, y: number) {
  return decodeNormal(surface, (y * WIDTH + x) * 4);
}

function alphaAt(surface: Uint8Array, x: number, y: number): number {
  return surface[(y * WIDTH + x) * 4 + 3]! / 255;
}

describe('buildPaintSurface — shape', () => {
  it('returns four bytes per pixel', () => {
    expect(surfaceOfBar()).toHaveLength(WIDTH * HEIGHT * 4);
  });

  it('is deterministic', () => {
    expect(Array.from(surfaceOfBar())).toEqual(Array.from(surfaceOfBar()));
  });

  it('survives an empty grid and a full one', () => {
    const empty = new Float32Array(WIDTH * HEIGHT);
    const full = new Float32Array(WIDTH * HEIGHT).fill(1);
    expect(() => buildPaintSurface(empty, WIDTH, HEIGHT, RADIUS)).not.toThrow();
    expect(() => buildPaintSurface(full, WIDTH, HEIGHT, RADIUS)).not.toThrow();
  });
});

describe('buildPaintSurface — the normals are normals', () => {
  it('keeps every normal unit length once decoded', () => {
    // Normals get linearly filtered by the GPU, so they are renormalised in
    // the shader anyway — but one that leaves here non-unit means the encoding
    // is wrong, and the lighting would be subtly off everywhere.
    const surface = surfaceOfBar();
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const n = normalAt(surface, x, y);
        expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 2);
      }
    }
  });

  it('points straight up on the plateau of a thick stroke', () => {
    // Past one radius from the edge the tube tops out flat. If this were not
    // flat the lettering would look permanently creased down its spine.
    const n = normalAt(surfaceOfBar(20), WIDTH / 2, HEIGHT / 2);
    expect(n.z).toBeGreaterThan(0.99);
    expect(Math.abs(n.x)).toBeLessThan(0.02);
    expect(Math.abs(n.y)).toBeLessThan(0.02);
  });

  it('tilts away from the surface as it approaches an edge', () => {
    // This is the whole illusion: the shoulder of the tube has to lean, and
    // lean harder the closer to the edge it gets.
    const surface = surfaceOfBar(20);
    const top = (HEIGHT - 20) / 2;
    const shoulder = normalAt(surface, WIDTH / 2, top + 1);
    const middle = normalAt(surface, WIDTH / 2, HEIGHT / 2);
    expect(Math.abs(shoulder.y)).toBeGreaterThan(Math.abs(middle.y));
    expect(shoulder.z).toBeLessThan(middle.z);
  });

  it('leans in opposite directions on opposite edges', () => {
    const surface = surfaceOfBar(20);
    const top = (HEIGHT - 20) / 2;
    const upper = normalAt(surface, WIDTH / 2, top + 1);
    const lower = normalAt(surface, WIDTH / 2, top + 18);
    expect(Math.sign(upper.y)).toBe(-Math.sign(lower.y));
  });
});

describe('buildPaintSurface — the coverage', () => {
  it('is opaque inside and empty outside', () => {
    const surface = surfaceOfBar(20);
    expect(alphaAt(surface, WIDTH / 2, HEIGHT / 2)).toBeCloseTo(1, 2);
    expect(alphaAt(surface, WIDTH / 2, 0)).toBeCloseTo(0, 2);
  });

  it('preserves the partial coverage the rasteriser produced', () => {
    // A binary alpha gives stair-stepped letterforms. Canvas text rendering
    // already antialiases, so the fractional edge pixels have to survive the
    // trip -- they cannot be recovered afterwards, because the distance field
    // is built from a thresholded copy and only ever takes whole-pixel values.
    const coverage = bar(WIDTH, HEIGHT, 20);
    const top = (HEIGHT - 20) / 2;
    // A half-covered row, exactly as a rasteriser would emit along a curve.
    for (let x = 0; x < WIDTH; x += 1) coverage[(top - 1) * WIDTH + x] = 0.4;

    const surface = buildPaintSurface(coverage, WIDTH, HEIGHT, RADIUS);
    expect(alphaAt(surface, WIDTH / 2, top - 1)).toBeCloseTo(0.4, 2);
  });
});
