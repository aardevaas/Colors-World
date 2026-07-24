/**
 * A decorative stand-in for the reference ticket's barcode — not a real
 * scannable code, just bars whose widths hash from the route string so every
 * card gets a distinct, stable pattern with zero image assets and no
 * per-card manual tuning. Uses `currentColor` for the bars so the visible
 * tint is controlled entirely by CSS `color`, not baked into the gradient.
 */

const BAR_COUNT = 28;

function hashBarWidth(route: string, index: number): number {
  const char = route.charCodeAt(index % route.length) || 0;
  // 1..4 units — enough spread to read as an irregular barcode rather than
  // a uniform ladder, without any one bar dominating the strip.
  return 1 + ((char + index * 31) % 4);
}

export function routeBarcodeGradient(route: string): string {
  const widths = Array.from({ length: BAR_COUNT }, (_, i) => hashBarWidth(route, i));
  const total = widths.reduce((sum, width) => sum + width, 0);

  let cursor = 0;
  const stops: string[] = [];
  widths.forEach((width, i) => {
    const start = (cursor / total) * 100;
    cursor += width;
    const end = (cursor / total) * 100;
    const color = i % 2 === 0 ? 'currentColor' : 'transparent';
    stops.push(`${color} ${start.toFixed(3)}%`, `${color} ${end.toFixed(3)}%`);
  });

  return `linear-gradient(to right, ${stops.join(', ')})`;
}
