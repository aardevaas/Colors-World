/**
 * §5 Imagery, graphics & motion — machines M4 (Direct) and M2 (Compute).
 *
 * The section where the sample's bias is most visible and most worth stating.
 * `imagery.dataviz` measures 1 of 25, and an earlier draft of this taxonomy
 * called it "the single biggest miss" — that claim came from a tech-heavy
 * first sample and the widened one does not support it. It stays as a
 * differentiation bet on ground the colour engine already owns, labelled as a
 * bet rather than as table stakes.
 *
 * Two components here were found by checking real books rather than
 * transcribing a list: `imagery.graphic-device` measures 11 of 25 — more
 * common than clear space — and had no place in the original taxonomy at all.
 *
 * The split between M4 and M2 is not decorative. M4 components are *directed*:
 * a person sets an axis and the output is a spec plus a reference board. M2
 * components are *computed*: a grid, a stroke system, an easing ladder, all
 * of which have a right answer given the inputs.
 */

import { arr, num, obj, renderAuthored, renderDerived, str } from '../block';
import type { BrandComponent } from '../types';

export const SECTION_5: readonly BrandComponent[] = [
  {
    id: 'imagery.photography',
    name: 'Photography direction',
    section: 5,
    requires: [],
    machine: 'M4',
    storage: 'project',
    produces: obj({
      axes: arr(obj({ axis: str('e.g. candid ↔ staged'), position: num() }, ['axis', 'position'])),
      notes: str(),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['imagery.photography'],
      frequency: 7,
      sectors: 6,
      wheeler: true,
      note: 'Observed in 7 books but shallow in most of them. The sample cannot see luxury or private corporate manuals, which are exactly where this section runs deepest — treat 28% as a floor.',
    },
    render: renderAuthored(
      'imagery.photography',
      'Photography direction',
      'Direction',
      'Not set yet. Named axes — candid to staged, warm to cool, close to wide — beat an adjective list.'
    ),
  },
  {
    id: 'imagery.grading',
    name: 'Colour grading',
    section: 5,
    requires: ['colour.palette'],
    machine: 'M4',
    storage: 'project',
    produces: obj({ direction: str(), lutUrl: str(), tolerance: num('ΔE from the palette') }),
    evidence: 'declared',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Not observed anywhere. Kept because the ΔE machinery to check a graded image against the palette already exists, which makes this cheap to make measurable later.',
    },
    render: renderAuthored(
      'imagery.grading',
      'Colour grading',
      'Grade',
      'Not set yet. How photography is graded so it sits beside the palette rather than fighting it.'
    ),
  },
  {
    id: 'imagery.cropping',
    name: 'Cropping & text-safe areas',
    section: 5,
    requires: [],
    machine: 'M4',
    storage: 'project',
    produces: obj({ ratios: arr(str()), safeArea: str(), focalRules: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Not named in any sampled book, though several imply it inside photography. Kept because M5 templates need a safe area to place type against.',
    },
    render: renderAuthored(
      'imagery.cropping',
      'Cropping & text-safe areas',
      'Rules',
      'Not set yet. Which ratios are used, and where type may sit over an image.'
    ),
  },
  {
    id: 'imagery.illustration',
    name: 'Illustration system',
    section: 5,
    requires: ['colour.palette'],
    machine: 'M4',
    storage: 'project',
    produces: obj({ style: str(), strokeRules: str(), paletteSubset: arr(str()) }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['imagery.illustration'],
      frequency: 1,
      sectors: 1,
      wheeler: false,
    },
    render: renderAuthored(
      'imagery.illustration',
      'Illustration system',
      'Style',
      'Not set yet. Style, stroke behaviour, and which part of the palette illustration may use.'
    ),
  },
  {
    id: 'imagery.graphic-device',
    name: 'Supporting graphic device',
    section: 5,
    requires: ['colour.palette'],
    machine: 'M4',
    storage: 'project',
    produces: obj({ description: str(), construction: str(), misuse: arr(str()) }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['imagery.graphic-device'],
      frequency: 11,
      sectors: 7,
      wheeler: false,
      note: 'One of the eleven found by checking real books. At 44% it is more common than clear space, and it was missing from the taxonomy entirely — NASA calls it "supporting elements", MemorialCare a "connection graphic". Also a Romaniuk distinctive asset.',
    },
    render: renderAuthored(
      'imagery.graphic-device',
      'Supporting graphic device',
      'Device',
      'Not defined yet. The recurring non-logo mark — a swoosh, a bracket, a cut — that does more brand recognition work than most logos.'
    ),
  },
  {
    id: 'imagery.texture',
    name: 'Texture & pattern',
    section: 5,
    requires: ['colour.palette'],
    machine: 'M4',
    storage: 'project',
    produces: obj({ description: str(), usage: str(), misuse: arr(str()) }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['imagery.texture'],
      frequency: 3,
      sectors: 3,
      wheeler: false,
      note: 'One of the eleven found by checking real books. MemorialCare gives it its own misuse rules.',
    },
    render: renderAuthored(
      'imagery.texture',
      'Texture & pattern',
      'Texture',
      'Not defined yet. Where pattern is used, at what scale, and where it must not go.'
    ),
  },
  {
    id: 'imagery.iconography',
    name: 'Iconography grid & stroke',
    section: 5,
    requires: [],
    machine: 'M2',
    storage: 'project',
    produces: obj(
      {
        gridPx: num('Icon canvas, e.g. 24'),
        strokeWidth: num(),
        cornerRadius: num(),
        terminals: str('butt | round | square'),
      },
      ['gridPx', 'strokeWidth']
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['imagery.iconography'],
      frequency: 6,
      sectors: 3,
      wheeler: false,
      note: 'Computable and validatable: an icon either sits on the grid at the declared stroke or it does not.',
    },
    render: renderDerived<{ gridPx: number; strokeWidth: number; cornerRadius?: number }>(
      'imagery.iconography',
      'Iconography grid & stroke',
      'measured',
      'Not defined yet. A canvas size and a stroke width are enough to make every future icon checkable.',
      (d) => [
        { label: 'Grid', value: `${d.gridPx} × ${d.gridPx}px` },
        { label: 'Stroke', value: `${d.strokeWidth}px` },
        ...(d.cornerRadius !== undefined
          ? [{ label: 'Corner radius', value: `${d.cornerRadius}px` }]
          : []),
      ]
    ),
  },
  {
    id: 'imagery.icon-states',
    name: 'Icon states',
    section: 5,
    requires: ['imagery.iconography', 'colour.palette'],
    machine: 'M2',
    storage: 'project',
    produces: obj({ styles: arr(str('outline | filled | duotone')), stateColours: obj({}) }),
    evidence: 'declared',
    provenance: {
      origin: 'proposed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Mine, split out of iconography. Not observed. Low provenance — fold back into imagery.iconography if §5 needs trimming.',
    },
    render: renderAuthored(
      'imagery.icon-states',
      'Icon states',
      'States',
      'Not defined yet. Which icon styles exist, and which colour role each state takes.'
    ),
  },
  {
    id: 'imagery.pictograms',
    name: 'Pictograms',
    section: 5,
    requires: [],
    machine: 'M2',
    storage: 'project',
    produces: obj({ gridPx: num(), strokeWidth: num(), distinctFromIcons: str() }),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'One of the eleven found by checking real books: IBM keeps pictograms and UI icons on separate grids with separate optical rules. Observed as a distinct section there, but not recorded as its own id in the 25-book sample, so its frequency is genuinely 0 rather than low.',
    },
    render: renderDerived<{ gridPx: number; strokeWidth: number }>(
      'imagery.pictograms',
      'Pictograms',
      'measured',
      'Not defined yet. Pictograms carry a different optical grid from UI icons — IBM ships two libraries for a reason.',
      (d) => [
        { label: 'Grid', value: `${d.gridPx} × ${d.gridPx}px` },
        { label: 'Stroke', value: `${d.strokeWidth}px` },
      ]
    ),
  },
  {
    id: 'imagery.dataviz',
    name: 'Data visualisation system',
    section: 5,
    requires: ['colour.palette'],
    machine: 'M2',
    storage: 'project',
    produces: obj({ chartTypes: arr(str()), axisRules: str(), annotationRules: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['dataviz'],
      frequency: 1,
      sectors: 1,
      wheeler: false,
      note: 'A bet, not table stakes. 1 of 25 — an earlier draft called this the biggest miss in the taxonomy on the strength of a tech-heavy sample, and widening the sample did not support that. Kept because it is ground the colour engine already owns. The observation is shared in spirit with web.dataviz-palettes but is counted only here, so one sighting is never read as two.',
    },
    render: renderAuthored(
      'imagery.dataviz',
      'Data visualisation system',
      'Rules',
      'Not defined yet. Chart types, axis treatment and annotation — the part of a brand nobody specifies and everyone violates.'
    ),
  },
  {
    id: 'motion.easing',
    name: 'Motion: easing & duration',
    section: 5,
    requires: [],
    machine: 'M2',
    storage: 'project',
    produces: obj({
      durations: arr(obj({ token: str(), ms: num() }, ['token', 'ms'])),
      easings: arr(obj({ token: str(), curve: str('cubic-bezier(...)') }, ['token', 'curve'])),
    }),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['motion.animation'],
      frequency: 2,
      sectors: 1,
      wheeler: true,
      note: 'Shares its observation with motion.logo in spirit; counted only here.',
    },
    render: renderDerived<{
      durations?: readonly { token: string; ms: number }[];
      easings?: readonly { token: string; curve: string }[];
    }>(
      'motion.easing',
      'Motion: easing & duration',
      'measured',
      'Not defined yet. A duration ladder and two or three curves are all a motion system needs to be consistent.',
      (d) => [
        ...(d.durations ?? []).map((x) => ({ label: x.token, value: `${x.ms}ms` })),
        ...(d.easings ?? []).map((x) => ({ label: x.token, value: x.curve })),
      ]
    ),
  },
  {
    id: 'motion.logo',
    name: 'Logo animation',
    section: 5,
    requires: ['logo.primary'],
    machine: 'M2',
    storage: 'project',
    produces: obj({ assetId: str(), durationMs: num(), rules: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
    },
    render: renderAuthored(
      'motion.logo',
      'Logo animation',
      'Animation',
      'Not defined yet. Needs a mark first.'
    ),
  },
  {
    id: 'motion.video',
    name: 'Film & video',
    section: 5,
    requires: [],
    machine: 'M4',
    storage: 'project',
    produces: obj({ direction: str(), titleTreatment: str(), endcard: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['motion.video'],
      frequency: 2,
      sectors: 2,
      wheeler: false,
      note: 'Observed in 2 books, but had no row in the spec’s taxonomy — §5 covered motion tokens and logo animation and stopped. Placed here.',
    },
    render: renderAuthored(
      'motion.video',
      'Film & video',
      'Direction',
      'Not set yet. Title treatment, pacing and how a film ends on the mark.'
    ),
  },
  {
    id: 'sound.sonic',
    name: 'Sonic identity',
    section: 5,
    requires: [],
    machine: 'M4',
    storage: 'project',
    produces: obj({ assetId: str(), description: str(), usage: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'derived',
      observedAs: ['sound.sonic'],
      frequency: 0,
      sectors: 0,
      wheeler: true,
      note: 'Prescribed by Wheeler and named a distinctive asset by Romaniuk, and shipped by none of the 25. One of five components in that position — the others are all governance.',
    },
    render: renderAuthored(
      'sound.sonic',
      'Sonic identity',
      'Sound',
      'Not defined yet. A brand that appears in video, on hold or in an app has a sound whether it chose one or not.'
    ),
  },
];
