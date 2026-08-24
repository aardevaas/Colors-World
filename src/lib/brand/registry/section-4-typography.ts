/**
 * §4 Typography system — machine M2, Compute & Verify.
 *
 * The second of the three CORE components lives here: `type.families` appears
 * in 20 of 25 books across 12 sectors. Like §3 this section reads the
 * URL-shaped System, so all of it renders with no account.
 *
 * The gap is the catalogue, not the engine. The scale, the fluid clamp and the
 * legibility field are all built and good; the product ships four hard-coded
 * pairings against a Fontsource catalogue of 2,096 open-licensed families.
 * That is a data problem, and it is why `type.families` renders a preset label
 * rather than a licence — which §9 will need.
 */

import { presetById } from '@/lib/typography/font-sources';
import { buildScale } from '@/lib/typography/type-scale';
import { arr, finding, num, obj, present, str } from '../block';
import type { BrandComponent, Finding } from '../types';

/**
 * WCAG 1.4.12 asks that content stay readable when a reader forces
 * line-height to 1.5× the font size. A default already at or above 1.5 cannot
 * be broken by that override; one below it is where the layout has to survive
 * a change it has never been tested at.
 */
const TEXT_SPACING_LINE_HEIGHT = 1.5;

export const SECTION_4: readonly BrandComponent[] = [
  {
    id: 'type.families',
    name: 'Typefaces',
    section: 4,
    requires: [],
    machine: 'M2',
    storage: 'system',
    produces: obj(
      {
        presetId: str(),
        display: str(),
        body: str(),
        mono: str(),
        source: str('Where the faces are served from'),
      },
      ['presetId', 'display', 'body']
    ),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['type.families'],
      frequency: 20,
      sectors: 12,
      wheeler: true,
      note: 'One of the three CORE components, and the second of the two this product already has.',
    },
    render: (state) => {
      const preset = presetById(state.system.type.presetId);
      return present('type.families', 'Typefaces', 'declared', [
        { label: 'Display', value: preset.display },
        { label: 'Body', value: preset.body },
        { label: 'Mono', value: preset.mono },
        { label: 'Character', value: preset.character },
        {
          label: 'Served from',
          value: preset.source,
          evidence: 'measured',
          note: 'Licence terms are not carried by the preset yet — §9 licensing depends on them.',
        },
      ]);
    },
  },
  {
    id: 'type.metrics',
    name: 'Scale & metrics',
    section: 4,
    requires: [],
    machine: 'M2',
    storage: 'system',
    produces: obj(
      {
        baseRem: num(),
        ratio: num('Modular scale ratio'),
        lineHeight: num(),
        tracking: num('em'),
        weight: num(),
      },
      ['baseRem', 'ratio', 'lineHeight']
    ),
    evidence: 'measured',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'No sampled book names a "metrics" section; they print a ladder instead. Kept separate from type.hierarchy because these are the inputs and the ladder is the output — storing a derived value is how two sources of truth start disagreeing.',
    },
    render: (state) => {
      const t = state.system.type;
      return present('type.metrics', 'Scale & metrics', 'measured', [
        { label: 'Base size', value: `${t.baseRem}rem` },
        { label: 'Ratio', value: t.ratio.toFixed(3) },
        { label: 'Line height', value: t.lineHeight.toFixed(2) },
        { label: 'Tracking', value: `${t.tracking}em` },
        { label: 'Weight', value: String(t.weight) },
      ]);
    },
  },
  {
    id: 'type.hierarchy',
    name: 'Hierarchy',
    section: 4,
    requires: ['type.metrics'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ token: str(), rem: num(), px: num() }, ['token', 'rem', 'px'])),
    evidence: 'measured',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Folded into type.families in every sampled book rather than named separately. Kept because the ladder is computed and re-derivable, which is the whole difference from a typed table.',
    },
    render: (state) => {
      const { baseRem, ratio } = state.system.type;
      return present(
        'type.hierarchy',
        'Hierarchy',
        'measured',
        buildScale(baseRem, ratio).map((entry) => ({
          label: entry.token,
          value: `${entry.rem}rem`,
          note: `${entry.px}px at a 16px root`,
        }))
      );
    },
  },
  {
    id: 'type.paragraph-spacing',
    name: 'Paragraph spacing & measure',
    section: 4,
    requires: ['type.metrics'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ paragraphSpacingEm: num(), measureCh: num('Line length in characters') }),
    evidence: 'declared',
    provenance: {
      origin: 'proposed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Split out by me from the typography row, not observed anywhere. Low provenance — a candidate for folding back into type.metrics if §4 needs trimming.',
    },
    render: () => ({
      kind: 'absent',
      id: 'type.paragraph-spacing',
      title: 'Paragraph spacing & measure',
      reason:
        'Not set yet. Paragraph spacing and a line-length target are the two typographic rules the scale does not imply.',
    }),
  },
  {
    id: 'type.formatting',
    name: 'Typesetting rules',
    section: 4,
    requires: ['type.hierarchy'],
    machine: 'M2',
    storage: 'project',
    produces: obj({
      alignment: str(),
      caseRules: str(),
      widowsOrphans: str(),
      numerals: str(),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['type.formatting'],
      frequency: 1,
      sectors: 1,
      wheeler: false,
    },
    render: () => ({
      kind: 'absent',
      id: 'type.formatting',
      title: 'Typesetting rules',
      reason: 'Not written yet. Alignment, case, widows and orphans, and which numerals to set.',
    }),
  },
  {
    id: 'type.text-spacing',
    name: 'Text spacing tolerance (WCAG 1.4.12)',
    section: 4,
    requires: ['type.hierarchy'],
    machine: 'M2',
    storage: 'system',
    produces: obj({
      lineHeight: num('Authored line height'),
      toleratesOverride: str('pass | fail'),
    }),
    evidence: 'measured',
    provenance: {
      origin: 'proposed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Mine, and not observed in any sampled book. Kept because it is one of very few brand-book rules that can be checked rather than asserted, and because public-sector work makes it a procurement question rather than a preference.',
    },
    render: (state) => {
      const { lineHeight } = state.system.type;
      const tolerates = lineHeight >= TEXT_SPACING_LINE_HEIGHT;
      return present('type.text-spacing', 'Text spacing tolerance (WCAG 1.4.12)', 'measured', [
        { label: 'Authored line height', value: lineHeight.toFixed(2) },
        {
          label: 'Reader override of 1.5',
          value: tolerates ? 'no layout change' : 'increases line height',
          note: tolerates
            ? 'Already at or above the value the criterion asks content to tolerate.'
            : 'The layout has to survive a change it is not authored at.',
        },
      ]);
    },
    validate: (state): readonly Finding[] => {
      const { lineHeight } = state.system.type;
      if (lineHeight >= TEXT_SPACING_LINE_HEIGHT) return [];
      return [
        finding(
          'type.text-spacing',
          'warn',
          'Body line height is below the 1.5 a reader may force under WCAG 1.4.12, so the layout has to tolerate a spacing change it is not authored at.',
          { measured: lineHeight.toFixed(2), expected: `≥ ${TEXT_SPACING_LINE_HEIGHT}` }
        ),
      ];
    },
  },
];
