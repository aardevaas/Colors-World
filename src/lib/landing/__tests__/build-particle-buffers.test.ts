import { describe, expect, test } from 'vitest';
import { buildParticleBuffers } from '../build-particle-buffers';

const OPTIONS = {
  count: 2000,
  sphereRadius: 2.6,
  fieldWidth: 16,
  fieldDepth: 7,
} as const;

describe('buildParticleBuffers', () => {
  test('emits one entry per particle across every buffer', () => {
    const buffers = buildParticleBuffers(OPTIONS);
    expect(buffers.count).toBe(OPTIONS.count);
    expect(buffers.rainStart).toHaveLength(OPTIONS.count * 3);
    expect(buffers.spherePos).toHaveLength(OPTIONS.count * 3);
    expect(buffers.color).toHaveLength(OPTIONS.count * 3);
    expect(buffers.speed).toHaveLength(OPTIONS.count);
    expect(buffers.size).toHaveLength(OPTIONS.count);
    expect(buffers.indexNorm).toHaveLength(OPTIONS.count);
    expect(buffers.hex).toHaveLength(OPTIONS.count);
  });

  test('every sphere seat lies on the sphere surface, not inside it', () => {
    const { spherePos, count } = buildParticleBuffers(OPTIONS);
    for (let i = 0; i < count; i += 1) {
      const x = spherePos[i * 3] ?? 0;
      const y = spherePos[i * 3 + 1] ?? 0;
      const z = spherePos[i * 3 + 2] ?? 0;
      expect(Math.hypot(x, y, z)).toBeCloseTo(OPTIONS.sphereRadius, 4);
    }
  });

  test('the lattice spreads points evenly rather than clumping at the poles', () => {
    const { spherePos, count } = buildParticleBuffers(OPTIONS);
    // Equal-area bands on a sphere hold equal counts, so slicing y into
    // four equal-height bands should give four near-equal populations.
    // A naive lat/long grid fails this badly at the poles.
    const bands = [0, 0, 0, 0];
    for (let i = 0; i < count; i += 1) {
      const y = (spherePos[i * 3 + 1] ?? 0) / OPTIONS.sphereRadius; // -1..1
      const band = Math.min(3, Math.floor(((y + 1) / 2) * 4));
      bands[band] = (bands[band] ?? 0) + 1;
    }
    const expected = count / 4;
    for (const population of bands) {
      expect(Math.abs(population - expected) / expected).toBeLessThan(0.05);
    }
  });

  test('colours are real engine output, valid hex, and sweep the full hue wheel', () => {
    const { hex, color, count } = buildParticleBuffers(OPTIONS);
    for (const value of hex) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
    for (let i = 0; i < count * 3; i += 1) {
      const channel = color[i] ?? -1;
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
    // A full longitude sweep means every hue family appears — so the set of
    // distinct colours should be large, not a handful of repeats.
    expect(new Set(hex).size).toBeGreaterThan(count * 0.5);
  });

  test('rgb floats agree with the hex string they were derived from', () => {
    const { hex, color } = buildParticleBuffers(OPTIONS);
    for (let i = 0; i < 50; i += 1) {
      const packed = Number.parseInt((hex[i] ?? '#000000').slice(1), 16);
      expect(color[i * 3]).toBeCloseTo(((packed >> 16) & 255) / 255, 5);
      expect(color[i * 3 + 1]).toBeCloseTo(((packed >> 8) & 255) / 255, 5);
      expect(color[i * 3 + 2]).toBeCloseTo((packed & 255) / 255, 5);
    }
  });

  test('lightness runs pole to pole, so the globe reads as a tonal gradient', () => {
    const { hex, spherePos, count } = buildParticleBuffers(OPTIONS);
    function luminance(value: string): number {
      const packed = Number.parseInt(value.slice(1), 16);
      return (
        0.2126 * ((packed >> 16) & 255) +
        0.7152 * ((packed >> 8) & 255) +
        0.0722 * (packed & 255)
      );
    }
    // North pole (high +y) is the light end; south pole is the dark end.
    const north = luminance(hex[0] ?? '#000000');
    const south = luminance(hex[count - 1] ?? '#000000');
    expect(north).toBeGreaterThan(south);
    expect(spherePos[1] ?? 0).toBeGreaterThan(spherePos[(count - 1) * 3 + 1] ?? 0);
  });

  test('rain seats stay inside the field box and carry a 0..1 fall phase', () => {
    const { rainStart, count } = buildParticleBuffers(OPTIONS);
    for (let i = 0; i < count; i += 1) {
      expect(Math.abs(rainStart[i * 3] ?? 0)).toBeLessThanOrEqual(OPTIONS.fieldWidth / 2);
      const phase = rainStart[i * 3 + 1] ?? -1;
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
      expect(Math.abs(rainStart[i * 3 + 2] ?? 0)).toBeLessThanOrEqual(OPTIONS.fieldDepth / 2);
    }
  });

  test('is deterministic for a given random source', () => {
    function seeded() {
      let state = 42;
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
      };
    }
    const first = buildParticleBuffers({ ...OPTIONS, random: seeded() });
    const second = buildParticleBuffers({ ...OPTIONS, random: seeded() });
    expect(Array.from(first.rainStart)).toEqual(Array.from(second.rainStart));
    expect(first.hex).toEqual(second.hex);
  });

  test('indexNorm spans 0..1 so the reveal ramp can address the whole field', () => {
    const { indexNorm, count } = buildParticleBuffers(OPTIONS);
    expect(indexNorm[0]).toBe(0);
    expect(indexNorm[count - 1]).toBe(1);
  });
});
