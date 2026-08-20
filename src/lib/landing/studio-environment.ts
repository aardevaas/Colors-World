/**
 * The environment the lettering reflects.
 *
 * The reference ships a 1.01 MB PNG for this. It does not need to be an asset:
 * what the surface actually needs is *structure* — bright bands separated by
 * dark gaps — because the sweeping highlight that sells the glossy material is
 * the environment sliding across the surface as the mesh turns, not an
 * animated specular. A smooth gradient produces a smooth, characterless
 * highlight no matter how the shader is tuned.
 *
 * So it is drawn at runtime into an equirectangular canvas and handed to
 * three's PMREM generator. Zero bytes over the wire, and the band layout is a
 * tunable rather than a file someone has to re-export.
 *
 * The band maths is separated from the drawing so it can be reasoned about
 * without a canvas.
 */

export interface Band {
  /** Vertical centre, 0 (top) to 1 (bottom) of the equirect. */
  readonly center: number;
  /** Height as a fraction of the map. */
  readonly height: number;
  /** Emission multiplier — above 1 so it reads as a light, not a wall. */
  readonly intensity: number;
  /** Horizontal skew, so bands read as angled softboxes rather than stripes. */
  readonly skew: number;
}

/**
 * A three-band studio rig: a broad key above, a tighter fill below it, and a
 * thin rim near the horizon. Unequal on purpose — three equal bands read as
 * wallpaper, and the reference's highlights are plainly of differing weights.
 */
export const STUDIO_BANDS: readonly Band[] = [
  { center: 0.20, height: 0.15, intensity: 7.0, skew: 0.22 },
  { center: 0.42, height: 0.07, intensity: 3.4, skew: -0.15 },
  { center: 0.60, height: 0.03, intensity: 2.0, skew: 0.32 },
];

/** How bright the environment is at a given point, before the base gradient. */
export function bandIntensityAt(u: number, v: number, bands: readonly Band[] = STUDIO_BANDS): number {
  let total = 0;
  for (const band of bands) {
    // Skew shifts the band's centre with u, which is what angles it.
    const center = band.center + (u - 0.5) * band.skew;
    const distance = Math.abs(v - center);
    const half = band.height / 2;
    if (distance >= half) continue;
    // Smooth falloff to the band edge, so reflections have soft shoulders
    // instead of a hard line that reads as a seam.
    const falloff = 1 - distance / half;
    total += band.intensity * falloff * falloff;
  }
  return total;
}

/** The dark-to-light vertical wash the bands sit on. */
export function baseGradientAt(v: number): readonly [number, number, number] {
  const t = clamp01(v);
  // Deep near-black at the bottom rising to a cool bright sky.
  const top: readonly [number, number, number] = [0.62, 0.70, 1.0];
  const bottom: readonly [number, number, number] = [0.01, 0.012, 0.05];
  const k = Math.pow(1 - t, 1.7);
  return [
    bottom[0] + (top[0] - bottom[0]) * k,
    bottom[1] + (top[1] - bottom[1]) * k,
    bottom[2] + (top[2] - bottom[2]) * k,
  ];
}

/**
 * Draws the equirectangular environment. Returns the canvas so the caller can
 * wrap it in a texture; kept separate from three so this module stays testable.
 */
export function drawStudioEnvironment(width = 512, height = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return canvas;

  const image = ctx.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const base = baseGradientAt(v);
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const lift = bandIntensityAt(u, v);
      const i = (y * width + x) * 4;
      // Clamped to 8-bit here; PMREM still resolves a convincing highlight
      // because the bands are wide relative to the roughness kernel.
      data[i] = to8(base[0] + lift);
      data[i + 1] = to8(base[1] + lift);
      data[i + 2] = to8(base[2] + lift);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function to8(linear: number): number {
  return Math.max(0, Math.min(255, Math.round(clamp01(linear) * 255)));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
