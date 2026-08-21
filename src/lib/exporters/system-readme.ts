/**
 * The system, written down.
 *
 * Every tool in this category exports tokens. A file of hex values tells the
 * next person what the colors are and nothing about why, so the reasoning
 * lives in the head of whoever made it and evaporates the moment they move on.
 * The questions that actually come up later — why is the border that light,
 * can I use the accent for body text, is this safe for color blindness — are
 * all answerable from what this app already computes, and all unanswerable
 * from a token file.
 *
 * So this emits the document instead: which color took which role, what every
 * required pair actually measures, where the type stops being legible, what a
 * cheaper display does to the ramps. Every line is generated from measurement
 * rather than written by hand, which means it cannot drift from the system it
 * describes the way a hand-maintained README always does.
 *
 * Markdown rather than a zip because a zip needs a dependency and a bundle
 * needs unpacking, while this is one file you can commit next to the tokens
 * and read in a pull request.
 *
 * Pure: no DOM, no React.
 */

import type { GeneratedScale } from '@/lib/color-engine';
import { SEMANTIC_ROLES, type RoleAssignment } from '@/lib/roles/semantic-roles';
import { buildRoleContrastMatrix } from '@/lib/roles/role-contrast';
import { buildCvdReport } from '@/lib/roles/cvd-conflicts';
import { buildLegibilityField } from '@/lib/typography/legibility-field';
import { buildScale } from '@/lib/typography/type-scale';
import { presetById } from '@/lib/typography/font-sources';
import { compareAcrossGamuts } from '@/lib/harmony/gamut-compare';
import type { System } from '@/lib/system/types';
import { toCssCustomProperties, toFigmaTokens, toTailwindTheme } from './tokens';

export interface SystemDocumentInput {
  readonly system: System;
  readonly roles: RoleAssignment;
  readonly scales: readonly GeneratedScale[];
  /** The address this system can be reopened at, when there is one. */
  readonly shareUrl?: string;
}

/** What each role is for, so the table explains itself to someone who has
 *  never used this tool. */
const ROLE_PURPOSE: Record<string, string> = {
  background: 'The page itself',
  surface: 'Panels and cards sitting on the page',
  primary: 'The brand color — buttons, links, emphasis',
  text: 'Body copy',
  accent: 'A second brand color, for secondary emphasis',
  border: 'Edges of panels and controls',
};

export function toSystemReadme(input: SystemDocumentInput): string {
  const { system, roles, scales } = input;

  return [
    heading(system),
    rolesSection(roles),
    contrastSection(roles),
    visionSection(roles),
    typographySection(system, roles),
    gamutSection(scales),
    tokensSection(scales),
    footer(input),
  ]
    .filter((section) => section !== '')
    .join('\n\n');
}

function heading(system: System): string {
  const count = system.palette.length;
  return [
    '# Color system',
    '',
    `${count} color${count === 1 ? '' : 's'}, ${SEMANTIC_ROLES.length} roles, ` +
      `${system.scales.steps}-step scales in ${system.scales.gamut}, ${system.mode} polarity.`,
    '',
    'Generated from the system itself. Every number below was measured, not asserted.',
  ].join('\n');
}

function rolesSection(roles: RoleAssignment): string {
  const rows = SEMANTIC_ROLES.map(
    (role) => `| \`${role}\` | \`${roles[role].hex.toUpperCase()}\` | ${ROLE_PURPOSE[role] ?? ''} |`
  );
  return [
    '## Roles',
    '',
    'Assigned by OKLCH lightness rather than by the order the colors were',
    'collected, so the same palette always means the same thing.',
    '',
    '| Role | Color | What it is for |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function contrastSection(roles: RoleAssignment): string {
  const matrix = buildRoleContrastMatrix(roles);
  const rows = matrix.required.map((cell) => {
    const mark = cell.passes ? 'pass' : '**FAILS**';
    return `| ${cell.foreground} on ${cell.background} | ${cell.ratio.toFixed(2)}:1 | ${cell.required} | ${mark} |`;
  });

  const summary =
    matrix.failures.length === 0
      ? `All ${matrix.required.length} required pairs meet their threshold.`
      : `${matrix.failures.length} of ${matrix.required.length} required pairs fall short.`;

  return [
    '## Contrast',
    '',
    summary,
    '',
    'Text pairs are held to 4.5:1 (WCAG 2.2 for body copy); component boundaries',
    'to 3:1 (WCAG 1.4.11). Pairs no standard has a rule about are left out rather',
    'than scored against an invented threshold.',
    '',
    '| Pair | Measured | Needs | |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function visionSection(roles: RoleAssignment): string {
  const report = buildCvdReport(roles);

  if (report.safe) {
    return [
      '## Color vision',
      '',
      'No pair of roles collapses under protanopia, deuteranopia, tritanopia or',
      'achromatopsia. Separating by lightness rather than by hue is what buys that.',
    ].join('\n');
  }

  const rows = report.byType.flatMap((type) =>
    [...type.merged, ...type.weakened].map(
      (finding) =>
        `| ${finding.a} + ${finding.b} | ${type.type} | ${Math.round(finding.retained * 100)}% | ` +
        `${finding.verdict === 'merged' ? '**indistinguishable**' : 'weakened'} |`
    )
  );

  return [
    '## Color vision',
    '',
    'These pairs are distinct in normal vision and stop being so under simulation.',
    'The percentage is how much of their separation survives.',
    '',
    '| Pair | Vision | Separation kept | |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n');
}

function typographySection(system: System, roles: RoleAssignment): string {
  const preset = presetById(system.type.presetId);
  const scale = buildScale(system.type.baseRem, system.type.ratio);
  const body = scale.find((entry) => entry.token === 'body');
  const field = buildLegibilityField(roles.text.oklch, roles.background.oklch);

  const verdict = {
    'passes-everywhere': 'This pair carries body text at any size and weight.',
    'passes-when-large':
      'This pair only carries **large** text — 24px, or 18.66px when bold. Below that it fails, and no weight changes that.',
    'passes-nowhere':
      'This pair carries text at **no** size or weight. Only a color change fixes it.',
  }[field.verdict];

  const rows = scale.map(
    (entry) => `| \`${entry.token}\` | ${entry.rem.toFixed(3)}rem | ${entry.px}px |`
  );

  // Built by pushing rather than filtering: a blanket filter for the optional
  // body line also removed every deliberate blank, which in Markdown is not
  // cosmetic -- a table with no blank line above it does not render as a table.
  const lines: string[] = [
    '## Typography',
    '',
    `**${preset.display}** for display, **${preset.body}** for body, **${preset.mono}** for code.`,
    `Scale ratio ${system.type.ratio}, base ${(system.type.baseRem * 16).toFixed(0)}px, ` +
      `leading ${system.type.lineHeight}, tracking ${system.type.tracking}em, weight ${system.type.weight}.`,
    '',
    `Text on the page measures ${field.ratio.toFixed(2)}:1. ${verdict}`,
  ];

  if (body !== undefined) {
    const required = field.rows[0]?.find((cell) => cell.px >= body.px)?.required ?? 4.5;
    lines.push('', `Body copy is set at ${body.px}px, which needs ${required}:1.`);
  }

  lines.push('', '| Token | rem | px |', '| --- | --- | --- |', ...rows);
  return lines.join('\n');
}

function gamutSection(scales: readonly GeneratedScale[]): string {
  if (scales.length === 0) return '';
  const primary = scales[0]!;
  const comparison = compareAcrossGamuts(primary.spec);

  const verdict =
    comparison.collapses.length > 0
      ? `**${comparison.collapses.length} pair${comparison.collapses.length === 1 ? '' : 's'} of steps merge** on a narrower display. ` +
        comparison.collapses
          .map((c) => `Steps ${c.lower} and ${c.upper} on ${c.gamut}.`)
          .join(' ')
      : comparison.shifting.length === 0
        ? 'Every step sits inside sRGB, so all displays show the same thing.'
        : `${comparison.shifting.length} of ${comparison.steps.length} steps shift on a narrower display, ` +
          'but every step stays distinct from its neighbours. Travelling through lightness is what buys that.';

  return ['## Across displays', '', `Measured on the \`${primary.name}\` scale. ${verdict}`].join(
    '\n'
  );
}

function tokensSection(scales: readonly GeneratedScale[]): string {
  if (scales.length === 0) return '';
  return [
    '## Tokens',
    '',
    '### CSS custom properties',
    '',
    '```css',
    toCssCustomProperties(scales).trim(),
    '```',
    '',
    '### Tailwind v4',
    '',
    '```css',
    toTailwindTheme(scales).trim(),
    '```',
    '',
    '### W3C design tokens (Figma)',
    '',
    '```json',
    toFigmaTokens(scales).trim(),
    '```',
  ].join('\n');
}

function footer(input: SystemDocumentInput): string {
  const lines = ['---', ''];
  if (input.shareUrl !== undefined && input.shareUrl !== '') {
    lines.push(`Reopen this system: ${input.shareUrl}`, '');
  }
  lines.push(
    'Built with Colors World. Color in OKLCH, contrast in WCAG 2.2 and APCA,',
    'gamut mapping to sRGB, Display P3 and Rec2020.'
  );
  return lines.join('\n');
}

/** Re-exported so the download filename and the document agree on a name. */
export function systemFilename(system: System): string {
  const count = system.palette.length;
  return `color-system-${count}-color-${system.mode}.md`;
}
