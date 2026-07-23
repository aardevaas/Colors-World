/**
 * Monotone cubic Hermite interpolation (Fritsch–Carlson, 1980).
 *
 * Why not a plain cubic spline: a natural spline through user-pinned anchors will
 * happily overshoot, producing a "lighter" step that is actually darker than its
 * neighbour. That reads as a bug in a tonal ramp. Fritsch–Carlson constrains the
 * tangents so the curve can never overshoot between control points, which is
 * exactly the guarantee a lightness ramp needs.
 */

export interface ControlPoint {
  readonly x: number;
  readonly y: number;
}

/** Fritsch–Carlson tangent-limiting constant: α² + β² must not exceed 9. */
const MONOTONICITY_LIMIT = 9;

/**
 * Builds an interpolating function passing exactly through every control point.
 * Points must be sorted ascending by x and have distinct x values.
 */
export function monotoneInterpolator(
  points: readonly ControlPoint[]
): (x: number) => number {
  if (points.length === 0) {
    throw new Error('monotoneInterpolator requires at least one control point');
  }

  const first = points[0]!;
  if (points.length === 1) {
    return () => first.y;
  }

  for (let i = 1; i < points.length; i += 1) {
    if (points[i]!.x <= points[i - 1]!.x) {
      throw new Error(
        `Control points must be strictly ascending in x (index ${i}: ${points[i]!.x} follows ${points[i - 1]!.x})`
      );
    }
  }

  const n = points.length;
  const secants: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    secants.push((b.y - a.y) / (b.x - a.x));
  }

  // Initial tangents: average of adjacent secants, one-sided at the ends.
  const tangents: number[] = new Array(n);
  tangents[0] = secants[0]!;
  tangents[n - 1] = secants[n - 2]!;
  for (let i = 1; i < n - 1; i += 1) {
    tangents[i] = (secants[i - 1]! + secants[i]!) / 2;
  }

  // Fritsch–Carlson limiting: flatten across plateaus, then rescale any tangent
  // pair that would let the cubic overshoot its bracketing control points.
  for (let i = 0; i < n - 1; i += 1) {
    const secant = secants[i]!;
    if (secant === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const alpha = tangents[i]! / secant;
    const beta = tangents[i + 1]! / secant;
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > MONOTONICITY_LIMIT) {
      const tau = 3 / Math.sqrt(magnitude);
      tangents[i] = tau * alpha * secant;
      tangents[i + 1] = tau * beta * secant;
    }
  }

  return (x: number): number => {
    // Outside the control range we hold the endpoint value rather than
    // extrapolating — an extrapolated lightness is never what the caller wants.
    if (x <= first.x) return first.y;
    const last = points[n - 1]!;
    if (x >= last.x) return last.y;

    let k = 0;
    while (k < n - 2 && x > points[k + 1]!.x) k += 1;

    const a = points[k]!;
    const b = points[k + 1]!;
    const h = b.x - a.x;
    const t = (x - a.x) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    return (
      h00 * a.y + h10 * h * tangents[k]! + h01 * b.y + h11 * h * tangents[k + 1]!
    );
  };
}

/**
 * Interpolates a hue channel, taking the shortest angular path between control
 * points. Hue is circular: interpolating 350° → 10° must cross 0°, not sweep
 * backwards through the entire wheel.
 */
export function monotoneHueInterpolator(
  points: readonly ControlPoint[]
): (x: number) => number {
  if (points.length === 0) {
    throw new Error('monotoneHueInterpolator requires at least one control point');
  }

  // Unwrap the hue sequence into a continuous (non-circular) domain so the
  // monotone interpolator sees a well-behaved function, then re-wrap on output.
  const unwrapped: ControlPoint[] = [{ x: points[0]!.x, y: points[0]!.y }];
  for (let i = 1; i < points.length; i += 1) {
    const previous = unwrapped[i - 1]!.y;
    const raw = points[i]!.y;
    const delta = ((raw - previous + 540) % 360) - 180;
    unwrapped.push({ x: points[i]!.x, y: previous + delta });
  }

  const interpolate = monotoneInterpolator(unwrapped);
  return (x: number) => normalizeHue(interpolate(x));
}

/** Wraps any angle into [0, 360). */
export function normalizeHue(hue: number): number {
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}
