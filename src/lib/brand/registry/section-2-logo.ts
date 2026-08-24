/**
 * §2 Logo system & architecture — machine M1, Ingest & Derive.
 *
 * The most universal component in the corpus and the one this product cannot
 * do at all: `logo.primary` appears in 22 of 25 books across 12 of 13 sectors,
 * and there is no logo anywhere in the codebase. One upload opens six of the
 * nine components below, which makes it the largest single unlock in the
 * readiness graph.
 *
 * Four of these are genuinely `measured` rather than declared, and that is the
 * argument for building M1 early: clear space follows from the mark's own
 * geometry, minimum size from its smallest legible feature, background safety
 * from the contrast engine that already exists, and the misuse page can be
 * *generated* from the real mark with a measured ratio on each failure. Every
 * other brand book draws that page by hand.
 *
 * All of it depends on the upload being vector. A raster mark has no geometry
 * to read, which is why `logo.primary` carries the registry's first real
 * `validate` — the one check that can be made before M1 exists at all.
 */

import { absent, arr, finding, num, obj, present, renderDerived, str } from '../block';
import { primaryMark } from '../project';
import type { BrandComponent, Finding } from '../types';

/** Formats a mark's intrinsic size, when the upload carried one. */
function dimensions(width?: number, height?: number): string | null {
  if (typeof width !== 'number' || typeof height !== 'number') return null;
  return `${width} × ${height} px`;
}

export const SECTION_2: readonly BrandComponent[] = [
  {
    id: 'logo.primary',
    name: 'Primary logo',
    section: 2,
    requires: [],
    machine: 'M1',
    storage: 'project',
    produces: obj(
      {
        assetId: str('The uploaded mark'),
        format: str('Vector is required for anything downstream', [
          'svg',
          'png',
          'jpg',
          'webp',
        ]),
        width: num(),
        height: num(),
      },
      ['assetId', 'format']
    ),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.primary'],
      frequency: 22,
      sectors: 12,
      wheeler: true,
      note: 'The most universal component measured, and the only one of the three CORE components the product cannot produce.',
    },
    render: (state) => {
      const mark = primaryMark(state.project);
      if (!mark) {
        return absent(
          'logo.primary',
          'Primary logo',
          // Says outright that the mark has to come from somewhere else.
          // Every other block in §2 explains what an upload unlocks, which
          // reads like a feature that has not shipped yet — and the first
          // question anyone brings to a tool that builds their colour and
          // type system is whether it will also build their mark. It will
          // not, ever, and leaving that unsaid is how a reader waits for it.
          'No mark uploaded, and this product will not draw one — a logo is the part of an identity that has to be designed, not generated. Bring a vector mark and six further components follow from its own geometry: clear space, minimum size, variants, background safety, misuse and lockups.'
        );
      }
      const size = dimensions(mark.width, mark.height);
      return present('logo.primary', 'Primary logo', 'declared', [
        { label: 'Mark', value: mark.label },
        {
          label: 'Format',
          value: mark.format.toUpperCase(),
          evidence: 'measured',
          note:
            mark.format === 'svg'
              ? 'Vector — clear space, minimum size and background safety can be derived from its geometry.'
              : 'Raster — nothing downstream can be computed from it.',
        },
        ...(size ? [{ label: 'Intrinsic size', value: size, evidence: 'measured' as const }] : []),
      ]);
    },
    validate: (state): readonly Finding[] => {
      const mark = primaryMark(state.project);
      if (!mark) return [];
      if (mark.format === 'svg') return [];
      return [
        finding(
          'logo.primary',
          'warn',
          'The primary mark is raster, so clear space, minimum size, variants and background safety cannot be derived from it.',
          { measured: mark.format.toUpperCase(), expected: 'SVG' }
        ),
      ];
    },
  },
  {
    id: 'logo.variants',
    name: 'Secondary marks & variants',
    section: 2,
    requires: ['logo.primary'],
    machine: 'M1',
    storage: 'project',
    produces: arr(
      obj({ assetId: str(), label: str('Reversed, monochrome, stacked, icon-only') }, [
        'assetId',
        'label',
      ])
    ),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.variants'],
      frequency: 12,
      sectors: 8,
      wheeler: true,
    },
    render: renderDerived<readonly { label: string }[]>(
      'logo.variants',
      'Secondary marks & variants',
      'declared',
      'No variants yet. Monochrome and reversed versions can be generated from a vector primary.',
      (variants) => variants.map((v, i) => ({ label: `Variant ${i + 1}`, value: v.label }))
    ),
  },
  {
    id: 'logo.architecture',
    name: 'Brand architecture & lockups',
    section: 2,
    requires: ['logo.variants'],
    machine: 'M1',
    storage: 'project',
    produces: obj({
      model: str('How parent and sub-brands relate', [
        'monolithic',
        'endorsed',
        'freestanding',
        'hybrid',
      ]),
      lockups: arr(obj({ assetId: str(), label: str() }, ['assetId', 'label'])),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.architecture'],
      frequency: 9,
      sectors: 5,
      wheeler: true,
    },
    render: renderDerived<{ model?: string; lockups?: readonly { label: string }[] }>(
      'logo.architecture',
      'Brand architecture & lockups',
      'declared',
      'Not defined yet. How the parent mark relates to sub-brands, and the approved lockups.',
      (data) => [
        ...(data.model ? [{ label: 'Model', value: data.model }] : []),
        ...(data.lockups ?? []).map((l, i) => ({ label: `Lockup ${i + 1}`, value: l.label })),
      ]
    ),
  },
  {
    id: 'logo.cobranding',
    name: 'Co-branding & partner lockups',
    section: 2,
    requires: ['logo.variants'],
    machine: 'M1',
    storage: 'project',
    produces: obj({
      rule: str('Relative sizing and separation between marks'),
      minimumSeparation: str('Expressed in units of the mark, not pixels'),
      examples: arr(obj({ assetId: str(), label: str() }, ['assetId', 'label'])),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.cobranding'],
      frequency: 10,
      sectors: 6,
      wheeler: false,
      note: 'One of the eleven found by checking real books rather than transcribing. NASA and MemorialCare both devote whole sections to it; the original list had only parent/sub-brand.',
    },
    render: renderDerived<{ rule?: string; minimumSeparation?: string }>(
      'logo.cobranding',
      'Co-branding & partner lockups',
      'declared',
      'Not defined yet. How the mark sits beside a partner’s, and how far apart.',
      (data) => [
        ...(data.rule ? [{ label: 'Rule', value: data.rule }] : []),
        ...(data.minimumSeparation
          ? [{ label: 'Minimum separation', value: data.minimumSeparation }]
          : []),
      ]
    ),
  },
  {
    id: 'logo.construction',
    name: 'Construction & geometry grid',
    section: 2,
    requires: ['logo.primary'],
    machine: 'M1',
    storage: 'project',
    produces: obj({
      unit: str('The module the mark is built from'),
      grid: str('Description of the construction grid'),
    }),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.construction'],
      frequency: 1,
      sectors: 1,
      wheeler: false,
      note: 'Rare (1 of 25) and largely a heritage-manual convention. Kept because it is derivable from a vector mark at no extra cost once M1 exists.',
    },
    render: renderDerived<{ unit?: string; grid?: string }>(
      'logo.construction',
      'Construction & geometry grid',
      'measured',
      'Not derived yet. Requires a vector primary mark.',
      (data) => [
        ...(data.unit ? [{ label: 'Unit', value: data.unit }] : []),
        ...(data.grid ? [{ label: 'Grid', value: data.grid }] : []),
      ]
    ),
  },
  {
    id: 'logo.clear-space',
    name: 'Clear space',
    section: 2,
    requires: ['logo.primary'],
    machine: 'M1',
    storage: 'project',
    produces: obj(
      {
        unit: str('Which feature of the mark defines one unit'),
        multiplier: num('Clear space as a multiple of that unit'),
      },
      ['unit', 'multiplier']
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.clear-space'],
      frequency: 7,
      sectors: 6,
      wheeler: true,
      note: 'Derivable from the mark’s own geometry rather than asserted — one of the two genuinely differentiated M1 outputs.',
    },
    render: renderDerived<{ unit: string; multiplier: number }>(
      'logo.clear-space',
      'Clear space',
      'measured',
      'Not derived yet. Upload a vector mark and this follows from its own geometry.',
      (data) => [
        { label: 'Unit', value: data.unit },
        { label: 'Clear space', value: `${data.multiplier}× the unit on every side` },
      ]
    ),
  },
  {
    id: 'logo.min-size',
    name: 'Minimum size',
    section: 2,
    requires: ['logo.primary'],
    machine: 'M1',
    storage: 'project',
    produces: obj({
      screenPx: num('Smallest legible width on screen'),
      printMm: num('Smallest legible width in print'),
      limitingFeature: str('The detail that fails first'),
    }),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.min-size'],
      frequency: 6,
      sectors: 5,
      wheeler: true,
    },
    render: renderDerived<{ screenPx?: number; printMm?: number; limitingFeature?: string }>(
      'logo.min-size',
      'Minimum size',
      'measured',
      'Not computed yet. Requires a vector primary mark.',
      (data) => [
        ...(data.screenPx ? [{ label: 'Screen', value: `${data.screenPx} px wide` }] : []),
        ...(data.printMm ? [{ label: 'Print', value: `${data.printMm} mm wide` }] : []),
        ...(data.limitingFeature
          ? [{ label: 'Limited by', value: data.limitingFeature, note: 'The detail that fails first' }]
          : []),
      ]
    ),
  },
  {
    id: 'logo.placement-backgrounds',
    name: 'Placement & background safety',
    section: 2,
    requires: ['logo.primary', 'colour.palette'],
    machine: 'M1',
    storage: 'project',
    produces: arr(
      obj(
        {
          backgroundHex: str(),
          variant: str('Which mark variant is safe here'),
          contrast: num('Measured ratio'),
          safe: str('pass | fail'),
        },
        ['backgroundHex', 'contrast', 'safe']
      )
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.placement-backgrounds'],
      frequency: 9,
      sectors: 5,
      wheeler: false,
      note: 'Every brand book asserts which backgrounds are safe. With the contrast engine already built, this one can be proved.',
    },
    render: renderDerived<readonly { backgroundHex: string; contrast: number; safe: string }[]>(
      'logo.placement-backgrounds',
      'Placement & background safety',
      'measured',
      'Not proved yet. Needs a mark and a palette; the ratio against each brand colour is then computed, not asserted.',
      (rows) =>
        rows.map((r) => ({
          label: r.backgroundHex,
          value: `${r.contrast.toFixed(2)}:1 — ${r.safe}`,
          evidence: 'measured' as const,
        }))
    ),
  },
  {
    id: 'logo.misuse',
    name: 'Misuse',
    section: 2,
    requires: ['logo.primary', 'colour.palette'],
    machine: 'M1',
    storage: 'project',
    produces: arr(
      obj({ kind: str('stretched | rotated | recoloured | shadowed | low-contrast | busy-bg'), why: str(), measured: str() }, [
        'kind',
        'why',
      ])
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['logo.misuse'],
      frequency: 12,
      sectors: 9,
      wheeler: true,
      note: 'Drawn by hand in every book that has it. Generated here from the real mark, each failure labelled with why, and the contrast ones carrying a measured ratio.',
    },
    render: renderDerived<readonly { kind: string; why: string; measured?: string }[]>(
      'logo.misuse',
      'Misuse',
      'measured',
      'Not generated yet. Needs a mark and a palette — then the don’ts page renders itself.',
      (rows) =>
        rows.map((r) => ({
          label: r.kind,
          value: r.why,
          ...(r.measured ? { evidence: 'measured' as const, note: r.measured } : {}),
        }))
    ),
  },
];
