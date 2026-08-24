/**
 * §6 Web / UX / product design system — machine M2, Compute & Verify.
 *
 * This is `/visualizer` grown up. The section is thin in real brand books —
 * `web.components` measures 4 of 25 — because a brand manual and a design
 * system are usually two different documents maintained by two different
 * teams. That separation is the opportunity rather than a reason to skip it:
 * the in-house-team user cannot hand off without §6, and nothing else in the
 * category renders both from one source.
 *
 * `web.dataviz-palettes` is the one component here that is already fully
 * computable, and it is the clearest example of the product's whole claim.
 * Every other brand book says its chart colours are colour-blind safe. This
 * one simulates the deficiency and measures the distance.
 */

import { CVD_TYPES, deltaEOk, simulateCvd, type Oklch } from '@/lib/color-engine';
import { absent, arr, finding, num, obj, present, renderAuthored, renderDerived, str } from '../block';
import { hasPalette } from '../colour';
import type { BookEntry, BrandComponent, Finding } from '../types';

/**
 * How far apart two categorical colours must stay once a deficiency is
 * simulated, as a distance in OKLab.
 *
 * **This threshold is ours, not a standard.** No specification states a
 * minimum ΔE for two series in a chart. The distance is measured; the line
 * drawn through it is a judgement, and it is labelled that way in the book so
 * nobody quotes it as a published requirement.
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

export const SECTION_6: readonly BrandComponent[] = [
  {
    id: 'web.grid',
    name: 'Spatial grid',
    section: 6,
    requires: [],
    machine: 'M2',
    storage: 'project',
    produces: obj({ basePx: num('4 or 8'), columns: num(), gutterPx: num() }, ['basePx']),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['web.grid'],
      frequency: 4,
      sectors: 3,
      wheeler: true,
    },
    render: renderDerived<{ basePx: number; columns?: number; gutterPx?: number }>(
      'web.grid',
      'Spatial grid',
      'measured',
      'Not set yet. One base unit — 4 or 8px — makes every spacing decision downstream checkable.',
      (d) => [
        { label: 'Base unit', value: `${d.basePx}px` },
        ...(d.columns ? [{ label: 'Columns', value: String(d.columns) }] : []),
        ...(d.gutterPx ? [{ label: 'Gutter', value: `${d.gutterPx}px` }] : []),
      ]
    ),
  },
  {
    id: 'web.breakpoints',
    name: 'Breakpoints & containers',
    section: 6,
    requires: ['web.grid'],
    machine: 'M2',
    storage: 'project',
    produces: arr(obj({ name: str(), minPx: num(), containerPx: num() }, ['name', 'minPx'])),
    evidence: 'measured',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Not named in any sampled book — a design-system concern rather than a brand-manual one.',
    },
    render: renderDerived<readonly { name: string; minPx: number; containerPx?: number }[]>(
      'web.breakpoints',
      'Breakpoints & containers',
      'measured',
      'Not set yet. Needs a grid first — a breakpoint that is not a multiple of the base unit undoes it.',
      (rows) =>
        rows.map((r) => ({
          label: r.name,
          value: `from ${r.minPx}px`,
          ...(r.containerPx ? { note: `container ${r.containerPx}px` } : {}),
        }))
    ),
  },
  {
    id: 'web.components',
    name: 'Component library & states',
    section: 6,
    requires: ['colour.palette', 'type.metrics'],
    machine: 'M2',
    storage: 'project',
    produces: arr(
      obj({ name: str(), states: arr(str('default | hover | focus | active | disabled')) }, [
        'name',
        'states',
      ])
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['web.components'],
      frequency: 4,
      sectors: 2,
      wheeler: false,
      note: 'Low in brand books because it usually lives in a separate design system. This is the surface /visualizer becomes.',
    },
    render: renderDerived<readonly { name: string; states: readonly string[] }[]>(
      'web.components',
      'Component library & states',
      'measured',
      'Not built yet. A component without its focus and disabled states is half a specification.',
      (rows) => rows.map((r) => ({ label: r.name, value: r.states.join(' · ') }))
    ),
  },
  {
    id: 'web.navigation',
    name: 'Navigation architecture',
    section: 6,
    requires: ['web.components'],
    machine: 'M2',
    storage: 'project',
    produces: obj({ pattern: str(), levels: num(), rules: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['web.navigation'],
      frequency: 2,
      sectors: 2,
      wheeler: true,
    },
    render: renderAuthored(
      'web.navigation',
      'Navigation architecture',
      'Pattern',
      'Not defined yet. How deep the hierarchy goes and what each level is called.'
    ),
  },
  {
    id: 'web.elevation',
    name: 'Elevation, radius & shadow',
    section: 6,
    requires: [],
    machine: 'M2',
    storage: 'project',
    produces: obj({
      radii: arr(obj({ token: str(), px: num() }, ['token', 'px'])),
      elevations: arr(obj({ token: str(), shadow: str() }, ['token', 'shadow'])),
    }),
    evidence: 'measured',
    provenance: {
      origin: 'proposed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Mine, added when structuring the taxonomy and never externally validated. Low provenance — an honest candidate for the first cut.',
    },
    render: renderDerived<{
      radii?: readonly { token: string; px: number }[];
      elevations?: readonly { token: string; shadow: string }[];
    }>(
      'web.elevation',
      'Elevation, radius & shadow',
      'measured',
      'Not set yet. Uniform radius and shadow across every component is the fastest way to look like a template.',
      (d) => [
        ...(d.radii ?? []).map((r) => ({ label: r.token, value: `${r.px}px` })),
        ...(d.elevations ?? []).map((e) => ({ label: e.token, value: e.shadow })),
      ]
    ),
  },
  {
    id: 'web.accessibility',
    name: 'Interactive accessibility',
    section: 6,
    requires: ['web.components'],
    machine: 'M2',
    storage: 'project',
    produces: obj({
      focusStyle: str(),
      minimumTargetPx: num('24 for WCAG 2.2 AA, 44 for AAA'),
      reducedMotion: str(),
    }),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['web.accessibility'],
      frequency: 4,
      sectors: 3,
      wheeler: false,
      note: 'Becomes mandatory rather than advisory for the public-sector coordinate, where EN 301 549 and Section 508 are procurement conditions.',
    },
    render: renderDerived<{ focusStyle?: string; minimumTargetPx?: number; reducedMotion?: string }>(
      'web.accessibility',
      'Interactive accessibility',
      'measured',
      'Not set yet. Focus treatment, minimum target size and reduced-motion behaviour.',
      (d) => [
        ...(d.focusStyle ? [{ label: 'Focus', value: d.focusStyle }] : []),
        ...(d.minimumTargetPx
          ? [
              {
                label: 'Minimum target',
                value: `${d.minimumTargetPx}px`,
                note: d.minimumTargetPx >= 24 ? 'Meets WCAG 2.2 AA' : 'Below WCAG 2.2 AA (24px)',
              },
            ]
          : []),
        ...(d.reducedMotion ? [{ label: 'Reduced motion', value: d.reducedMotion }] : []),
      ]
    ),
  },
  {
    id: 'web.dataviz-palettes',
    name: 'Data-viz palettes',
    section: 6,
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
      note: 'One of the eleven found by checking real books — IBM Carbon ships categorical, sequential and diverging ramps as a first-class part of the system. Not recorded as its own id in the 25-book sample (the one dataviz sighting is counted against imagery.dataviz), so the frequency here is genuinely 0 rather than low.',
    },
    render: (state) => {
      const { system } = state;
      if (!hasPalette(system)) {
        return absent(
          'web.dataviz-palettes',
          'Data-viz palettes',
          'No colours yet. Chart palettes are derived from the brand palette, then checked against simulated colour-vision deficiency.'
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
              : `${collapses.length} pair${collapses.length === 1 ? '' : 's'} collapse`,
          note: `Distance measured in OKLab; the ${CATEGORICAL_MIN_DELTA_E} floor is our judgement, not a published requirement.`,
        },
      ];
      for (const c of collapses.slice(0, 6)) {
        entries.push({
          label: `${c.a} vs ${c.b}`,
          value: `ΔE ${c.delta.toFixed(3)} under ${c.type}`,
        });
      }
      return present('web.dataviz-palettes', 'Data-viz palettes', 'measured', entries);
    },
    validate: (state): readonly Finding[] => {
      const { system } = state;
      if (!hasPalette(system)) return [];
      return collapsingPairs(system.palette).map((c) =>
        finding(
          'web.dataviz-palettes',
          'warn',
          `${c.a} and ${c.b} are not distinguishable under ${c.type}, so two series using them read as one.`,
          { measured: `ΔE ${c.delta.toFixed(3)}`, expected: `≥ ${CATEGORICAL_MIN_DELTA_E}` }
        )
      );
    },
  },
];
