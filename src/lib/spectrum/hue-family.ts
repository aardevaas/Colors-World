/**
 * Human names for OKLCH hue ranges — labels the Spectrum's sticky header and
 * hue-family filter. Boundaries are approximate (hue is continuous; names
 * aren't) but stable, so "you're deep in the blues" always means the same
 * thing as you scroll.
 */
export interface HueFamily {
  readonly name: string;
  readonly minHue: number;
  readonly maxHue: number;
}

export const HUE_FAMILIES: readonly HueFamily[] = [
  { name: 'reds', minHue: 0, maxHue: 20 },
  { name: 'oranges', minHue: 20, maxHue: 50 },
  { name: 'ambers', minHue: 50, maxHue: 70 },
  { name: 'yellows', minHue: 70, maxHue: 100 },
  { name: 'greens', minHue: 100, maxHue: 160 },
  { name: 'teals', minHue: 160, maxHue: 190 },
  { name: 'cyans', minHue: 190, maxHue: 210 },
  { name: 'blues', minHue: 210, maxHue: 260 },
  { name: 'violets', minHue: 260, maxHue: 290 },
  { name: 'purples', minHue: 290, maxHue: 320 },
  { name: 'magentas', minHue: 320, maxHue: 345 },
  { name: 'pinks', minHue: 345, maxHue: 360 },
];

export function hueFamilyName(hue: number): string {
  const normalized = ((hue % 360) + 360) % 360;
  const family = HUE_FAMILIES.find((f) => normalized >= f.minHue && normalized < f.maxHue);
  return family?.name ?? 'reds';
}
