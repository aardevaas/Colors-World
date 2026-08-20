/**
 * An exact signed distance field, which is what turns flat letterforms into
 * inflated tubes of paint.
 *
 * The hero draws "Colors World" to an offscreen canvas and needs, for every
 * pixel, how far it is from the nearest edge of a glyph. That number is used
 * as height: a cross-section of `sqrt(r² - d²)` gives a rounded tube, and the
 * gradient of that height gives the surface normal to light. Everything glossy
 * about the result comes from this one array being correct.
 *
 * ## Why exact, and not a blur
 *
 * The cheap version is to blur the glyph alpha and call the result a height
 * map. It works until it doesn't: a blur's falloff is bounded by its radius,
 * so thick strokes come out with flat tops, and its gradient is wrong near
 * corners, which shows up as visible faceting along every curve. Approximate
 * transforms — Manhattan, chamfer — have the same problem in a different
 * shape: they are wrong on diagonals, which is most of a script letterform.
 *
 * So this is the exact Euclidean transform (Felzenszwalb & Huttenlocher's
 * lower-envelope algorithm), which is linear in the number of pixels and runs
 * once at startup. It is a parabola-envelope sweep along each column, then
 * along each row; the two together give exact squared distances.
 *
 * Pure: no DOM, no canvas, no WebGL — takes a coverage grid, returns numbers.
 */

/** Squared distance standing in for infinity, kept well inside float range so
 *  intermediate sums cannot overflow. */
const FAR = 1e10;

/**
 * Signed distance to the nearest edge, in pixels, for every cell.
 *
 * `coverage` is one value per cell: anything above 0.5 counts as inside. The
 * result is positive inside a shape and negative outside it.
 */
export function signedDistanceField(
  coverage: Readonly<Float32Array>,
  width: number,
  height: number
): Float32Array {
  const inside = new Float32Array(width * height);
  const outside = new Float32Array(width * height);

  for (let i = 0; i < coverage.length; i += 1) {
    const isInside = (coverage[i] ?? 0) > 0.5;
    // Each transform measures distance *to* its own zero set: the inside pass
    // seeds the outside cells at zero and asks how far the inside cells are
    // from them, and vice versa.
    inside[i] = isInside ? FAR : 0;
    outside[i] = isInside ? 0 : FAR;
  }

  squaredDistance(inside, width, height);
  squaredDistance(outside, width, height);

  const field = new Float32Array(width * height);
  for (let i = 0; i < field.length; i += 1) {
    // One of the two is always zero, so this is a branchless way of saying
    // "distance out of the shape, negated when we are outside it".
    field[i] = Math.sqrt(inside[i]!) - Math.sqrt(outside[i]!);
  }
  return field;
}

/** In-place exact squared Euclidean distance transform, columns then rows. */
function squaredDistance(grid: Float32Array, width: number, height: number): void {
  const column = new Float32Array(height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) column[y] = grid[y * width + x]!;
    const transformed = lowerEnvelope(column, height);
    for (let y = 0; y < height; y += 1) grid[y * width + x] = transformed[y]!;
  }

  const row = new Float32Array(width);
  for (let y = 0; y < height; y += 1) {
    const offset = y * width;
    for (let x = 0; x < width; x += 1) row[x] = grid[offset + x]!;
    const transformed = lowerEnvelope(row, width);
    for (let x = 0; x < width; x += 1) grid[offset + x] = transformed[x]!;
  }
}

/**
 * The one-dimensional half of the algorithm.
 *
 * Each cell defines an upward parabola rooted at its own value; the distance
 * transform of the line is the lower envelope of all of them. The sweep finds
 * where consecutive parabolas intersect, discarding any that the envelope has
 * already passed under, then reads the envelope off in a second pass. Linear,
 * because each parabola is pushed and popped at most once.
 */
function lowerEnvelope(f: Readonly<Float32Array>, n: number): Float32Array {
  const d = new Float32Array(n);
  /** Index of the parabola forming each piece of the envelope. */
  const v = new Int32Array(n);
  /** Boundaries between consecutive pieces. */
  const z = new Float32Array(n + 1);

  let k = 0;
  v[0] = 0;
  z[0] = -FAR;
  z[1] = FAR;

  for (let q = 1; q < n; q += 1) {
    let s = intersection(f, q, v[k]!);
    // Walk back over pieces this parabola has undercut entirely.
    while (k > 0 && s <= z[k]!) {
      k -= 1;
      s = intersection(f, q, v[k]!);
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = FAR;
  }

  k = 0;
  for (let q = 0; q < n; q += 1) {
    while (z[k + 1]! < q) k += 1;
    const distance = q - v[k]!;
    d[q] = distance * distance + f[v[k]!]!;
  }
  return d;
}

/** Where the parabolas rooted at `a` and `b` cross. */
function intersection(f: Readonly<Float32Array>, a: number, b: number): number {
  return (f[a]! + a * a - (f[b]! + b * b)) / (2 * a - 2 * b);
}
