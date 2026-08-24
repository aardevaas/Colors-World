import { describe, expect, test } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { systemRoles } from '@/lib/brand/colour';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import type { System } from '@/lib/system/types';
import {
  guidelineTokenFilename,
  toGuidelineCss,
  toGuidelineJson,
  toGuidelineTailwind,
  toGuidelineTokens,
  type GuidelineTokenInput,
} from '../guideline-tokens';

const HEXES = ['#0a5cff', '#ff6b35', '#1b1b1f'] as const;

function systemWith(patch: Partial<System> = {}): System {
  return {
    ...EMPTY_SYSTEM,
    palette: HEXES.map((hex, i) => ({ hex, oklch: parseColor(hex), addedAt: i })),
    anchorHex: HEXES[0],
    ...patch,
  };
}

function inputFor(system: System): GuidelineTokenInput {
  return {
    roles: systemRoles(system),
    palette: system.palette,
    type: system.type,
    stacks: {
      display: '"Inter", system-ui, sans-serif',
      body: '"Source Serif 4", Georgia, serif',
      mono: '"JetBrains Mono", ui-monospace, monospace',
    },
    mode: system.mode,
  };
}

const input = inputFor(systemWith());

describe('toGuidelineCss', () => {
  test('emits every semantic role, kebab-cased', () => {
    const css = toGuidelineCss(input);
    for (const name of [
      '--color-background',
      '--color-surface',
      '--color-primary',
      '--color-text',
      '--color-accent',
      '--color-border',
      '--color-on-primary',
      '--color-on-accent',
    ]) {
      expect(css).toContain(`${name}:`);
    }
  });

  test('emits one palette token per collected colour, in order', () => {
    const css = toGuidelineCss(input);
    expect(css).toContain('--palette-1:');
    expect(css).toContain('--palette-3:');
    expect(css).not.toContain('--palette-4:');
    expect(css.indexOf('--palette-1:')).toBeLessThan(css.indexOf('--palette-2:'));
  });

  test('states colours in oklch with a hex comment, so neither notation is lost', () => {
    const css = toGuidelineCss(input);
    expect(css).toContain('oklch(');
    expect(css).toContain('#0A5CFF');
  });

  test('emits the whole type ladder, with px alongside rem', () => {
    const css = toGuidelineCss(input);
    for (const token of ['display', 'h1', 'h2', 'h3', 'h4', 'body', 'small', 'caption']) {
      expect(css).toContain(`--text-${token}:`);
    }
    expect(css).toMatch(/--text-body: [\d.]+rem;\s+\/\* [\d.]+px \*\//);
  });

  test('emits the three resolved family stacks, not the slugs', () => {
    const css = toGuidelineCss(input);
    expect(css).toContain('--font-display: "Inter", system-ui, sans-serif;');
    expect(css).toContain('--font-body: "Source Serif 4", Georgia, serif;');
    expect(css).toContain('--font-mono: "JetBrains Mono", ui-monospace, monospace;');
  });

  test('emits leading, tracking and weight with their units', () => {
    const css = toGuidelineCss(input);
    expect(css).toContain(`--leading: ${input.type.lineHeight};`);
    expect(css).toContain(`--tracking: ${input.type.tracking}em;`);
    expect(css).toContain(`--font-weight: ${input.type.weight};`);
  });

  test('declares color-scheme so the browser matches the system polarity', () => {
    expect(toGuidelineCss(inputFor(systemWith({ mode: 'dark' })))).toContain(
      'color-scheme: dark;'
    );
    expect(toGuidelineCss(inputFor(systemWith({ mode: 'light' })))).toContain(
      'color-scheme: light;'
    );
  });

  test('an empty palette still emits roles and type, because both have fallbacks', () => {
    const css = toGuidelineCss(inputFor(EMPTY_SYSTEM));
    expect(css).toContain('--color-primary:');
    expect(css).toContain('--text-body:');
    expect(css).not.toContain('--palette-1:');
  });
});

describe('toGuidelineTailwind', () => {
  test('emits a v4 @theme block, not a JS config', () => {
    const theme = toGuidelineTailwind(input);
    expect(theme.startsWith('@theme {')).toBe(true);
    expect(theme).not.toContain('module.exports');
  });

  test('uses Tailwind’s own namespaces so utilities generate', () => {
    const theme = toGuidelineTailwind(input);
    // --color-* → bg-primary/text-primary, --text-* → text-h1, --font-* → font-body
    expect(theme).toContain('--color-primary:');
    expect(theme).toContain('--text-h1:');
    expect(theme).toContain('--font-body:');
  });
});

describe('toGuidelineJson', () => {
  test('is valid W3C design-token JSON', () => {
    const parsed = JSON.parse(toGuidelineJson(input));
    expect(parsed.color.primary.$type).toBe('color');
    expect(parsed.color.primary.$value).toMatch(/^#[0-9A-F]{6}$/);
    expect(parsed.color['on-primary'].$type).toBe('color');
  });

  test('carries type as dimension and fontFamily tokens', () => {
    const parsed = JSON.parse(toGuidelineJson(input));
    expect(parsed.text.body.$type).toBe('dimension');
    expect(parsed.text.body.$value).toMatch(/rem$/);
    expect(parsed.font.body.$type).toBe('fontFamily');
    expect(Array.isArray(parsed.font.body.$value)).toBe(true);
    expect(parsed.font.body.$value[0]).toBe('Source Serif 4');
  });

  test('states hex rather than oklch, because that is what importers read', () => {
    expect(toGuidelineJson(input)).not.toContain('oklch(');
  });
});

describe('toGuidelineTokens', () => {
  test('dispatches to each format', () => {
    expect(toGuidelineTokens(input, 'css')).toBe(toGuidelineCss(input));
    expect(toGuidelineTokens(input, 'tailwind')).toBe(toGuidelineTailwind(input));
    expect(toGuidelineTokens(input, 'json')).toBe(toGuidelineJson(input));
  });
});

describe('guidelineTokenFilename', () => {
  test('names each format by what it is', () => {
    expect(guidelineTokenFilename('css')).toBe('brand-tokens.css');
    expect(guidelineTokenFilename('tailwind')).toBe('brand-theme.css');
    expect(guidelineTokenFilename('json')).toBe('brand-tokens.json');
  });
});
