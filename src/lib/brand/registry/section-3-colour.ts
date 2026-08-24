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
  CVD_TYPES,
  deltaEOk,
  formatHex,
  shortestHueDelta,
  simulateCvd,
  type Oklch,
  formatCmyk,
  formatHsl,
  formatOklchCss,
  formatRgb,
  toCmyk,
} from '@/lib/color-engine';
import { absent, arr, finding, num, obj, present, renderAuthored, renderDerived, str } from '../block';
import { hasPalette, paletteColors, systemRoles } from '../colour';
import { asPercent, coverage } from '../proportions';
import { REFERENCE_SURFACES } from '../surfaces';
import type { RoleColor, SemanticRole } from '@/lib/roles/semantic-roles';
import type { BookEntry, BrandComponent, Finding } from '../types';

/** WCAG 1.4.3 AA for normal text. The one threshold this section defends. */
const AA_NORMAL = 4.5;

const NO_PALETTE = 'No colours yet. Everything in this section follows from the palette.';

/** The text-on-surface pairs worth checking; inks are unfailable by construction. */
const CHECKED_PAIRS = [
  { fg: 'text', bg: 'background', label: 'Text on background' },
  { fg: 'text', bg: 'surface', label: 'Text on surface' },
] as const;


/**
 * How far apart two categorical colours must stay once a deficiency is
 * simulated, as a distance in OKLab.
 *
 * **This threshold is ours, not a standard.** No specification states a minimum
 * ΔE for two series in a chart. The distance is measured; the line drawn
 * through it is a judgement, and the book says so rather than letting anyone
 * quote it as a published requirement.
 */
const CATEGORICAL_MIN_DELTA_E = 0.1;

/** Pairs of palette colours that collapse under any simulated deficiency. */
function collapsingPairs(
  palette: readonly { hex: string; oklch: Oklch }[]
): readonly { a: string; b: string; type: string; delta: number }[] {
  const out: { a: string; b: string; type: string; delta: number }[] = [];
  for (let i = 0; i < palette.length; i += 1) {
    for (let j = i + 1; j < palette.length; j += 1) {
      for (const type of CVD_TYPES) {
        const delta = deltaEOk(
          simulateCvd(palette[i]!.oklch, type),
          simulateCvd(palette[j]!.oklch, type)
        );
        if (delta < CATEGORICAL_MIN_DELTA_E) {
          out.push({ a: palette[i]!.hex, b: palette[j]!.hex, type, delta });
        }
      }
    }
  }
  return out;
}

/**
 * The colour a person gets when they mix two brand colours to "make a new one".
 *
 * Averaged in OKLab rather than sRGB, because that is the space the rest of the
 * engine reasons in and it is the one where a midpoint looks like a midpoint.
 * Hue is averaged the short way round the wheel; two colours more than 180°
 * apart have no meaningful midpoint hue, and the ΔE reported beside the result
 * is what makes that visible rather than hidden.
 */
function midpointOf(a: Oklch, b: Oklch): Oklch {
  const dh = shortestHueDelta(a.h, b.h);
  return { l: (a.l + b.l) / 2, c: (a.c + b.c) / 2, h: (a.h + dh / 2 + 360) % 360 };
}

/** How far a colour sits from the nearest thing actually in the palette. */
function distanceFromPalette(colour: Oklch, palette: readonly RoleColor[]): number {
  return Math.min(...palette.map((p) => deltaEOk(colour, p.oklch)));
}

/** The worst text/background pairing the palette can produce. */
function worstPairing(
  palette: readonly RoleColor[]
): { fg: string; bg: string; ratio: number } | null {
  let worst: { fg: string; bg: string; ratio: number } | null = null;
  for (const a of palette) {
    for (const b of palette) {
      if (a.hex === b.hex) continue;
      const ratio = auditContrast(a.oklch, b.oklch).ratio;
      if (!worst || ratio < worst.ratio) worst = { fg: a.hex, bg: b.hex, ratio };
    }
  }
  return worst;
}

export const SECTION_3: readonly BrandComponent[] = [
  {
    id: 'colour.palette',
    name: 'Palette',
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
      grainSources: ['monash', 'irba', 'commonwealth', 'regus', 'ptc'],
      note: 'One of the three CORE components, and one of the two this product already has.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.palette', 'Palette', NO_PALETTE);
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
      return present('colour.palette', 'Palette', 'declared', entries);
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
      grainSources: ['monash', 'irba', 'commonwealth', 'regus', 'ptc'],
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
      grainSources: ['monash', 'irba', 'commonwealth', 'regus', 'ptc', 'aludium'],
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
      grainSources: ['commonwealth', 'irba', 'monash', 'regus'],
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
      grainSources: ['monash', 'ptc'],
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
      grainSources: ['monash', 'ptc'],
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

  /* ------------------------------------------------------------------------
   * Added 2026-08-24 when §3 was re-cut to internal-guideline grain. See
   * docs/research/INTERNAL-GUIDELINE-GRAIN.md — the 25-book study recorded
   * which sections a manual has, never what a section states, and every rule
   * below is one a real manual states and no colour tool can check.
   * --------------------------------------------------------------------- */
  {
    id: 'colour.tiers',
    name: 'Palette hierarchy',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: obj({
      primary: arr(str()),
      secondary: arr(str()),
      accent: arr(str()),
      utility: arr(str('Data-viz only — never a substitute for the palette')),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['monash', 'irba', 'ptc', 'commonwealth', 'regus'],
      note: 'Having colours and ranking them are two different rules, and every manual sampled states both. IRBA runs primary/secondary/accent; Monash primary/secondary/tertiary plus a separate utility set; PTC two primary, seven secondary, seven tertiary.',
    },
    render: renderDerived<{ primary?: readonly string[]; secondary?: readonly string[]; accent?: readonly string[] }>(
      'colour.tiers',
      'Palette hierarchy',
      'declared',
      'Not ranked yet. A palette without a hierarchy tells nobody which colour leads.',
      (d) => [
        ...(d.primary?.length ? [{ label: 'Primary', value: d.primary.join(' · ') }] : []),
        ...(d.secondary?.length ? [{ label: 'Secondary', value: d.secondary.join(' · ') }] : []),
        ...(d.accent?.length ? [{ label: 'Accent', value: d.accent.join(' · ') }] : []),
      ]
    ),
  },
  {
    id: 'colour.proportions',
    name: 'Colour proportions',
    section: 3,
    // The palette, not the tiers. These proportions are measured by ROLE off
    // real layouts, so they are computable the moment a palette exists —
    // requiring a hierarchy first would tell the readiness graph this is
    // blocked when it is already sitting there, computed.
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: arr(
      obj({ surface: str(), role: str(), measuredPct: num() }, ['surface', 'role', 'measuredPct'])
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['irba', 'regus', 'monash'],
      note: 'THE primitive nobody has. IRBA states primary 50% / secondary 20% / accent 20%. Regus states 60% white / 20% black / 10% red / 5% / 5%. Monash mandates a minimum 25% primary across all audiences. All three state a ratio; none of the three can check whether a given layout obeys it. "This surface is 8% primary against your 25% floor" is arithmetic.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) return absent('colour.proportions', 'Colour proportions', NO_PALETTE);

      const measured = REFERENCE_SURFACES.map((surface) => ({
        surface,
        cover: coverage(surface),
      }));

      const entries: BookEntry[] = measured.map(({ surface, cover }) => ({
        label: surface.name,
        value: (Object.entries(cover) as [SemanticRole, number][])
          .sort((a, b) => b[1] - a[1])
          .map(([role, fraction]) => `${role} ${asPercent(fraction)}`)
          .join(' · '),
      }));

      // The spread is the finding hiding in the table. A system almost always
      // hits its intended ratio on the layout it was designed against and
      // misses it by an order of magnitude somewhere nobody checked, and that
      // gap is invisible until the surfaces are read side by side.
      const primaries = measured.map(({ cover }) => cover.primary ?? 0);
      const low = Math.min(...primaries);
      const high = Math.max(...primaries);

      entries.push({
        label: 'Primary spread',
        value: `${asPercent(low)} – ${asPercent(high)}`,
        note: `Across ${REFERENCE_SURFACES.length} reference surfaces. State a floor and every one of them becomes checkable — which is the thing IRBA, Regus and Monash all ask for and none can do.`,
      });

      entries.push({
        label: 'How measured',
        value: `Declared geometry, ${REFERENCE_SURFACES[0]!.measuredViewport}`,
        evidence: 'measured',
        note: 'Rectangle areas composited front to back off the rendered templates, not sampled pixels — so gradients and translucent layers count for what they actually contribute rather than all or nothing.',
      });

      return present('colour.proportions', 'Colour proportions', 'measured', entries);
    },
  },
  {
    id: 'colour.order',
    name: 'Application order',
    section: 3,
    requires: ['colour.tiers'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ sequence: arr(str()), rule: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['monash', 'irba'],
      note: 'Monash: "Use primary colours first, then secondary, then tertiary. Introduce utility colours only if additional colours are required."',
    },
    render: renderDerived<{ sequence?: readonly string[]; rule?: string }>(
      'colour.order',
      'Application order',
      'declared',
      'Not set. Which tier is reached for first, and what has to be exhausted before the next.',
      (d) => [
        ...(d.sequence?.length ? [{ label: 'Sequence', value: d.sequence.join(' → ') }] : []),
        ...(d.rule ? [{ label: 'Rule', value: d.rule }] : []),
      ]
    ),
  },
  {
    id: 'colour.gradients',
    name: 'Gradients',
    section: 3,
    requires: ['colour.tiers'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ allowed: str('yes | no'), maxColours: num(), rules: arr(str()) }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['monash', 'commonwealth'],
      note: 'Monash: limit to two colours per gradient, never overpower the content, keep the primary prominent.',
    },
    render: renderDerived<{ allowed?: string; maxColours?: number; rules?: readonly string[] }>(
      'colour.gradients',
      'Gradients',
      'declared',
      'Not set. Whether gradients are permitted at all is itself the rule.',
      (d) => [
        ...(d.allowed ? [{ label: 'Permitted', value: d.allowed }] : []),
        ...(d.maxColours ? [{ label: 'Maximum colours', value: String(d.maxColours) }] : []),
        ...(d.rules ?? []).map((r, i) => ({ label: `Rule ${i + 1}`, value: r })),
      ]
    ),
  },
  {
    id: 'colour.exceptions',
    name: 'Colour exceptions',
    section: 3,
    requires: ['colour.tiers'],
    machine: 'M6',
    storage: 'project',
    produces: obj({ route: str('How a bespoke colour is requested'), approver: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['monash', 'irba'],
      note: 'Monash routes bespoke colour requests through a form under a strict approval process. IRBA allows secondary colours in isolation only "in conjunction with brand management".',
    },
    render: renderAuthored(
      'colour.exceptions',
      'Colour exceptions',
      'Route',
      'Not set. How someone asks for a colour that is not in the palette — and who says yes.'
    ),
  },
  {
    id: 'colour.dataviz',
    name: 'Data-visualisation palette',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: obj({
      categorical: arr(str()),
      sequential: arr(str()),
      diverging: arr(str()),
      cvdSafe: str('pass | fail'),
    }),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['monash', 'irba', 'carbon'],
      note: 'Moved here from §6 on 2026-08-24 — it is a colour concern that happens to appear in charts. Monash keeps a separate utility set used ONLY for data visualisation, with an explicit instruction to keep colour mapping consistent across related visuals; IRBA names data-viz as an ideal application of its secondary and accent tiers. Every manual claims its chart colours are colour-blind safe. This one simulates the deficiency and measures the distance.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) {
        return absent(
          'colour.dataviz',
          'Data-visualisation palette',
          'No colours yet. Chart palettes derive from the brand palette, then get checked against simulated colour-vision deficiency.'
        );
      }
      const collapses = collapsingPairs(system.palette);
      const entries: BookEntry[] = [
        { label: 'Categorical series', value: system.palette.map((c) => c.hex).join(' · ') },
        {
          label: 'Colour-vision check',
          value:
            collapses.length === 0
              ? `All pairs stay apart under ${CVD_TYPES.length} simulated deficiencies`
              : `${collapses.length} pair${collapses.length === 1 ? ' collapses' : 's collapse'}`,
          note: `Distance measured in OKLab; the ${CATEGORICAL_MIN_DELTA_E} floor is our judgement, not a published requirement.`,
        },
      ];
      for (const c of collapses.slice(0, 6)) {
        entries.push({ label: `${c.a} vs ${c.b}`, value: `ΔE ${c.delta.toFixed(3)} under ${c.type}` });
      }
      return present('colour.dataviz', 'Data-visualisation palette', 'measured', entries);
    },
    validate: (state): readonly Finding[] => {
      const { system } = state;
      if (!hasPalette(system)) return [];
      return collapsingPairs(system.palette).map((c) =>
        finding(
          'colour.dataviz',
          'warn',
          `${c.a} and ${c.b} are not distinguishable under ${c.type}, so two series using them read as one.`,
          { measured: `ΔE ${c.delta.toFixed(3)}`, expected: `≥ ${CATEGORICAL_MIN_DELTA_E}` }
        )
      );
    },
  },
  {
    id: 'colour.misuse',
    name: 'Colour misuse',
    section: 3,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ kind: str(), why: str(), measured: str() }, ['kind', 'why'])),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['irba', 'monash', 'ptc'],
      note: 'Every manual that has this page drew it by hand. Generated here from the real palette, each failure carrying the number that makes it a failure — the ΔE of a mixed colour from anything approved, the ratio of the worst pairing the palette can produce.',
    },
    render: (state) => {
      const { system } = state;
      const palette = paletteColors(system);
      if (palette.length < 2) {
        return absent(
          'colour.misuse',
          'Colour misuse',
          'Needs at least two colours. With two, this page generates itself.'
        );
      }
      const entries: BookEntry[] = [];

      const mixed = midpointOf(palette[0]!.oklch, palette[1]!.oklch);
      entries.push({
        label: 'Do not mix approved colours',
        value: `${palette[0]!.hex} + ${palette[1]!.hex} → ${formatHex(mixed)}`,
        note: `ΔE ${distanceFromPalette(mixed, palette).toFixed(3)} from the nearest colour you approved — it is a new colour, not a blend of two old ones.`,
      });

      const worst = worstPairing(palette);
      if (worst) {
        entries.push({
          label: 'Do not set these together',
          value: `${worst.fg} on ${worst.bg} — ${worst.ratio.toFixed(2)}:1`,
          note: 'The lowest-contrast pairing this palette can produce. Below 4.5:1 it fails AA for normal text.',
        });
      }

      return present('colour.misuse', 'Colour misuse', 'measured', entries);
    },
  },
];
