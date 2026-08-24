/**
 * The guideline's tokens — the whole system, not one ramp of it.
 *
 * `tokens.ts` already emits CSS variables, a Tailwind theme and Figma JSON, and
 * none of it is what a guideline needs. That exporter takes `GeneratedScale[]`:
 * it describes the ramps `/scales` builds, keyed by ramp name and step index.
 * It cannot say which colour is the primary one, it cannot say what the text
 * colour is, and it says nothing at all about type — so a developer handed its
 * output still has to read the book and decide, which is the exact translation
 * step the book exists to remove.
 *
 * What a manual actually specifies, and what this emits, is:
 *
 * 1. **Roles** — `--color-primary`, `--color-text`, `--color-on-primary`. The
 *    names a component references. A ramp step is a value; a role is a rule.
 * 2. **The palette** — every colour that was chosen, in the order it was
 *    chosen, so nothing is lost just because it did not take a role.
 * 3. **Type** — the whole ladder in rem, the three family stacks resolved to
 *    real fallbacks, and the leading, tracking and weight that go with them.
 *    **Nothing in this codebase exported type at all before this.**
 *
 * ## Pure, and small on purpose
 *
 * No DOM, no clipboard, no download, and — the load-bearing one — **no font
 * catalogue.** Family stacks arrive already resolved as strings, because
 * resolving a Fontsource slug means importing the ~385KB snapshot, and this
 * module is meant to be safe to run in a browser. The Book resolves them on the
 * server and hands them down. See `src/components/brand/GuidelineExport.tsx`.
 */

import { formatHex, formatOklchCss, type Oklch } from '@/lib/color-engine';
import { SEMANTIC_ROLES, type RoleAssignment, type SemanticRole } from '@/lib/roles/semantic-roles';
import { buildScale, ROOT_PX, type ScaleToken } from '@/lib/typography/type-scale';
import type { SystemMode, TypeSettings } from '@/lib/system/types';

/** A colour this module can write out. Matches `SystemColor` structurally. */
export interface TokenColor {
  readonly hex: string;
  readonly oklch: Oklch;
}

/**
 * The three family stacks, already resolved to `"Family", fallback, generic`.
 *
 * Strings rather than slugs: see the module note. A slug would make this
 * module import the catalogue, and the catalogue is the one thing that must
 * never reach the browser.
 */
export interface ResolvedStacks {
  readonly display: string;
  readonly body: string;
  readonly mono: string;
}

export interface GuidelineTokenInput {
  readonly roles: RoleAssignment;
  readonly palette: readonly TokenColor[];
  readonly type: TypeSettings;
  readonly stacks: ResolvedStacks;
  readonly mode: SystemMode;
}

export type GuidelineTokenFormat = 'css' | 'tailwind' | 'json';

/** `onPrimary` → `on-primary`. The role names are the token names. */
function tokenName(role: SemanticRole): string {
  return role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/** A stack string split into the array W3C `fontFamily` tokens expect. */
function stackToFamilies(stack: string): readonly string[] {
  return stack
    .split(',')
    .map((part) => part.trim().replace(/^["']|["']$/g, ''))
    .filter((part) => part.length > 0);
}

function px(rem: number): number {
  return Math.round(rem * ROOT_PX * 10) / 10;
}

/** The ladder, in book order — largest first, which is how a manual prints it. */
function ladder(type: TypeSettings): readonly { token: ScaleToken; rem: number }[] {
  return buildScale(type.baseRem, type.ratio).map(({ token, rem }) => ({ token, rem }));
}

/**
 * Custom properties, under `:root`.
 *
 * Colours are written in OKLCH with the hex in a trailing comment rather than
 * the other way round. OKLCH is what these colours *are* — the whole system is
 * authored in it, and a wide-gamut value survives the round trip intact — but a
 * guideline is also read by people, and the hex is the string they will be
 * asked for. Neither notation is worth losing, and a comment costs nothing.
 */
export function toGuidelineCss(input: GuidelineTokenInput): string {
  const lines: string[] = [':root {'];

  // Not decoration: this is what makes form controls, scrollbars and the
  // browser's own UA colours match the system rather than fight it.
  lines.push(`  color-scheme: ${input.mode};`, '');

  lines.push('  /* Roles — what each colour is FOR. Reference these, not the palette. */');
  for (const role of SEMANTIC_ROLES) {
    const colour = input.roles[role];
    lines.push(
      `  --color-${tokenName(role)}: ${formatOklchCss(colour.oklch)}; /* ${formatHex(
        colour.oklch
      ).toUpperCase()} */`
    );
  }

  if (input.palette.length > 0) {
    lines.push('', '  /* The palette, in the order it was collected. */');
    input.palette.forEach((colour, i) => {
      lines.push(
        `  --palette-${i + 1}: ${formatOklchCss(colour.oklch)}; /* ${colour.hex.toUpperCase()} */`
      );
    });
  }

  lines.push('', '  /* Type — the families, resolved with their fallbacks. */');
  lines.push(`  --font-display: ${input.stacks.display};`);
  lines.push(`  --font-body: ${input.stacks.body};`);
  lines.push(`  --font-mono: ${input.stacks.mono};`);

  lines.push(
    '',
    `  /* The ladder: ${input.type.baseRem}rem base, ${input.type.ratio} ratio. */`
  );
  for (const { token, rem } of ladder(input.type)) {
    lines.push(`  --text-${token}: ${rem}rem; /* ${px(rem)}px */`);
  }

  lines.push('', '  /* How that type is set. */');
  lines.push(`  --leading: ${input.type.lineHeight};`);
  lines.push(`  --tracking: ${input.type.tracking}em;`);
  lines.push(`  --font-weight: ${input.type.weight};`);

  lines.push('}', '');
  return lines.join('\n');
}

/**
 * A Tailwind v4 `@theme` block.
 *
 * The names are not a stylistic choice — Tailwind v4 generates utilities from
 * namespaced variables, so `--color-primary` is what produces `bg-primary` and
 * `text-primary`, `--text-h1` produces `text-h1`, and `--font-body` produces
 * `font-body`. Rename any of them and the theme still parses and generates
 * nothing, which is the worst failure mode available. Every token this emits is
 * already in the namespace Tailwind reads, so the CSS export and this one are
 * the same names twice rather than a translation.
 */
export function toGuidelineTailwind(input: GuidelineTokenInput): string {
  const lines: string[] = ['@theme {'];

  for (const role of SEMANTIC_ROLES) {
    lines.push(`  --color-${tokenName(role)}: ${formatOklchCss(input.roles[role].oklch)};`);
  }

  if (input.palette.length > 0) {
    lines.push('');
    input.palette.forEach((colour, i) => {
      lines.push(`  --color-palette-${i + 1}: ${formatOklchCss(colour.oklch)};`);
    });
  }

  lines.push('');
  lines.push(`  --font-display: ${input.stacks.display};`);
  lines.push(`  --font-body: ${input.stacks.body};`);
  lines.push(`  --font-mono: ${input.stacks.mono};`);

  lines.push('');
  for (const { token, rem } of ladder(input.type)) {
    lines.push(`  --text-${token}: ${rem}rem;`);
  }

  lines.push('');
  lines.push(`  --leading-body: ${input.type.lineHeight};`);
  lines.push(`  --tracking-body: ${input.type.tracking}em;`);
  lines.push(`  --font-weight-body: ${input.type.weight};`);

  lines.push('}', '');
  return lines.join('\n');
}

interface ColorToken {
  readonly $type: 'color';
  readonly $value: string;
}
interface DimensionToken {
  readonly $type: 'dimension';
  readonly $value: string;
}
interface FontFamilyToken {
  readonly $type: 'fontFamily';
  readonly $value: readonly string[];
}
interface NumberToken {
  readonly $type: 'number';
  readonly $value: number;
}

/**
 * W3C Design Tokens JSON — the format Figma, Style Dictionary and Tokens Studio
 * all read.
 *
 * Hex rather than OKLCH, and a `"1.5rem"` string rather than the newer
 * `{ value, unit }` object, for the same reason `toFigmaTokens` makes the same
 * two choices: the importers people actually use do not reliably parse either
 * of the more correct forms. Losing wide-gamut precision here is the correct
 * trade for the file working when it lands. The CSS export above keeps OKLCH,
 * so nothing is lost overall — only in the one export that has to be lossy.
 */
export function toGuidelineJson(input: GuidelineTokenInput): string {
  const color: Record<string, ColorToken> = {};
  for (const role of SEMANTIC_ROLES) {
    color[tokenName(role)] = {
      $type: 'color',
      $value: formatHex(input.roles[role].oklch).toUpperCase(),
    };
  }

  const palette: Record<string, ColorToken> = {};
  input.palette.forEach((colour, i) => {
    palette[String(i + 1)] = { $type: 'color', $value: colour.hex.toUpperCase() };
  });

  const text: Record<string, DimensionToken> = {};
  for (const { token, rem } of ladder(input.type)) {
    text[token] = { $type: 'dimension', $value: `${rem}rem` };
  }

  const font: Record<string, FontFamilyToken> = {
    display: { $type: 'fontFamily', $value: stackToFamilies(input.stacks.display) },
    body: { $type: 'fontFamily', $value: stackToFamilies(input.stacks.body) },
    mono: { $type: 'fontFamily', $value: stackToFamilies(input.stacks.mono) },
  };

  const type: Record<string, DimensionToken | NumberToken> = {
    leading: { $type: 'number', $value: input.type.lineHeight },
    tracking: { $type: 'dimension', $value: `${input.type.tracking}em` },
    weight: { $type: 'number', $value: input.type.weight },
  };

  const document: Record<string, unknown> = { color, text, font, type };
  if (input.palette.length > 0) document.palette = palette;

  return `${JSON.stringify(document, null, 2)}\n`;
}

export function toGuidelineTokens(
  input: GuidelineTokenInput,
  format: GuidelineTokenFormat
): string {
  switch (format) {
    case 'css':
      return toGuidelineCss(input);
    case 'tailwind':
      return toGuidelineTailwind(input);
    case 'json':
      return toGuidelineJson(input);
  }
}

/**
 * The filename each format downloads as.
 *
 * The Tailwind export is `brand-theme.css` rather than `brand-tokens.css`
 * because both are CSS and they are not interchangeable — one goes in a
 * stylesheet, one goes wherever the Tailwind entry point is — and two downloads
 * landing on the same name in a Downloads folder is how the wrong one gets
 * committed.
 */
export function guidelineTokenFilename(format: GuidelineTokenFormat): string {
  switch (format) {
    case 'css':
      return 'brand-tokens.css';
    case 'tailwind':
      return 'brand-theme.css';
    case 'json':
      return 'brand-tokens.json';
  }
}
