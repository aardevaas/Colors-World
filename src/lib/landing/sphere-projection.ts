/**
 * Manual 3D-sphere-to-2D-screen projection via basic perspective math — no
 * WebGL, plain trigonometry drawn on a 2D canvas. `theta` is longitude in
 * radians, `phi` is latitude in radians (-PI/2..PI/2, pole to pole).
 *
 * `z` on the returned point is depth along the camera axis: positive is the
 * far side of the sphere, negative is the near side (facing the viewer).
 * Draw far-to-near — sort descending on `z` — for correct overlap.
 */

export interface SpherePoint {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly z: number;
}

const CAMERA_DISTANCE_FACTOR = 2.6;

export function projectSpherePoint(
  theta: number,
  phi: number,
  rotation: number,
  radius: number,
  centerX: number,
  centerY: number
): SpherePoint {
  const rotatedTheta = theta + rotation;
  const cosPhi = Math.cos(phi);
  const x3 = radius * cosPhi * Math.sin(rotatedTheta);
  const y3 = radius * Math.sin(phi);
  const z3 = radius * cosPhi * Math.cos(rotatedTheta);

  const cameraDistance = radius * CAMERA_DISTANCE_FACTOR;
  const scale = cameraDistance / (cameraDistance + z3);

  return {
    x: centerX + x3 * scale,
    y: centerY - y3 * scale,
    scale,
    z: z3,
  };
}
