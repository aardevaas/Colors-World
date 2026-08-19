/**
 * Dominant-colour extraction via k-means clustered in OKLab space.
 *
 * Deliberately takes plain {r,g,b} samples rather than ImageData/Canvas —
 * this stays framework- and DOM-agnostic (testable in Node, reusable if the
 * app ever extracts server-side) while the caller owns how pixels get
 * sampled from an actual image.
 *
 * Clustering happens in OKLab (Cartesian, perceptually-uniform), not raw
 * sRGB. Euclidean distance in sRGB does not track how different two colours
 * actually look — e.g. it can merge a saturated orange with a muddy brown
 * that sRGB happens to place nearby, while splitting perceptually-similar
 * blues that sRGB spreads apart. OKLab's Euclidean distance is built to
 * approximate perceived difference, so the same k-means loop over OKLab
 * centroids yields dominant colours that actually look distinct from each
 * other. Cartesian OKLab (l, a, b) is used rather than polar OKLCH so hue
 * wraparound (0°/360°) never distorts the distance metric.
 */

import { converter } from 'culori';

export interface RgbSample {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface OklabSample {
  readonly l: number;
  readonly a: number;
  readonly b: number;
}

const toOklab = converter('oklab');
const toRgb = converter('rgb');

const DEFAULT_CLUSTER_COUNT = 5;
const LLOYD_ITERATIONS = 8;

function rgbSampleToOklab(sample: RgbSample): OklabSample {
  const converted = toOklab({ mode: 'rgb', r: sample.r / 255, g: sample.g / 255, b: sample.b / 255 });
  return { l: converted.l, a: converted.a ?? 0, b: converted.b ?? 0 };
}

function oklabToRgbSample(sample: OklabSample): RgbSample {
  const converted = toRgb({ mode: 'oklab', l: sample.l, a: sample.a, b: sample.b });
  return {
    r: Math.round(clamp01(converted?.r ?? 0) * 255),
    g: Math.round(clamp01(converted?.g ?? 0) * 255),
    b: Math.round(clamp01(converted?.b ?? 0) * 255),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Returns up to `clusterCount` dominant colours, ordered by how many sampled
 * pixels each one represents (most dominant first).
 *
 * Centroids seed by farthest-point selection rather than at random, so the
 * same image always extracts the same palette — a re-drop shouldn't reshuffle
 * results.
 *
 * They used to be spaced evenly through the pixel array, which spaces them by
 * position in the *image* rather than position in colour space. Two seeds
 * then land on the same colour while a genuinely distinct one gets no seed at
 * all, and its pixels are absorbed into whichever cluster happens to be
 * nearest — dragging that centroid to a blend of the two. Measured on a
 * four-colour test image, green and near-white were reliably returned as a
 * single pale green, at every size and layout tried.
 */
export function extractDominantColors(
  pixels: readonly RgbSample[],
  clusterCount: number = DEFAULT_CLUSTER_COUNT
): RgbSample[] {
  if (pixels.length === 0) {
    throw new Error('extractDominantColors requires at least one pixel sample.');
  }

  const oklabPixels = pixels.map(rgbSampleToOklab);

  const k = Math.min(clusterCount, oklabPixels.length);
  const centroids = seedFarthestFirst(oklabPixels, k);

  // Farthest-point seeding stops early when the image has fewer distinct
  // colours than clusters were asked for, so the working count comes from the
  // seeds actually placed rather than from the request.
  const clusters = centroids.length;

  let assignments = new Array<number>(oklabPixels.length).fill(0);

  for (let iteration = 0; iteration < LLOYD_ITERATIONS; iteration += 1) {
    assignments = oklabPixels.map((pixel) => nearestCentroidIndex(pixel, centroids));

    const sums = Array.from({ length: clusters }, () => ({ l: 0, a: 0, b: 0, count: 0 }));
    for (let p = 0; p < oklabPixels.length; p += 1) {
      const bucket = sums[assignments[p]!]!;
      bucket.l += oklabPixels[p]!.l;
      bucket.a += oklabPixels[p]!.a;
      bucket.b += oklabPixels[p]!.b;
      bucket.count += 1;
    }

    for (let c = 0; c < clusters; c += 1) {
      const bucket = sums[c]!;
      if (bucket.count > 0) {
        centroids[c] = { l: bucket.l / bucket.count, a: bucket.a / bucket.count, b: bucket.b / bucket.count };
      }
    }
  }

  const populations = new Array<number>(clusters).fill(0);
  for (const clusterIndex of assignments) populations[clusterIndex]! += 1;

  return centroids
    .map((centroid, index) => ({ centroid, population: populations[index]! }))
    .sort((a, b) => b.population - a.population)
    .map(({ centroid }) => oklabToRgbSample(centroid));
}

/**
 * Picks starting centroids that are as far apart in colour as the image
 * allows: the first pixel, then repeatedly whichever pixel is farthest from
 * every centroid chosen so far.
 *
 * Deterministic, which is the property the previous approach was reaching for
 * and the reason this is not seeded at random — the same image has to produce
 * the same palette every time it is dropped. What it adds is a guarantee the
 * old approach could not make: every visually distinct region of the image
 * gets a seed before any region gets a second one.
 */
function seedFarthestFirst(pixels: readonly OklabSample[], k: number): OklabSample[] {
  const centroids: OklabSample[] = [{ ...pixels[0]! }];
  if (k === 1) return centroids;

  // Distance from each pixel to its nearest chosen centroid, updated as
  // centroids are added rather than recomputed from scratch each round.
  const nearest = pixels.map((pixel) => squaredDistance(pixel, centroids[0]!));

  while (centroids.length < k) {
    let farthestIndex = 0;
    let farthestDistance = -1;
    for (let i = 0; i < pixels.length; i += 1) {
      if (nearest[i]! > farthestDistance) {
        farthestDistance = nearest[i]!;
        farthestIndex = i;
      }
    }
    // Every remaining pixel already sits on a centroid: the image has fewer
    // distinct colours than clusters asked for, and more seeds would only
    // produce duplicates.
    if (farthestDistance <= 0) break;

    const chosen = { ...pixels[farthestIndex]! };
    centroids.push(chosen);
    for (let i = 0; i < pixels.length; i += 1) {
      const distance = squaredDistance(pixels[i]!, chosen);
      if (distance < nearest[i]!) nearest[i] = distance;
    }
  }

  return centroids;
}

function squaredDistance(a: OklabSample, b: OklabSample): number {
  const dl = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dl * dl + da * da + db * db;
}

function nearestCentroidIndex(pixel: OklabSample, centroids: readonly OklabSample[]): number {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < centroids.length; i += 1) {
    const centroid = centroids[i]!;
    const dl = pixel.l - centroid.l;
    const da = pixel.a - centroid.a;
    const db = pixel.b - centroid.b;
    const distance = dl * dl + da * da + db * db;
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
