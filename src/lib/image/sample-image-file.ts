import { extractDominantColors, rgbToHex, type RgbSample } from './extract-palette';

/**
 * Browser-only: draws a File onto an offscreen canvas and samples it down
 * to dominant colors. Never import this from a Server Component or
 * Server Action — it needs `document`/`createImageBitmap`.
 */

const SAMPLE_MAX_DIMENSION = 120;
const MIN_ALPHA_TO_SAMPLE = 32;

export async function extractPaletteFromImageFile(
  file: File,
  clusterCount = 5
): Promise<string[]> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SAMPLE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas 2D context unavailable — cannot sample this image.');
  }
  context.drawImage(bitmap, 0, 0, width, height);

  const { data } = context.getImageData(0, 0, width, height);
  const pixels: RgbSample[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]!;
    if (alpha < MIN_ALPHA_TO_SAMPLE) continue;
    pixels.push({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
  }

  if (pixels.length === 0) {
    throw new Error('That image had no visible pixels to sample a palette from.');
  }

  return extractDominantColors(pixels, clusterCount).map(rgbToHex);
}
