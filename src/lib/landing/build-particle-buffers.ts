import {
  composeIndex,
  indexToSwatch,
  SPECTRUM_STEPS,
} from '@/lib/spectrum/generate-color';

/**
 * Builds every GPU buffer the landing-page particle system needs, once, on the
 * CPU — after this the whole experience is uniform-driven and the CPU never
 * touches a particle again.
 *
 * The colours are not decorative stand-ins: each particle is a real index into
 * the same 16,777,216-colour arithmetic space the Spectrum browses
 * (`composeIndex` / `indexToSwatch`). Nothing is stored or fetched — a 24-bit
 * index *is* the colour, and every representation (HEX, sRGB, CMYK, OKLCH)
 * is a pure function of it.
 *
 * Positions come from a Fibonacci lattice rather than a naive lat/long grid.
 * A lat/long grid bunches points at the poles and leaves gaps at the equator;
 * the lattice spaces them near-uniformly over the sphere, which is what lets
 * ~30k discrete points read as one continuous, gapless shell (the "ultra-dense
 * particle shell", no geometry swap needed).
 *
 * Colour is then derived *from* each point's own position — longitude sweeps
 * hue, latitude sweeps lightness — so the assembled globe is a smooth
 * spectrum by construction rather than by luck, and the rain that precedes it
 * is already wearing its final colour as it falls.
 */

/** Distinct hues resolvable around the equator; below this the globe bands. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Kept off the true poles — pure black/white carry no hue to show. */
const LIGHTNESS_MARGIN = 0.06;

/** Vivid, but not uniformly maxed — a little variance reads as depth. */
const MIN_CHROMA_FRACTION = 0.82;

export interface ParticleBuffers {
  readonly count: number;
  /** xyz per particle: x/z are the rain column, y is a 0..1 fall phase. */
  readonly rainStart: Float32Array;
  /** xyz per particle: its assigned seat on the globe. */
  readonly spherePos: Float32Array;
  /** rgb per particle, 0..1, straight from the colour engine. */
  readonly color: Float32Array;
  /** Per-particle fall-rate multiplier. */
  readonly speed: Float32Array;
  /** Per-particle base point size in world units. */
  readonly size: Float32Array;
  /** i / (count - 1) — drives the progressive reveal from ~50 to all of them. */
  readonly indexNorm: Float32Array;
  /** Hex strings, parallel to the buffers, for the hover/click readout. */
  readonly hex: readonly string[];
}

export interface BuildParticleBuffersOptions {
  readonly count: number;
  /** World-space radius of the assembled globe. */
  readonly sphereRadius: number;
  /** World-space box the rain falls through. */
  readonly fieldWidth: number;
  readonly fieldDepth: number;
  /** Deterministic jitter source, so a given seed always builds the same field. */
  readonly random?: () => number;
}

export function buildParticleBuffers({
  count,
  sphereRadius,
  fieldWidth,
  fieldDepth,
  random = Math.random,
}: BuildParticleBuffersOptions): ParticleBuffers {
  const rainStart = new Float32Array(count * 3);
  const spherePos = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const size = new Float32Array(count);
  const indexNorm = new Float32Array(count);
  const hex: string[] = new Array<string>(count);

  const lastIndex = Math.max(1, count - 1);

  for (let i = 0; i < count; i += 1) {
    // --- even distribution over the sphere (Fibonacci lattice) ---
    const unitY = 1 - (i / lastIndex) * 2; // +1 (north) .. -1 (south)
    const ringRadius = Math.sqrt(Math.max(0, 1 - unitY * unitY));
    const theta = GOLDEN_ANGLE * i;
    const unitX = Math.cos(theta) * ringRadius;
    const unitZ = Math.sin(theta) * ringRadius;

    spherePos[i * 3] = unitX * sphereRadius;
    spherePos[i * 3 + 1] = unitY * sphereRadius;
    spherePos[i * 3 + 2] = unitZ * sphereRadius;

    // --- colour derived from that seat, via the real 16.7M engine ---
    // Longitude -> hue. atan2 returns -PI..PI; normalise to 0..1.
    const longitude = (Math.atan2(unitZ, unitX) + Math.PI) / (Math.PI * 2);
    // Latitude -> lightness. North pole is lightest (step 0 in the engine).
    const latitude = (1 - unitY) / 2; // 0 at north, 1 at south
    const lightnessFraction = LIGHTNESS_MARGIN + latitude * (1 - LIGHTNESS_MARGIN * 2);

    const hueStep = Math.min(SPECTRUM_STEPS - 1, Math.floor(longitude * SPECTRUM_STEPS));
    const lightnessStep = Math.min(
      SPECTRUM_STEPS - 1,
      Math.round(lightnessFraction * (SPECTRUM_STEPS - 1))
    );
    const chromaFraction = MIN_CHROMA_FRACTION + random() * (1 - MIN_CHROMA_FRACTION);
    const chromaStep = Math.round(chromaFraction * (SPECTRUM_STEPS - 1));

    const swatch = indexToSwatch(composeIndex({ lightnessStep, hueStep, chromaStep }));
    hex[i] = swatch.hex;

    // hex -> linear 0..1 floats for the shader.
    const packed = Number.parseInt(swatch.hex.slice(1), 16);
    color[i * 3] = ((packed >> 16) & 255) / 255;
    color[i * 3 + 1] = ((packed >> 8) & 255) / 255;
    color[i * 3 + 2] = (packed & 255) / 255;

    // --- rain seat: a random column, and a phase so the field starts full ---
    rainStart[i * 3] = (random() - 0.5) * fieldWidth;
    rainStart[i * 3 + 1] = random(); // fall phase, 0..1
    rainStart[i * 3 + 2] = (random() - 0.5) * fieldDepth;

    speed[i] = 0.55 + random() * 0.9;
    size[i] = 5 + random() * 7;
    indexNorm[i] = i / lastIndex;
  }

  return { count, rainStart, spherePos, color, speed, size, indexNorm, hex };
}
