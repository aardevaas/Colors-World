/**
 * The paint run: a glass tube that catches the rain, loops it, and hoses it at
 * a wall.
 *
 * The rain used to end in a flat pool across the foot of the page, which is
 * where paint would honestly go and is not much to watch. This is the deliberate
 * cheat in its place — a fan gathers the drops to one intake, a length of glass
 * tubing carries them through a loop and a chicane, and the far end sprays them
 * against the side of the page, which they paint.
 *
 * The manipulation is entirely in WHERE the paint is allowed to go. Everything
 * about HOW it goes there is still physics: a particle in the tube is on a
 * track, accelerated by the component of gravity along the tangent, so it
 * speeds up down the drops, slows climbing the loop, and can be too slow at the
 * top to make it round — which is the behaviour that makes a rollercoaster
 * legible as one.
 *
 * Pure: no DOM, no canvas. Positions come out, the caller draws them.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
  /**
   * Depth. Positive is further from the viewer.
   *
   * The track is three-dimensional for one reason: a loop that crosses over
   * itself has to be readable, and in two dimensions the near and far sides of
   * a loop are the same line. With depth, the near side is drawn over the far
   * one and larger than it, and the shape of the ride becomes legible at a
   * glance — which is the whole point of a rollercoaster silhouette.
   */
  readonly z: number;
}

/** A sampled path with cumulative arc length, so travel can be by distance. */
export interface Path {
  /** Sample positions, flattened as x, y, z, x, y, z … */
  readonly xyz: Float64Array;
  /** Distance from the start to each sample. */
  readonly at: Float64Array;
  readonly total: number;
}

/** Where the viewer is, for projecting the track onto the canvas. */
export interface Camera {
  /** Screen position depth 0 maps to. */
  readonly cx: number;
  readonly cy: number;
  /** Distance from the eye to the z = 0 plane. Larger is a longer lens: less
   *  perspective, flatter loops. */
  readonly focal: number;
}

export interface Projected {
  readonly sx: number;
  readonly sy: number;
  /** Foreshortening at this depth. Multiply any width by it. */
  readonly scale: number;
  readonly z: number;
}

/**
 * Perspective projection — the whole of the 3D, in four lines.
 *
 * Deliberately the simplest thing that produces depth: no rotation, no camera
 * basis, just a pinhole on the z axis. The track is authored directly in the
 * space the viewer sees, so anything more would be machinery between the design
 * and the screen with nothing to show for it.
 */
export function project(x: number, y: number, z: number, camera: Camera): Projected {
  const scale = camera.focal / Math.max(1, camera.focal + z);
  return {
    sx: camera.cx + (x - camera.cx) * scale,
    sy: camera.cy + (y - camera.cy) * scale,
    scale,
    z,
  };
}

export interface Carried {
  /** Distance travelled along the tube. */
  s: number;
  /** Speed along it, px/s. */
  v: number;
  /** How far off the centre line it rides, -1 to 1 — the tube is wider than a
   *  drop and they do not queue up single file. */
  readonly lane: number;
  readonly size: number;
  readonly color: number;
}

/** A drop that has left the nozzle and is on its own again. */
export interface Ejected {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  readonly size: number;
  readonly color: number;
}

/** Gravity along the tube, px/s². Steeper than the rain's: this is a ride. */
export const TUBE_GRAVITY = 1250;
/** Speed lost to the walls each second, as a retained fraction. */
export const TUBE_DRAG = 0.86;
/** A shove at the intake, so nothing stalls before the first drop. */
export const INTAKE_SPEED = 190;
/** Below this a particle in a climb has stalled and slides back down. */
export const STALL_SPEED = 4;

/**
 * Samples a Catmull-Rom spline through `points` into a polyline.
 *
 * Catmull-Rom because it passes THROUGH its control points: the tube is
 * designed by placing the positions it should visit, and a Bezier would treat
 * those as suggestions and miss the loop.
 */
export function buildPath(points: readonly Point[], perSegment = 24): Path {
  if (points.length < 2) {
    return { xyz: new Float64Array(0), at: new Float64Array(0), total: 0 };
  }

  const samples: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) continue;

    for (let step = 0; step < perSegment; step += 1) {
      const t = step / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      // Standard Catmull-Rom basis, tension 0.5.
      const spline = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);

      samples.push(
        spline(p0.x, p1.x, p2.x, p3.x),
        spline(p0.y, p1.y, p2.y, p3.y),
        spline(p0.z, p1.z, p2.z, p3.z)
      );
    }
  }
  const lastPoint = points[points.length - 1];
  if (lastPoint !== undefined) samples.push(lastPoint.x, lastPoint.y, lastPoint.z);

  const xyz = new Float64Array(samples);
  const count = xyz.length / 3;
  const at = new Float64Array(count);
  for (let i = 1; i < count; i += 1) {
    const dx = (xyz[i * 3] ?? 0) - (xyz[i * 3 - 3] ?? 0);
    const dy = (xyz[i * 3 + 1] ?? 0) - (xyz[i * 3 - 2] ?? 0);
    const dz = (xyz[i * 3 + 2] ?? 0) - (xyz[i * 3 - 1] ?? 0);
    at[i] = (at[i - 1] ?? 0) + Math.hypot(dx, dy, dz);
  }
  return { xyz, at, total: at[count - 1] ?? 0 };
}

/** Position and unit tangent at a distance along the path. */
export function sampleAt(path: Path, s: number): {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
} {
  const count = path.at.length;
  if (count === 0) return { x: 0, y: 0, z: 0, tx: 1, ty: 0, tz: 0 };

  const distance = Math.max(0, Math.min(path.total, s));
  // Binary search: the sample spacing is uneven, so an index cannot be derived.
  let low = 0;
  let high = count - 1;
  while (low < high - 1) {
    const mid = (low + high) >> 1;
    if ((path.at[mid] ?? 0) <= distance) low = mid;
    else high = mid;
  }

  const a = path.at[low] ?? 0;
  const b = path.at[high] ?? a;
  const span = b - a;
  const t = span > 0 ? (distance - a) / span : 0;

  const x0 = path.xyz[low * 3] ?? 0;
  const y0 = path.xyz[low * 3 + 1] ?? 0;
  const z0 = path.xyz[low * 3 + 2] ?? 0;
  const x1 = path.xyz[high * 3] ?? x0;
  const y1 = path.xyz[high * 3 + 1] ?? y0;
  const z1 = path.xyz[high * 3 + 2] ?? z0;

  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  const length = Math.hypot(dx, dy, dz) || 1;

  return {
    x: x0 + dx * t,
    y: y0 + dy * t,
    z: z0 + dz * t,
    tx: dx / length,
    ty: dy / length,
    tz: dz / length,
  };
}

/**
 * Advances everything in the tube by `dt`, returning whatever reached the end.
 *
 * The only force is gravity resolved along the tangent — `g · ty`, since `ty`
 * IS the sine of the tube's angle for a unit tangent. That one line is what
 * gives the ride its character: a particle gains speed down the entry drop,
 * spends it climbing the loop, and is slowest at the top, exactly where a
 * rollercoaster is.
 */
export function stepTube(
  carried: Carried[],
  path: Path,
  dt: number
): Ejected[] {
  const out: Ejected[] = [];

  for (let i = carried.length - 1; i >= 0; i -= 1) {
    const particle = carried[i];
    if (particle === undefined) continue;

    const here = sampleAt(path, particle.s);
    particle.v += TUBE_GRAVITY * here.ty * dt;
    particle.v *= Math.pow(TUBE_DRAG, dt);

    // A stall in a climb rolls back rather than stopping dead in the glass.
    if (particle.v < STALL_SPEED && here.ty < 0) particle.v = STALL_SPEED;

    particle.s += particle.v * dt;

    if (particle.s >= path.total) {
      const exit = sampleAt(path, path.total);
      out.push({
        x: exit.x,
        y: exit.y,
        z: exit.z,
        vx: exit.tx * particle.v,
        vy: exit.ty * particle.v,
        vz: exit.tz * particle.v,
        size: particle.size,
        color: particle.color,
      });
      carried.splice(i, 1);
      continue;
    }
    // Cannot run backwards out of the intake.
    if (particle.s < 0) {
      particle.s = 0;
      particle.v = Math.max(particle.v, INTAKE_SPEED * 0.3);
    }
  }
  return out;
}

/**
 * Advances the spray and reports what hit the wall.
 *
 * `wallX` is the plane the nozzle is aimed at. A particle crossing it is gone
 * and its impact is returned, so the caller can add the paint.
 */
export function stepSpray(
  spray: Ejected[],
  dt: number,
  gravity: number,
  wallX: number,
  height: number
): { y: number; color: number; size: number; speed: number }[] {
  const hits: { y: number; color: number; size: number; speed: number }[] = [];

  for (let i = spray.length - 1; i >= 0; i -= 1) {
    const particle = spray[i];
    if (particle === undefined) continue;

    particle.vy += gravity * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.z += particle.vz * dt;
    // Drifts back toward the plane of the page as it flies, so paint thrown
    // from a deep part of the track still lands on the wall the viewer sees.
    particle.vz *= Math.pow(0.2, dt);

    if (particle.x >= wallX) {
      hits.push({
        y: particle.y,
        color: particle.color,
        size: particle.size,
        speed: Math.hypot(particle.vx, particle.vy),
      });
      spray.splice(i, 1);
      continue;
    }
    if (particle.y > height + 80 || particle.x < -80) spray.splice(i, 1);
  }
  return hits;
}
