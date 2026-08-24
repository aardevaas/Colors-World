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
 * Data-viz palettes moved OUT of this section on 2026-08-24, to §3. They are a
 * colour concern that happens to appear in charts, not a web concern — and the
 * grain study found real manuals (Monash, IRBA, Carbon) documenting them inside
 * the colour section, as a separate utility set with its own usage rule.
 */

import { arr, num, obj, renderAuthored, renderDerived, str } from '../block';
import type { BrandComponent } from '../types';

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
];
