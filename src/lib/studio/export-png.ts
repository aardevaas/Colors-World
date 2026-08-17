/**
 * PNG export helpers for the Studio board — bounding-box math (pure,
 * tested) plus canvas-based watermark compositing (browser-only, needs a
 * real DOM/canvas so it isn't unit-tested; verified manually instead).
 */

export interface ExportRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ExportBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const DEFAULT_EXPORT_PADDING = 60;

/**
 * The world-space region an export should capture: every card's bounding
 * box, padded evenly on each side. Returns a zero-size box at the origin
 * for an empty board rather than throwing — callers should check for that
 * and skip the export instead of capturing nothing.
 */
export function computeExportBounds(
  rects: readonly ExportRect[],
  padding: number = DEFAULT_EXPORT_PADDING
): ExportBounds {
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }

  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load the captured board image for watermarking.'));
    image.src = src;
  });
}

/**
 * Composites a small watermark label into the bottom-right corner of an
 * already-captured PNG. Takes a data URL in, returns a new data URL out —
 * the capture step (domToPng) and the watermark step stay independent so
 * a watermarking failure never loses the underlying capture.
 */
export async function compositeWatermark(
  pngDataUrl: string,
  width: number,
  height: number,
  label: string
): Promise<string> {
  const image = await loadImage(pngDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return pngDataUrl;

  ctx.drawImage(image, 0, 0, width, height);

  const fontSize = Math.max(14, Math.round(width * 0.014));
  const margin = fontSize;
  ctx.font = `600 ${fontSize}px "Geist Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText(label, width - margin, height - margin);

  return canvas.toDataURL('image/png');
}

/** Triggers a browser download of a data URL without a server round-trip. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
