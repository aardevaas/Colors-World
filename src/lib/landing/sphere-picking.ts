import { vec3Dot, type Vec3 } from './vec3';

/**
 * Replaces the old "project all 30k particles into NDC and take the
 * nearest" scan (O(particle count) every hover frame). The globe is a
 * literal sphere, so a pointer ray can be intersected with it analytically
 * in O(1), and the hit point resolved to a nearby lattice seat via a
 * precomputed (latitude, longitude) bucket grid instead of scanning
 * everything. This is also *exact* rather than the old approach's
 * radius-guessed NDC tolerance (`HOVER_NDC_RADIUS`), since it starts from an
 * actual point on the sphere's surface rather than a 2D screen distance.
 *
 * Deliberately has no `three` import — same reasoning as vec3.ts and
 * quaternion.ts: this needs to stay usable from anywhere without pulling
 * three.js across the `ssr:false` bundle boundary. Callers (ParticleStorm.tsx)
 * do the camera unprojection themselves and hand this module plain vectors.
 */

/** Returns the nearest point where a ray hits a sphere centered at the
 *  origin, or `null` if it misses entirely or the sphere is entirely behind
 *  the ray's origin. `rayDir` must be a unit vector. */
export function raySphereIntersect(
  rayOrigin: Vec3,
  rayDir: Vec3,
  sphereRadius: number
): Vec3 | null {
  const b = 2 * vec3Dot(rayOrigin, rayDir);
  const c = vec3Dot(rayOrigin, rayOrigin) - sphereRadius * sphereRadius;
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) return null;

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t0 = (-b - sqrtDiscriminant) / 2;
  const t1 = (-b + sqrtDiscriminant) / 2;
  // Nearest hit that's actually in front of the ray's origin — a sphere
  // behind the camera has both roots negative, which must miss, not wrap
  // around to the far side.
  const t = t0 > 0 ? t0 : t1 > 0 ? t1 : null;
  if (t === null) return null;

  return {
    x: rayOrigin.x + rayDir.x * t,
    y: rayOrigin.y + rayDir.y * t,
    z: rayOrigin.z + rayDir.z * t,
  };
}

export interface SphereBucketGrid {
  readonly latBuckets: number;
  readonly lonBuckets: number;
  readonly sphereRadius: number;
  /** Flattened [lat * lonBuckets + lon] -> particle indices seated there. */
  readonly cells: readonly (readonly number[])[];
}

function latBucketOf(unitY: number, latBuckets: number): number {
  const t = (1 - unitY) / 2; // 0 at north pole, 1 at south
  return Math.min(latBuckets - 1, Math.max(0, Math.floor(t * latBuckets)));
}

function lonBucketOf(x: number, z: number, lonBuckets: number): number {
  const theta = Math.atan2(z, x); // -PI..PI
  const t = (theta + Math.PI) / (2 * Math.PI); // 0..1
  return Math.min(lonBuckets - 1, Math.max(0, Math.floor(t * lonBuckets)));
}

/**
 * Built once (per particle buffer, via useMemo) from the *unrotated* sphere
 * seats — the same frame `buildParticleBuffers` generated them in. Roughly
 * `count / (latBuckets * lonBuckets)` particles land in each cell, so a
 * 3x3-cell neighbourhood search touches a few dozen candidates regardless
 * of how many particles exist in total.
 */
export function buildSphereBucketGrid(
  spherePos: Float32Array,
  count: number,
  sphereRadius: number,
  latBuckets = 32,
  lonBuckets = 64
): SphereBucketGrid {
  const cells: number[][] = Array.from({ length: latBuckets * lonBuckets }, () => []);

  for (let i = 0; i < count; i += 1) {
    const x = spherePos[i * 3] ?? 0;
    const y = spherePos[i * 3 + 1] ?? 0;
    const z = spherePos[i * 3 + 2] ?? 0;
    const lat = latBucketOf(y / sphereRadius, latBuckets);
    const lon = lonBucketOf(x, z, lonBuckets);
    const cell = cells[lat * lonBuckets + lon];
    cell?.push(i);
  }

  return { latBuckets, lonBuckets, sphereRadius, cells };
}

/**
 * Finds the particle nearest `point` (a point on or near the sphere's
 * surface, in the same unrotated frame the grid was built from) by checking
 * only the bucket containing `point` and its immediate neighbours — never
 * the full particle set. Longitude wraps at the 0/2π seam; latitude is
 * clamped, since there's no wraparound at the poles.
 */
export function findNearestParticleNearPoint(
  point: Vec3,
  spherePos: Float32Array,
  grid: SphereBucketGrid
): number | null {
  const { latBuckets, lonBuckets, sphereRadius, cells } = grid;
  const centerLat = latBucketOf(point.y / sphereRadius, latBuckets);
  const centerLon = lonBucketOf(point.x, point.z, lonBuckets);

  let bestIndex: number | null = null;
  let bestDistanceSq = Infinity;

  for (let dLat = -1; dLat <= 1; dLat += 1) {
    const lat = centerLat + dLat;
    if (lat < 0 || lat >= latBuckets) continue;

    for (let dLon = -1; dLon <= 1; dLon += 1) {
      const lon = (centerLon + dLon + lonBuckets) % lonBuckets;
      const candidates = cells[lat * lonBuckets + lon];
      if (candidates === undefined) continue;

      for (const index of candidates) {
        const px = spherePos[index * 3] ?? 0;
        const py = spherePos[index * 3 + 1] ?? 0;
        const pz = spherePos[index * 3 + 2] ?? 0;
        const dx = px - point.x;
        const dy = py - point.y;
        const dz = pz - point.z;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq < bestDistanceSq) {
          bestDistanceSq = distanceSq;
          bestIndex = index;
        }
      }
    }
  }

  return bestIndex;
}
