import type { GeneratedScale } from '@/lib/color-engine/types';

interface DesignToken {
  readonly $type: 'color';
  readonly $value: string;
}

/** Normalises a scale name into a form safe for CSS identifiers and token keys. */
export function sanitiseScaleName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

export interface CssExportOptions {
  readonly selector?: string;
}

/**
 * Emits CSS custom properties using each step's `oklch()` string rather than its
 * hex, so wide-gamut values survive the export intact on displays that can show
 * them. Browsers that cannot render P3 fall back gracefully on their own.
 */
export function toCssCustomProperties(
  scales: readonly GeneratedScale[],
  options?: CssExportOptions
): string {
  const selector = options?.selector ?? ':root';
  const declarations = scales.flatMap((scale) => {
    const name = sanitiseScaleName(scale.name);
    return scale.steps.map((step) => `  --${name}-${step.step}: ${step.css};`);
  });

  return `${selector} {\n${declarations.join('\n')}\n}\n`;
}

/** Emits a Tailwind v4 `@theme` block — v4 configures colours in CSS, not JS. */
export function toTailwindTheme(scales: readonly GeneratedScale[]): string {
  const declarations = scales.flatMap((scale) => {
    const name = sanitiseScaleName(scale.name);
    return scale.steps.map(
      (step) => `  --color-${name}-${step.step}: ${step.css};`
    );
  });

  return `@theme {\n${declarations.join('\n')}\n}\n`;
}

/**
 * Emits W3C Design Tokens JSON for Figma import.
 *
 * Deliberately uses hex rather than oklch here: Figma's token importers do not
 * reliably parse `oklch()`, so this is the one export where losing wide-gamut
 * precision is the correct trade for actually working.
 */
export function toFigmaTokens(scales: readonly GeneratedScale[]): string {
  const tokens: Record<string, Record<string, DesignToken>> = {};

  for (const scale of scales) {
    const name = sanitiseScaleName(scale.name);
    const steps: Record<string, DesignToken> = {};
    for (const step of scale.steps) {
      steps[String(step.step)] = { $type: 'color', $value: step.hex };
    }
    tokens[name] = steps;
  }

  return `${JSON.stringify(tokens, null, 2)}\n`;
}
