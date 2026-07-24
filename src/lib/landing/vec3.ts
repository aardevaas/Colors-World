/**
 * Minimal pure Vec3 math, shared by quaternion.ts and sphere-picking.ts.
 * Deliberately not pulling in three.js's Vector3 here: this needs to be
 * importable from anything that must stay outside the `three` bundle
 * boundary (see explosion-timing.ts for why that boundary exists), and a
 * handful of pure functions is easier to unit test in isolation anyway.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(vec3Dot(v, v));
}

/** Returns the zero vector for a zero-length input rather than dividing by
 *  zero — callers that need a fallback direction supply their own. */
export function vec3Normalize(v: Vec3): Vec3 {
  const length = vec3Length(v);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  return vec3Scale(v, 1 / length);
}
