/**
 * A pure JS mirror of the `rotateY`/`rotateZ` pair in particle-shaders.ts.
 *
 * The GPU never reports back where a particle actually ended up on screen —
 * its position exists only inside the vertex shader — so hover/click picking
 * has to recompute the same rotation on the CPU to know where each particle
 * currently sits. If this ever drifts out of sync with the GLSL, hovering
 * would silently target the wrong particle with no visible error. Kept as a
 * standalone, tested function specifically to catch that class of bug, since
 * the shader itself can't be unit tested.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function rotateY(point: Vec3, angle: number): Vec3 {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return {
    x: cos * point.x + sin * point.z,
    y: point.y,
    z: -sin * point.x + cos * point.z,
  };
}

export function rotateZ(point: Vec3, angle: number): Vec3 {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  return {
    x: cos * point.x - sin * point.y,
    y: sin * point.x + cos * point.y,
    z: point.z,
  };
}

/** Order matches the shader exactly: spin about Y first, then apply the fixed axial tilt about Z. */
export function rotateSpherePosition(point: Vec3, rotation: number, tilt: number): Vec3 {
  return rotateZ(rotateY(point, rotation), tilt);
}
