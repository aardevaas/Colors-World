import type { GeneratedScale } from '@/lib/color-engine/types';

interface DesignToken {
  readonly $type: 'color';
  readonly $value: string;
}

/** Normalises a scale name into a form safe for CSS identifiers and token keys. */
export function sanitiseScaleName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

/**
 * Tailwind's own convention: 50 (lightest) through 950 (darkest), 11 rungs.
 * This is presentation-only — see toTailwindTheme below for why the actual
 * `--color-{name}-{step}` identity stays index-based regardless.
 */
const TAILWIND_LADDER: readonly number[] = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
];

/**
 * Maps `count` scale steps onto Tailwind-conventional stop labels, purely for
 * a human-readable annotation in the Tailwind export.
 *
 * At exactly 10 steps (this project's step-count cap) it returns the full
 * canonical 50-900 run unmodified — every rung except 950, the one Tailwind
 * stop a 10-step scale genuinely cannot reach. At any other count it samples
 * `count` evenly-spaced rungs from the full 11-rung ladder, so a 3-step scale
 * reads as roughly "light / mid / dark" in Tailwind's own vocabulary instead
 * of an arbitrary numbering.
 *
 * This must never rename the actual token identity: snapshotFromScales and
 * every consumer of its output (version-control diff/merge, share links)
 * compare on `${name}-${step}` exactly as-is. Renaming to `-50`/`-100`/etc.
 * would make every previously-saved palette diff as a full rewrite.
 */
export function tailwindStepLabels(count: number): readonly string[] {
  if (count <= 1) return [String(TAILWIND_LADDER[0])];

  if (count === TAILWIND_LADDER.length - 1) {
    // The 10-step cap: the full 50-900 run, no gaps, no skips.
    return TAILWIND_LADDER.slice(0, count).map(String);
  }

  const lastRung = TAILWIND_LADDER.length - 1;
  return Array.from({ length: count }, (_, i) => {
    const rungIndex = Math.round((i / (count - 1)) * lastRung);
    return String(TAILWIND_LADDER[rungIndex]);
  });
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

/**
 * Emits a Tailwind v4 `@theme` block — v4 configures colors in CSS, not JS.
 *
 * Token identity (`--color-{name}-{step}`) stays index-based; the Tailwind
 * 50-950 convention is layered on as a trailing comment per declaration
 * (see tailwindStepLabels' own doc comment for why the identity can't move).
 */
export function toTailwindTheme(scales: readonly GeneratedScale[]): string {
  const declarations = scales.flatMap((scale) => {
    const name = sanitiseScaleName(scale.name);
    const labels = tailwindStepLabels(scale.steps.length);
    return scale.steps.map(
      (step, i) => `  --color-${name}-${step.step}: ${step.css}; /* ${labels[i]} */`
    );
  });

  const missing950 = scales
    .filter((scale) => scale.steps.length === TAILWIND_LADDER.length - 1)
    .map((scale) => sanitiseScaleName(scale.name));

  const gapNote =
    missing950.length > 0
      ? `  /* Tailwind's ladder also has 950 (darkest) — unreachable at the ` +
        `10-step cap for: ${missing950.join(', ')}. */\n`
      : '';

  return `@theme {\n${gapNote}${declarations.join('\n')}\n}\n`;
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
