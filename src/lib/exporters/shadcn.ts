import {
  bestTextColor,
  formatOklchCss,
  parseColor,
  type GeneratedScale,
  type Oklch,
} from '@/lib/color-engine';

/**
 * shadcn/ui theme exporter — the one export in the vault that can't just
 * reformat what generateScale already produced. shadcn's token vocabulary
 * (background/card/muted/destructive/…) doesn't map 1:1 onto "N generated
 * scales"; some slots have a real, honest basis in the collected colours and
 * some don't. This fills only the former and *discloses* the latter rather
 * than inventing plausible-looking values — the same standing policy this
 * project already applies to seed data ("not verified fact") and disabled
 * teleport targets in /library.
 *
 * Emits full CSS colour functions (`oklch(...)`) as values, matching this
 * project's existing convention (see tokens.ts's toCssCustomProperties) of
 * never emitting bare component lists — Tailwind v4's `@theme` and shadcn's
 * current (Tailwind v4) starter both accept arbitrary colour functions
 * directly, unlike the older "raw HSL triplet wrapped in hsl(var(--x))"
 * convention from Tailwind v3-era shadcn.
 */

const PURE_BLACK: Oklch = parseColor('#000000');
const PURE_WHITE: Oklch = parseColor('#ffffff');

/** shadcn's own reference theme caps chart tokens at 5. */
const MAX_CHART_TOKENS = 5;

/**
 * This project's own obsidian neutral tokens (see src/app/globals.css) —
 * reused here rather than inventing a second, unrelated grey scale, so
 * shadcn's neutral slots (background/card/muted/border) stay visually
 * consistent with the rest of the app regardless of which brand colours
 * were collected. Every real shadcn starter ships neutrals like these
 * before any brand customization happens — supplying them isn't invention,
 * it's the well-established default a blank theme already has.
 */
interface NeutralPalette {
  readonly background: Oklch;
  readonly foreground: Oklch;
  readonly card: Oklch;
  readonly muted: Oklch;
  readonly mutedForeground: Oklch;
  readonly border: Oklch;
}

const NEUTRAL: Record<'light' | 'dark', NeutralPalette> = {
  light: {
    background: parseColor('oklch(98% 0.002 265)'),
    foreground: parseColor('oklch(15% 0.006 265)'),
    card: parseColor('oklch(100% 0 0)'),
    muted: parseColor('oklch(94% 0.004 265)'),
    mutedForeground: parseColor('oklch(45% 0.01 265)'),
    border: parseColor('oklch(88% 0.006 265)'),
  },
  dark: {
    // Matches globals.css --surface-void / --text-primary / --surface-raised
    // / --surface-panel / --text-secondary / --hairline respectively.
    background: parseColor('oklch(13% 0.008 265)'),
    foreground: parseColor('oklch(95% 0.004 265)'),
    card: parseColor('oklch(21% 0.012 265)'),
    muted: parseColor('oklch(17% 0.01 265)'),
    mutedForeground: parseColor('oklch(70% 0.012 265)'),
    border: parseColor('oklch(28% 0.014 265)'),
  },
};

export interface ShadcnThemeOptions {
  /** Index of the "primary" scale — defaults to 0. Matches the dock's own
   *  Primary Anchor designation upstream. */
  readonly primaryIndex?: number;
}

export interface ShadcnThemeResult {
  readonly css: string;
  /** Human-readable reasons for every standard shadcn token this export
   *  could not honestly fill — surface this in the UI, not just the CSS
   *  comment, per the /builder export vault's design. */
  readonly unfilled: readonly string[];
}

/** A step roughly 40% down the scale reads as its "brand" tone — neither
 *  the near-white top nor the near-black bottom, without needing a second
 *  anchor to define what "the" colour of a scale is. */
function brandTone(scale: GeneratedScale): Oklch {
  const index = Math.round((scale.steps.length - 1) * 0.4);
  return scale.steps[index]!.oklch;
}

/**
 * Deliberately its own threshold, not hue-family.ts's 'reds' (0-20°) — that
 * boundary was tuned for aesthetic browsing labels in /library, not for
 * "is this red enough to read as a danger/delete signal." Real destructive
 * reds (Tailwind red-500 #ef4444, red-600, Material red, shadcn's own
 * default) commonly land around 20-30° in OKLCH because red hue shifts with
 * lightness — a narrower band would wrongly exclude legitimate red brand
 * colours from filling --destructive.
 */
const DESTRUCTIVE_HUE_MAX = 30;
const DESTRUCTIVE_HUE_MIN = 345;

function readsAsDestructiveRed(oklch: Oklch): boolean {
  const hue = ((oklch.h % 360) + 360) % 360;
  return hue <= DESTRUCTIVE_HUE_MAX || hue >= DESTRUCTIVE_HUE_MIN;
}

function foregroundFor(background: Oklch): Oklch {
  return bestTextColor(background, [PURE_BLACK, PURE_WHITE]);
}

export function toShadcnTheme(
  scales: readonly GeneratedScale[],
  options: ShadcnThemeOptions = {}
): ShadcnThemeResult {
  if (scales.length === 0) {
    return {
      css: ':root {\n}\n\n.dark {\n}\n',
      unfilled: ['Every brand token — no scales were provided.'],
    };
  }

  const primaryIndex = options.primaryIndex ?? 0;
  const primary = scales[primaryIndex] ?? scales[0]!;
  const remaining = scales.filter((_, i) => i !== primaryIndex);
  const secondary = remaining[0] ?? null;
  const accent = remaining[1] ?? null;
  const destructiveScale = scales.find((scale) => readsAsDestructiveRed(brandTone(scale))) ?? null;

  const unfilled: string[] = [];
  if (secondary === null) {
    unfilled.push(
      '--secondary / --secondary-foreground — only one colour collected; add a second to the dock to fill this.'
    );
  }
  if (accent === null) {
    unfilled.push(
      '--accent / --accent-foreground — fewer than three colours collected; add a third to the dock to fill this.'
    );
  }
  if (destructiveScale === null) {
    unfilled.push(
      '--destructive / --destructive-foreground — none of the collected colours read as red; inventing a destructive red from an unrelated hue would misrepresent a danger/delete signal.'
    );
  }

  function themeBlock(mode: 'light' | 'dark'): string {
    const neutral = NEUTRAL[mode];
    const lines: string[] = [
      `  --background: ${formatOklchCss(neutral.background)};`,
      `  --foreground: ${formatOklchCss(neutral.foreground)};`,
      `  --card: ${formatOklchCss(neutral.card)};`,
      `  --card-foreground: ${formatOklchCss(neutral.foreground)};`,
      `  --popover: ${formatOklchCss(neutral.card)};`,
      `  --popover-foreground: ${formatOklchCss(neutral.foreground)};`,
      `  --muted: ${formatOklchCss(neutral.muted)};`,
      `  --muted-foreground: ${formatOklchCss(neutral.mutedForeground)};`,
      `  --border: ${formatOklchCss(neutral.border)};`,
      `  --input: ${formatOklchCss(neutral.border)};`,
    ];

    const primaryColor = brandTone(primary);
    lines.push(
      `  --primary: ${formatOklchCss(primaryColor)};`,
      `  --primary-foreground: ${formatOklchCss(foregroundFor(primaryColor))};`,
      // Focus ring conventionally mirrors primary — shadcn's own default.
      `  --ring: ${formatOklchCss(primaryColor)};`
    );

    if (secondary !== null) {
      const color = brandTone(secondary);
      lines.push(
        `  --secondary: ${formatOklchCss(color)};`,
        `  --secondary-foreground: ${formatOklchCss(foregroundFor(color))};`
      );
    }

    if (accent !== null) {
      const color = brandTone(accent);
      lines.push(
        `  --accent: ${formatOklchCss(color)};`,
        `  --accent-foreground: ${formatOklchCss(foregroundFor(color))};`
      );
    }

    if (destructiveScale !== null) {
      const color = brandTone(destructiveScale);
      lines.push(
        `  --destructive: ${formatOklchCss(color)};`,
        `  --destructive-foreground: ${formatOklchCss(foregroundFor(color))};`
      );
    }

    scales.slice(0, MAX_CHART_TOKENS).forEach((scale, i) => {
      lines.push(`  --chart-${i + 1}: ${formatOklchCss(brandTone(scale))};`);
    });

    return lines.join('\n');
  }

  const unfilledComment =
    unfilled.length > 0
      ? `/*\n * Not filled — no honest basis from the collected colours yet:\n${unfilled
          .map((reason) => ` * - ${reason}`)
          .join('\n')}\n */\n`
      : '';

  const css =
    `${unfilledComment}:root {\n${themeBlock('light')}\n}\n\n` +
    `.dark {\n${themeBlock('dark')}\n}\n`;

  return { css, unfilled };
}
