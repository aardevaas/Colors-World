/**
 * PNG export for the /visualizer stage.
 *
 * The watermark deliberately sits on its own bar *below* the mockup rather than
 * composited into it — the Tab 04 spec asks for a credit that "looks premium by
 * default while remaining effortless to crop out". A watermark burned over the
 * artwork fails the second half of that: removing it means editing the image.
 * A separate footer strip means one straight crop.
 *
 * The layout maths is pure and tested here; the canvas compositing below needs
 * a real DOM and is verified in the browser instead.
 */

export interface ShowcaseLayout {
  readonly width: number;
  readonly height: number;
  readonly footerHeight: number;
  /** Y offset where the footer bar starts — also exactly where to crop. */
  readonly cropY: number;
}

/** Footer height as a fraction of image width, so it scales with the export. */
const FOOTER_RATIO = 0.055;
const MIN_FOOTER_PX = 36;

export function showcaseLayout(imageWidth: number, imageHeight: number): ShowcaseLayout {
  const footerHeight = Math.max(MIN_FOOTER_PX, Math.round(imageWidth * FOOTER_RATIO));
  return {
    width: imageWidth,
    height: imageHeight + footerHeight,
    footerHeight,
    cropY: imageHeight,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load the captured showcase image.'));
    image.src = src;
  });
}

/**
 * Draws the captured mockup with a credit bar appended underneath. Returns a
 * new data URL; the input capture is never modified, so a failure here can
 * never cost the underlying screenshot.
 */
export async function appendWatermarkFooter(
  pngDataUrl: string,
  label: string
): Promise<string> {
  const image = await loadImage(pngDataUrl);
  const layout = showcaseLayout(image.naturalWidth, image.naturalHeight);

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return pngDataUrl;

  ctx.drawImage(image, 0, 0);

  ctx.fillStyle = '#050508';
  ctx.fillRect(0, layout.cropY, layout.width, layout.footerHeight);

  const fontSize = Math.round(layout.footerHeight * 0.34);
  ctx.font = `600 ${fontSize}px "Geist Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText(label, layout.width / 2, layout.cropY + layout.footerHeight / 2);

  return canvas.toDataURL('image/png');
}
