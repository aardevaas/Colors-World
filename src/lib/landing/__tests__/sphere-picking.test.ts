import { describe, expect, it } from 'vitest';
import {
  buildSphereBucketGrid,
  findNearestParticleNearPoint,
  raySphereIntersect,
} from '../sphere-picking';

const RADIUS = 2.6;

describe('raySphereIntersect', () => {
  it('hits a sphere dead-on from outside', () => {
    const hit = raySphereIntersect({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: -1 }, RADIUS);
    expect(hit).not.toBeNull();
    expect(hit?.x).toBeCloseTo(0);
    expect(hit?.y).toBeCloseTo(0);
    expect(hit?.z).toBeCloseTo(RADIUS);
  });

  it('misses a sphere entirely when the ray passes beside it', () => {
    const hit = raySphereIntersect(
      { x: 0, y: RADIUS * 3, z: 10 },
      { x: 0, y: 0, z: -1 },
      RADIUS
    );
    expect(hit).toBeNull();
  });

  it('returns null when the sphere is behind the ray origin', () => {
    const hit = raySphereIntersect({ x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 1 }, RADIUS);
    expect(hit).toBeNull();
  });

  it('returns the forward exit point when the ray origin is inside the sphere', () => {
    const hit = raySphereIntersect({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, RADIUS);
    expect(hit).not.toBeNull();
    expect(hit?.z).toBeCloseTo(RADIUS);
  });

  it('the hit point always lies exactly on the sphere surface', () => {
    // Direction must be unit-length — that's a documented precondition of
    // raySphereIntersect, not something it normalizes for the caller.
    const raw = { x: -1, y: -0.4, z: -0.6 };
    const length = Math.sqrt(raw.x ** 2 + raw.y ** 2 + raw.z ** 2);
    const direction = { x: raw.x / length, y: raw.y / length, z: raw.z / length };
    const hit = raySphereIntersect({ x: 5, y: 3, z: 4 }, direction, RADIUS);
    expect(hit).not.toBeNull();
    if (hit === null) return;
    const distance = Math.sqrt(hit.x ** 2 + hit.y ** 2 + hit.z ** 2);
    expect(distance).toBeCloseTo(RADIUS, 4);
  });
});

/** A small Fibonacci-lattice sphere, mirroring build-particle-buffers.ts's
 *  distribution closely enough to exercise the grid realistically without
 *  depending on that module. */
function buildTestSphere(count: number, radius: number): Float32Array {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const positions = new Float32Array(count * 3);
  const lastIndex = Math.max(1, count - 1);
  for (let i = 0; i < count; i += 1) {
    const unitY = 1 - (i / lastIndex) * 2;
    const ringRadius = Math.sqrt(Math.max(0, 1 - unitY * unitY));
    const theta = goldenAngle * i;
    positions[i * 3] = Math.cos(theta) * ringRadius * radius;
    positions[i * 3 + 1] = unitY * radius;
    positions[i * 3 + 2] = Math.sin(theta) * ringRadius * radius;
  }
  return positions;
}

describe('buildSphereBucketGrid + findNearestParticleNearPoint', () => {
  const count = 2000;
  const spherePos = buildTestSphere(count, RADIUS);
  const grid = buildSphereBucketGrid(spherePos, count, RADIUS);

  it('finds the exact particle when queried at its own position', () => {
    for (const index of [0, 137, 500, 999, count - 1]) {
      const point = {
        x: spherePos[index * 3] ?? 0,
        y: spherePos[index * 3 + 1] ?? 0,
        z: spherePos[index * 3 + 2] ?? 0,
      };
      const found = findNearestParticleNearPoint(point, spherePos, grid);
      expect(found).toBe(index);
    }
  });

  it('finds a plausible nearby particle for an off-lattice point', () => {
    // Perturb a known seat slightly rather than landing exactly on it.
    const index = 400;
    const seat = {
      x: spherePos[index * 3] ?? 0,
      y: spherePos[index * 3 + 1] ?? 0,
      z: spherePos[index * 3 + 2] ?? 0,
    };
    const nudged = { x: seat.x + 0.01, y: seat.y - 0.005, z: seat.z + 0.008 };
    const found = findNearestParticleNearPoint(nudged, spherePos, grid);
    expect(found).not.toBeNull();
    if (found === null) return;
    const foundPos = {
      x: spherePos[found * 3] ?? 0,
      y: spherePos[found * 3 + 1] ?? 0,
      z: spherePos[found * 3 + 2] ?? 0,
    };
    const distance = Math.sqrt(
      (foundPos.x - nudged.x) ** 2 + (foundPos.y - nudged.y) ** 2 + (foundPos.z - nudged.z) ** 2
    );
    // Should land on a genuinely close neighbour, not just anything in the grid.
    expect(distance).toBeLessThan(0.2);
  });

  it('handles the longitude seam (theta wrapping from +PI to -PI)', () => {
    // A point right on the seam, at the equator.
    const point = { x: -RADIUS, y: 0, z: 0.001 };
    const found = findNearestParticleNearPoint(point, spherePos, grid);
    expect(found).not.toBeNull();
  });

  it('returns null when the grid has no particles at all', () => {
    const emptyGrid = buildSphereBucketGrid(new Float32Array(0), 0, RADIUS);
    const found = findNearestParticleNearPoint({ x: 0, y: 0, z: RADIUS }, new Float32Array(0), emptyGrid);
    expect(found).toBeNull();
  });
});
