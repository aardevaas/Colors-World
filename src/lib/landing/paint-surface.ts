/**
 * Letterforms turned into a lit surface of paint.
 *
 * Takes the coverage of some drawn glyphs and returns an RGBA texture the
 * shader can sample directly: RGB is the surface normal, A is antialiased
 * coverage. Everything expensive happens here, once, on the CPU at startup —
 * the fragment shader then does no gradient reconstruction at all, it just
 * reads a normal and lights it.
 *
 * ## Why the normal is baked rather than derived in the shader
 *
 * The obvious alternative is to upload the distance field and take its
 * gradient per-pixel. That needs the field at better than 8-bit precision to
 * avoid banding in the lighting, and float textures that filter linearly are
 * not universally available — the workarounds (packing 16 bits across two
 * channels) break under linear filtering exactly at texel boundaries, which is
 * everywhere that matters.
 *
 * Normals do not have that problem. Eight bits per component is plenty,
 * linear filtering between two normals is meaningful rather than nonsense, and
 * a renormalise in the shader cleans up the interpolation. So the precision
 * gets spent where it survives the trip to the GPU.
 *
 * ## The cross-section
 *
 * Height is a circle: at distance `d` inside the edge of a stroke of radius
 * `r`, the surface sits at `sqrt(r² - (r - d)²)`, flattening to `r` once `d`
 * passes `r`. That is what makes a stroke read as a rounded tube of paint
 * rather than as a slab — and why a thick stroke gets a flat top and a thin
 * one never does.
 *
 * Pure: no DOM, no canvas, no WebGL.
 */

import { signedDistanceField } from './distance-field';

export interface DecodedNormal {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * @param coverage One value per pixel; above 0.5 is inside a glyph.
 * @param radius How far, in pixels, the tube takes to reach full height. Small
 *   values give hard piping, large values give soft blown-up lettering.
 */
export function buildPaintSurface(
  coverage: Readonly<Float32Array>,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  const field = signedDistanceField(coverage, width, height);
  const safeRadius = Math.max(1e-3, radius);

  const heights = new Float32Array(width * height);
  for (let i = 0; i < heights.length; i += 1) {
    heights[i] = heightAt(field[i]!, safeRadius);
  }

  const surface = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      // Central differences, clamped at the borders. The 0.5 factor is the
      // usual one for a two-sample central difference over a two-pixel span.
      const dx =
        (sample(heights, width, height, x + 1, y) -
          sample(heights, width, height, x - 1, y)) *
        0.5;
      const dy =
        (sample(heights, width, height, x, y + 1) -
          sample(heights, width, height, x, y - 1)) *
        0.5;

      // A height field's normal is (-dh/dx, -dh/dy, 1) before normalising.
      const length = Math.hypot(dx, dy, 1) || 1;
      const offset = index * 4;
      surface[offset] = encode(-dx / length);
      surface[offset + 1] = encode(-dy / length);
      surface[offset + 2] = encode(1 / length);
      // Coverage is carried straight through from the input rather than
      // re-derived from the field. The field is computed from a *thresholded*
      // grid, so on a pixel lattice its values are whole numbers and any ramp
      // built from it would be binary -- an antialiased edge that does not
      // antialias. The canvas already rasterised the glyphs with proper
      // coverage; keeping it is both free and better than anything recoverable
      // after the threshold.
      surface[offset + 3] = Math.round(clamp01(coverage[index] ?? 0) * 255);
    }
  }
  return surface;
}

/** Reads a normal back out of the packed texture, for tests and debugging. */
export function decodeNormal(surface: Readonly<Uint8Array>, offset: number): DecodedNormal {
  return {
    x: (surface[offset]! / 255) * 2 - 1,
    y: (surface[offset + 1]! / 255) * 2 - 1,
    z: (surface[offset + 2]! / 255) * 2 - 1,
  };
}

function heightAt(distance: number, radius: number): number {
  if (distance <= 0) return 0;
  if (distance >= radius) return radius;
  const inset = radius - distance;
  return Math.sqrt(Math.max(0, radius * radius - inset * inset));
}

function sample(
  heights: Readonly<Float32Array>,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  const cx = Math.min(width - 1, Math.max(0, x));
  const cy = Math.min(height - 1, Math.max(0, y));
  return heights[cy * width + cx]!;
}

function encode(component: number): number {
  return Math.round(clamp01(component * 0.5 + 0.5) * 255);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
