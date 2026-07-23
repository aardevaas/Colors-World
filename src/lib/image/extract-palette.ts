/**
 * Dominant-colour extraction via k-means over raw RGB samples.
 *
 * Deliberately takes plain {r,g,b} samples rather than ImageData/Canvas —
 * this stays framework- and DOM-agnostic (testable in Node, reusable if the
 * app ever extracts server-side) while the caller owns how pixels get
 * sampled from an actual image.
 */

export interface RgbSample {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const DEFAULT_CLUSTER_COUNT = 5;
const LLOYD_ITERATIONS = 8;

/**
 * Returns up to `clusterCount` dominant colours, ordered by how many sampled
 * pixels each one represents (most dominant first).
 *
 * Centroids seed from evenly-spaced samples (not random) so the same image
 * always extracts the same palette — a re-drop shouldn't reshuffle results.
 */
export function extractDominantColors(
  pixels: readonly RgbSample[],
  clusterCount: number = DEFAULT_CLUSTER_COUNT
): RgbSample[] {
  if (pixels.length === 0) {
    throw new Error('extractDominantColors requires at least one pixel sample.');
  }

  const k = Math.min(clusterCount, pixels.length);
  const centroids: RgbSample[] = [];
  for (let i = 0; i < k; i += 1) {
    centroids.push({ ...pixels[Math.floor((i * pixels.length) / k)]! });
  }

  let assignments = new Array<number>(pixels.length).fill(0);

  for (let iteration = 0; iteration < LLOYD_ITERATIONS; iteration += 1) {
    assignments = pixels.map((pixel) => nearestCentroidIndex(pixel, centroids));

    const sums = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, count: 0 }));
    for (let p = 0; p < pixels.length; p += 1) {
      const bucket = sums[assignments[p]!]!;
      bucket.r += pixels[p]!.r;
      bucket.g += pixels[p]!.g;
      bucket.b += pixels[p]!.b;
      bucket.count += 1;
    }

    for (let c = 0; c < k; c += 1) {
      const bucket = sums[c]!;
      if (bucket.count > 0) {
        centroids[c] = { r: bucket.r / bucket.count, g: bucket.g / bucket.count, b: bucket.b / bucket.count };
      }
    }
  }

  const populations = new Array<number>(k).fill(0);
  for (const clusterIndex of assignments) populations[clusterIndex]! += 1;

  return centroids
    .map((centroid, index) => ({ centroid, population: populations[index]! }))
    .sort((a, b) => b.population - a.population)
    .map(({ centroid }) => ({
      r: Math.round(centroid.r),
      g: Math.round(centroid.g),
      b: Math.round(centroid.b),
    }));
}

function nearestCentroidIndex(pixel: RgbSample, centroids: readonly RgbSample[]): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < centroids.length; i += 1) {
    const centroid = centroids[i]!;
    const dr = pixel.r - centroid.r;
    const dg = pixel.g - centroid.g;
    const db = pixel.b - centroid.b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function rgbToHex({ r, g, b }: RgbSample): string {
  const channel = (value: number) => Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}
