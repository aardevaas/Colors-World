import { vec3Cross, vec3Scale, type Vec3 } from './vec3';

/**
 * Quaternion rotation, replacing the Euler (rotation, tilt) pair that used
 * to live in rotate-sphere-position.ts.
 *
 * Euler angles were *why* the globe's drag-to-orbit was constrained: pitch
 * had to be clamped (see the old MAX_DRAG_PITCH_RADIANS) to keep the sphere
 * from going pole-on and reading as a flat disc, and there was no way to
 * orbit around an arbitrary axis at all. A quaternion has no such pole and
 * composes via multiplication rather than by summing angles, so dragging in
 * any direction — then dragging again in a completely different direction —
 * just works, with no gimbal lock and no clamp.
 *
 * `rotateVector` is a pure JS mirror of the GLSL `rotateByQuat` function in
 * particle-shaders.ts, for exactly the reason rotate-sphere-position.ts
 * existed: the GPU never reports back where a particle actually ended up,
 * so CPU-side picking has to recompute the same rotation to know where each
 * particle currently sits. If the two ever drift apart, picking would
 * silently target the wrong particle with no visible error — hence this
 * being a standalone, tested function rather than duplicated inline.
 */

export interface Quat {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export function quatIdentity(): Quat {
  return { x: 0, y: 0, z: 0, w: 1 };
}

/** `axis` must already be a unit vector — callers normalize once upstream
 *  rather than paying for it again on every call. */
export function quatFromAxisAngle(axis: Vec3, angle: number): Quat {
  const half = angle / 2;
  const s = Math.sin(half);
  return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) };
}

/** Hamilton product. `quatMultiply(a, b)` rotates by `b` first, then by
 *  `a` — so accumulating a new drag as `quatMultiply(delta, orientation)`
 *  applies the new rotation in the current view frame ("grab what's under
 *  the cursor right now"), which is what a trackball is supposed to feel
 *  like, rather than in the sphere's own already-rotated frame. */
export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function quatLength(q: Quat): number {
  return Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
}

/** Floating-point drift accumulates over thousands of frames of continuous
 *  multiplication — renormalizing every frame (cheap) is what keeps a long
 *  session's rotation from slowly warping the sphere into an ellipsoid. */
export function quatNormalize(q: Quat): Quat {
  const length = quatLength(q);
  if (length === 0) return quatIdentity();
  const inv = 1 / length;
  return { x: q.x * inv, y: q.y * inv, z: q.z * inv, w: q.w * inv };
}

/** The inverse of a unit quaternion — valid only when `q` is normalized,
 *  which every quaternion in this module always is. */
export function quatConjugate(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

/**
 * Rotates `v` by `q`. Must stay byte-for-byte the same formula as the GLSL
 * `rotateByQuat` in particle-shaders.ts — see the file header for why.
 */
export function rotateVector(v: Vec3, q: Quat): Vec3 {
  const qAxis: Vec3 = { x: q.x, y: q.y, z: q.z };
  const t = vec3Scale(vec3Cross(qAxis, v), 2);
  const qCrossT = vec3Cross(qAxis, t);
  return {
    x: v.x + q.w * t.x + qCrossT.x,
    y: v.y + q.w * t.y + qCrossT.y,
    z: v.z + q.w * t.z + qCrossT.z,
  };
}

export function quatToArray(q: Quat): [number, number, number, number] {
  return [q.x, q.y, q.z, q.w];
}
