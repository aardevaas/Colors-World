/**
 * §3 Colour architecture — machine M2, Compute & Verify.
 *
 * The section that already works. Everything here reads the URL-shaped System,
 * which means all of it renders for an anonymous visitor with no account and
 * no project — and that is the point of splitting the state model rather than
 * moving it. Someone who wants a palette and nothing else gets a legitimate,
 * shippable book out of this section alone.
 *
 * It is also where `evidence: 'measured'` stops being a label and starts being
 * a computation. A hex is `declared` — you picked it. The contrast ratio
 * beside it is `measured`, and `validate` re-derives it on every render, so
 * the book cannot claim a passing ratio it does not have. Every competitor
 * ships "4.5:1" as a number a human typed into a PDF.
 */

import {
  auditContrast,
  formatCmyk,
  formatHsl,
  formatOklchCss,
  formatRgb,
  toCmyk,
} from '@/lib/color-engine';
import { absent, arr, finding, num, obj, present, str } from '../block';
import { hasPalette, systemRoles } from '../colour';
import type { BookEntry, BrandComponent, Finding } from '../types';

/** WCAG 1.4.3 AA for normal text. The one threshold this section defends. */
const AA_NORMAL = 4.5;

const NO_PALETTE = 'No colours yet. Everything in this section follows from the palette.';

/** The text-on-surface pairs worth checking; inks are unfailable by construction. */
const CHECKED_PAIRS = [
  { fg: 'text', bg: 'background', label: 'Text on background' },
  { fg: 'text', bg: 'surface', label: 'Text on surface' },
] as const;

export const SECTION_3: readonly BrandComponent[] = [
  {
    id: 'colour.palette',
    name: 'Palette & hierarchy',
    section: 3,
    requires: [],
    machine: 'M2',
    storage: 'system',
    produces: obj(
      {
        palette: arr(obj({ hex: str(), oklch: str() }, ['hex'])),
        anchorHex: str('The colour scales are built from'),
        weighting: obj({ dominant: num(), secondary: num(), accent: num() }, []),
      },
      ['palette']
    ),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['colour.palette'],
      frequency: 18,
      sectors: 11,
      wheeler: true,
      note: 'One of the three CORE components, and one of the two this product already has.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.palette', 'Palette & hierarchy', NO_PALETTE);
      const entries: BookEntry[] = system.palette.map((c, i) => ({
        label: `Colour ${i + 1}`,
        value: c.hex,
        note: formatOklchCss(c.oklch),
      }));
      entries.push({
        label: 'Anchor',
        value: system.anchorHex ?? 'not set',
        note: 'The colour every scale is built from.',
      });
      return present('colour.palette', 'Palette & hierarchy', 'declared', entries);
    },
    validate: (state): readonly Finding[] => {
      const { system } = state;
      if (!hasPalette(system)) return [];
      if (system.anchorHex !== null) return [];
      return [
        finding(
          'colour.palette',
          'warn',
          `The palette has ${system.palette.length} colours but no anchor is set, so every scale derives from nothing.`,
          { expected: 'one anchor colour' }
        ),
      ];
    },
  },
  {
    id: 'colour.values',
    name: 'Colour values',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: arr(
      obj({ hex: str(), rgb: str(), hsl: str(), oklch: str() }, ['hex', 'rgb', 'hsl', 'oklch'])
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['colour.values-mediums'],
      frequency: 5,
      sectors: 5,
      wheeler: true,
      sharedObservation: true,
      note: 'Shares its observation with colour.print: sampled books carry one "colour values across media" section covering both screen and print. One sighting, two rules — not two sightings.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.values', 'Colour values', NO_PALETTE);
      return present(
        'colour.values',
        'Colour values',
        'measured',
        system.palette.map((c) => ({
          label: c.hex,
          value: `${formatRgb(c.oklch)} · ${formatHsl(c.oklch)}`,
          note: formatOklchCss(c.oklch),
        }))
      );
    },
  },
  {
    id: 'colour.print',
    name: 'Print mapping',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ hex: str(), cmyk: str() }, ['hex', 'cmyk'])),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['colour.values-mediums'],
      frequency: 5,
      sectors: 5,
      wheeler: true,
      sharedObservation: true,
      note: 'Shares its observation with colour.values — see the note there. Spot-colour (Pantone) values are deliberately absent: the library is licensed and cannot ship.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.print', 'Print mapping', NO_PALETTE);
      const entries: BookEntry[] = system.palette.map((c) => ({
        label: c.hex,
        value: formatCmyk(toCmyk(c.oklch)),
      }));
      entries.push({
        label: 'Spot colours',
        value: 'Not specified',
        evidence: 'declared',
        note: 'Pantone values are licensed and are not distributed with this product. Ask your printer to match the CMYK build above.',
      });
      return present('colour.print', 'Print mapping', 'measured', entries);
    },
  },
  {
    id: 'colour.tints',
    name: 'Tints & shades',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ steps: num('Steps per scale'), gamut: str() }, ['steps']),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['colour.tints'],
      frequency: 1,
      sectors: 1,
      wheeler: false,
      note: 'Observed once, but had no row in the spec’s taxonomy. Placed here because the scale engine already produces exactly this and it was going unclaimed.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.tints', 'Tints & shades', NO_PALETTE);
      const tuned = Object.keys(system.scales.byHex).length;
      return present('colour.tints', 'Tints & shades', 'measured', [
        { label: 'Steps per scale', value: String(system.scales.steps) },
        { label: 'Gamut', value: system.scales.gamut },
        {
          label: 'Tuned scales',
          value: `${tuned} of ${system.palette.length}`,
          note: 'Scales nobody has adjusted use the default curve.',
        },
      ]);
    },
  },
  {
    id: 'colour.surfaces',
    name: 'Surfaces & borders',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ background: str(), surface: str(), border: str() }, ['background']),
    evidence: 'measured',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'The spec\u2019s taxonomy calls this row "Neutral & grey scale". Renamed 2026-08-23 because that is not what it can render. The role model orders by OKLCH lightness, so on a palette with no low-chroma member it will hand back a saturated colour as the surface \u2014 a green was appearing under a heading that said "greys". What the System genuinely holds is the three structural roles, so that is what this states. A true neutral ramp is a real brand-book concept and the System has no such object; giving it a component here would be the exact overclaim the evidence field exists to prevent.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.surfaces', 'Surfaces & borders', NO_PALETTE);
      const roles = systemRoles(system);
      return present('colour.surfaces', 'Surfaces & borders', 'measured', [
        { label: 'Background', value: roles.background.hex },
        { label: 'Surface', value: roles.surface.hex },
        { label: 'Border', value: roles.border.hex },
        {
          label: 'Derived by',
          value: 'OKLCH lightness ordering, not hue',
          note: 'These are the roles the palette produced, which is not the same thing as a neutral ramp.',
        },
      ]);
    },
  },
  {
    id: 'colour.state',
    name: 'UI state colours',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ success: str(), warning: str(), error: str(), info: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Absent from every sampled brand book — it is a design-system concern rather than a brand-manual one. Kept because the in-house-team user (D1 C) cannot ship without it.',
    },
    render: (state) =>
      absent(
        'colour.state',
        'UI state colours',
        hasPalette(state.system)
          ? 'Not defined yet. Success, warning, error and info are the four the palette does not supply on its own.'
          : NO_PALETTE
      ),
  },
  {
    id: 'colour.themes',
    name: 'Light & dark themes',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ mode: str('Which polarity the system is authored in', ['light', 'dark']) }, [
      'mode',
    ]),
    evidence: 'measured',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'No sampled book carried a theme-mapping section. Kept because the role model already produces both polarities from one palette.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.themes', 'Light & dark themes', NO_PALETTE);
      const roles = systemRoles(system);
      return present('colour.themes', 'Light & dark themes', 'measured', [
        { label: 'Authored in', value: system.mode, evidence: 'declared' },
        { label: 'Background', value: roles.background.hex },
        { label: 'Text', value: roles.text.hex },
        {
          label: 'Opposite polarity',
          value: 'Derived from the same palette',
          note: 'Roles are ordered by OKLCH lightness, so flipping polarity re-derives rather than re-picks.',
        },
      ]);
    },
  },
  {
    id: 'colour.contrast-pairs',
    name: 'Contrast pairings',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: arr(
      obj({ foreground: str(), background: str(), ratio: num(), passesAA: str() }, [
        'foreground',
        'background',
        'ratio',
      ])
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['colour.accessibility-contrast'],
      frequency: 1,
      sectors: 1,
      wheeler: false,
      note: 'Measured in only one of 25 books — which is precisely the opening. Every other book asserts accessibility; this one computes it and re-checks it on render.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.contrast-pairs', 'Contrast pairings', NO_PALETTE);
      const roles = systemRoles(system);
      return present(
        'colour.contrast-pairs',
        'Contrast pairings',
        'measured',
        CHECKED_PAIRS.map((pair) => {
          const report = auditContrast(roles[pair.fg].oklch, roles[pair.bg].oklch);
          return {
            label: pair.label,
            value: `${report.ratio.toFixed(2)}:1`,
            note: report.normalText.aaa
              ? 'Passes AAA'
              : report.normalText.aa
                ? 'Passes AA'
                : 'Below AA for normal text',
          };
        })
      );
    },
    validate: (state): readonly Finding[] => {
      const { system } = state;
      if (!hasPalette(system)) return [];
      const roles = systemRoles(system);
      const findings: Finding[] = [];
      for (const pair of CHECKED_PAIRS) {
        const report = auditContrast(roles[pair.fg].oklch, roles[pair.bg].oklch);
        if (!report.normalText.aa) {
          findings.push(
            finding('colour.contrast-pairs', 'fail', `${pair.label} is below AA for normal text.`, {
              measured: `${report.ratio.toFixed(2)}:1`,
              expected: `≥ ${AA_NORMAL}:1`,
            })
          );
        }
      }
      return findings;
    },
  },
];
