/**
 * A palette, written out the way an internal brand guideline writes one.
 *
 * The existing exporters all take `GeneratedScale[]` — they describe a full
 * ramp system, which is what `/scales` produces. `/compose` produces something
 * earlier and flatter: a set of chosen colours, before anyone has decided how
 * each one deepens. That had no way out of the room at all, which broke the
 * rule that every room is a destination.
 *
 * The formats here are not arbitrary. A real manual states a colour in every
 * medium it will be reproduced in — Monash, IRBA, Commonwealth and Regus all
 * print HEX, RGB and CMYK against each swatch, and the grain study found that
 * "colour values across media" is a single section in the books that have it.
 * So the JSON export carries all five notations per colour rather than making
 * someone convert, and the CSS export carries the two a browser can use.
 *
 * Pure: no DOM, no clipboard, no download. The room does that; this decides
 * what the bytes are.
 */

import { formatCmyk, formatHsl, formatOklchCss, formatRgb, toCmyk, type Oklch } from '@/lib/color-engine';

/** The least a colour has to be for this module to describe it. */
export interface ExportableColor {
  readonly hex: string;
  readonly oklch: Oklch;
}

export type PaletteExportFormat = 'css' | 'json' | 'text';

/**
 * A CSS custom-property name for a colour at a given position.
 *
 * Positional rather than named, because at this stage the colours have no
 * roles yet — naming one `--brand-primary` here would be inventing a decision
 * the person has not made. `/scales` names them once an anchor exists.
 */
function varName(index: number): string {
  return `--color-${index + 1}`;
}

/**
 * Custom properties, in the two notations a browser understands.
 *
 * OKLCH is emitted alongside hex rather than instead of it: it is the honest
 * value — the whole system is authored in it — but a hex fallback costs one
 * line and covers every renderer that is not current.
 */
export function toPaletteCss(palette: readonly ExportableColor[]): string {
  if (palette.length === 0) return ':root {\n}\n';
  const hexLines = palette.map((c, i) => `  ${varName(i)}: ${c.hex};`);
  const oklchLines = palette.map((c, i) => `  ${varName(i)}-oklch: ${formatOklchCss(c.oklch)};`);
  return [
    ':root {',
    '  /* Hex, for every renderer. */',
    ...hexLines,
    '',
    '  /* OKLCH, which is what these colours actually are. */',
    ...oklchLines,
    '}',
    '',
  ].join('\n');
}

/**
 * Every notation a guideline states, per colour.
 *
 * Deliberately not a token format — those exist already and describe a scale
 * system. This is the palette as a *specification*: the same colour written
 * for screen, for print and for the engine, so nobody downstream has to
 * convert and get it slightly wrong.
 */
export function toPaletteJson(palette: readonly ExportableColor[]): string {
  return `${JSON.stringify(
    {
      palette: palette.map((c, i) => ({
        name: `color-${i + 1}`,
        hex: c.hex.toUpperCase(),
        rgb: formatRgb(c.oklch),
        hsl: formatHsl(c.oklch),
        oklch: formatOklchCss(c.oklch),
        cmyk: formatCmyk(toCmyk(c.oklch)),
      })),
      note: 'Spot colours are not included. Pantone is a licensed library and cannot be distributed — ask your printer to match the CMYK build.',
    },
    null,
    2
  )}\n`;
}

/** Plain hex, one per line — for pasting into anything at all. */
export function toPaletteText(palette: readonly ExportableColor[]): string {
  return palette.length === 0 ? '' : `${palette.map((c) => c.hex.toUpperCase()).join('\n')}\n`;
}

export function toPaletteExport(
  palette: readonly ExportableColor[],
  format: PaletteExportFormat
): string {
  switch (format) {
    case 'css':
      return toPaletteCss(palette);
    case 'json':
      return toPaletteJson(palette);
    case 'text':
      return toPaletteText(palette);
  }
}

/** The filename an export downloads as, per format. */
export function paletteFilename(format: PaletteExportFormat): string {
  const ext = format === 'css' ? 'css' : format === 'json' ? 'json' : 'txt';
  return `palette.${ext}`;
}
