import { describe, expect, it } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import {
  paletteFilename,
  toPaletteCss,
  toPaletteExport,
  toPaletteJson,
  toPaletteText,
  type ExportableColor,
} from '../palette';

const hexes = ['#1b2a4a', '#4a7dff', '#e8574a'];
const palette: readonly ExportableColor[] = hexes.map((hex) => ({ hex, oklch: parseColor(hex) }));

describe('toPaletteCss', () => {
  it('emits one custom property per colour, positionally named', () => {
    const css = toPaletteCss(palette);
    expect(css).toContain('--color-1: #1b2a4a;');
    expect(css).toContain('--color-3: #e8574a;');
    expect(css).not.toContain('--color-4');
  });

  it('carries OKLCH alongside hex rather than instead of it', () => {
    const css = toPaletteCss(palette);
    expect(css).toMatch(/--color-1-oklch: oklch\(/);
    // The hex fallback is the point: it costs one line and covers renderers
    // that are not current.
    expect(css).toContain('--color-1: #1b2a4a;');
  });

  it('produces a valid empty block rather than nothing', () => {
    expect(toPaletteCss([])).toBe(':root {\n}\n');
  });
});

describe('toPaletteJson', () => {
  it('states every colour in all five notations a guideline prints', () => {
    const parsed = JSON.parse(toPaletteJson(palette)) as {
      palette: readonly Record<string, string>[];
    };
    expect(parsed.palette).toHaveLength(3);
    for (const entry of parsed.palette) {
      expect(Object.keys(entry)).toEqual(['name', 'hex', 'rgb', 'hsl', 'oklch', 'cmyk']);
    }
  });

  it('uppercases hex, because that is how a manual prints it', () => {
    const parsed = JSON.parse(toPaletteJson(palette)) as { palette: readonly { hex: string }[] };
    expect(parsed.palette[0]!.hex).toBe('#1B2A4A');
  });

  it('says plainly that spot colours are absent, rather than omitting them silently', () => {
    /*
     * Pantone is licensed and cannot ship. A guideline that simply has no spot
     * section leaves a printer guessing; one that says why, and points at the
     * CMYK build, does not.
     */
    const parsed = JSON.parse(toPaletteJson(palette)) as { note: string };
    expect(parsed.note).toMatch(/licensed/i);
    expect(parsed.note).toMatch(/CMYK/);
  });

  it('is valid JSON for an empty palette', () => {
    expect(() => JSON.parse(toPaletteJson([]))).not.toThrow();
  });
});

describe('toPaletteText', () => {
  it('is one uppercase hex per line', () => {
    expect(toPaletteText(palette)).toBe('#1B2A4A\n#4A7DFF\n#E8574A\n');
  });

  it('is empty for an empty palette, not a lone newline', () => {
    expect(toPaletteText([])).toBe('');
  });
});

describe('toPaletteExport', () => {
  it.each(['css', 'json', 'text'] as const)('dispatches %s to its own writer', (format) => {
    const direct = { css: toPaletteCss, json: toPaletteJson, text: toPaletteText }[format];
    expect(toPaletteExport(palette, format)).toBe(direct(palette));
  });

  it('never returns undefined for a supported format', () => {
    for (const format of ['css', 'json', 'text'] as const) {
      expect(typeof toPaletteExport(palette, format)).toBe('string');
    }
  });
});

describe('paletteFilename', () => {
  it('gives each format the extension its content actually is', () => {
    expect(paletteFilename('css')).toBe('palette.css');
    expect(paletteFilename('json')).toBe('palette.json');
    expect(paletteFilename('text')).toBe('palette.txt');
  });
});
