/**
 * §8 Physical collateral — machine M5, Template & Compose.
 *
 * Deliberately deferred, and said out loud rather than silently carried. It is
 * the furthest from the engine, the heaviest to do well, and it does not
 * compound — nothing else gets cheaper once it exists.
 *
 * The frequency study made that call easier and one part of it harder.
 * `collateral.packaging` measures 1 of 25 even after retail, DTC and food were
 * added to the sample, which suggests packaging specifications usually live in
 * a separate document from the brand book. But three components here —
 * vehicles, uniforms and product design — were observed in real books and had
 * no row in the taxonomy at all, and vehicles and uniforms are not rare: NASA
 * gives both their own sections.
 *
 * One caveat travels with every number in this section. The sample cannot see
 * luxury, fashion or beauty books, which are precisely where materials,
 * finishes and print craft run deepest — and this product has no component for
 * those at all. If the customer turns out to be a luxury house, §8 stops being
 * a late phase and becomes the product.
 */

import { absent, arr, finding, num, obj, present, renderAuthored, str } from '../block';
import { auditContrast } from '@/lib/color-engine';
import { PRINT_FLOOR_PT, signSizes, stationerySpecs, underPrintFloor } from '../collateral';
import { hasPalette, systemRoles } from '../colour';
import type { BookEntry, BrandComponent, ComponentId, Finding } from '../types';

const NO_SYSTEM = 'No colours or typeface yet. A stationery spec is the format, the ladder and the ink — all three come from the system.';

const CORE: readonly ComponentId[] = ['logo.primary', 'colour.palette', 'type.families'];

export const SECTION_8: readonly BrandComponent[] = [
  {
    id: 'collateral.stationery',
    name: 'Stationery',
    section: 8,
    // The palette and the typeface, not the logo. A dimensioned spec — format,
    // ladder, ink, licence — is complete without a mark, and requiring one
    // would keep the whole of §8 dark for the visitor this product is for.
    requires: ['colour.palette', 'type.families'],
    machine: 'M5',
    storage: 'system',
    produces: arr(
      obj({ item: str(), widthMm: num(), heightMm: num(), standard: str() }, ['item'])
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.stationery'],
      frequency: 4,
      sectors: 4,
      wheeler: true,
      note: 'IRBA dimensions its card page precisely — 100×50mm, 3mm margin, mark at 12.5mm, name in Gotham Bold 7pt on 8.4pt. That is what §8 should produce: the format from the standard that defines it, and the brand\u2019s own ladder converted to the units a printer works in. Margins and mark size are NOT stated, because no standard sets them and inventing one would present a guess with the confidence of ISO 216.',
    },
    render: (state) => {
      // The palette is the gate, not the spec list — `stationerySpecs` always
      // returns three formats because ISO does, so checking its length would
      // have handed a visitor with nothing a fully specified card and a
      // finding about its smallest rung.
      if (!hasPalette(state.system)) {
        return absent('collateral.stationery', 'Stationery', NO_SYSTEM);
      }
      const specs = stationerySpecs(state);

      const entries: BookEntry[] = specs.map((spec) => ({
        label: spec.format.name,
        value: `${spec.format.widthMm} × ${spec.format.heightMm} mm`,
        evidence: 'cited',
        note: spec.format.standard,
      }));

      const ladder = specs[0]!.ladder;
      entries.push({
        label: 'The ladder, for print',
        value: ladder.map((r) => `${r.token} ${r.pt}pt`).join(' · '),
        note: `The same scale §4 states in rem, converted at 72 points to the inch — nobody sets a card in rem, and the conversion is where the mistake gets made. In millimetres: ${ladder
          .map((r) => `${r.token} ${r.mm}`)
          .join(' · ')}.`,
      });

      const under = underPrintFloor(ladder);
      entries.push({
        label: 'Smallest usable size',
        value:
          under.length === 0
            ? `Every rung clears ${PRINT_FLOOR_PT}pt`
            : `${under.map((r) => `${r.token} ${r.pt}pt`).join(', ')} — under ${PRINT_FLOOR_PT}pt`,
        evidence: 'declared',
        note: `A practitioner floor, not a standard: no ISO minimum exists for body text on a card. Below roughly ${PRINT_FLOOR_PT}pt, print stops being comfortable regardless of the face.`,
      });

      entries.push({
        label: 'Ink on ground',
        value: `${specs[0]!.ink.toUpperCase()} on ${specs[0]!.ground.toUpperCase()}`,
        note: 'The text and background roles, as §3 assigns them.',
      });

      if (specs[0]!.printLicence !== undefined) {
        const licence = specs[0]!.printLicence!;
        entries.push({
          label: 'Licence for print',
          value: licence.allowed ? `${licence.name} permits print` : `${licence.name} does NOT permit print`,
          evidence: 'cited',
          note: licence.allowed
            ? 'The body face can go on paper under its own terms.'
            : 'The body face cannot be printed under its own licence — a separate grant is needed before any of this is produced.',
        });
      }

      entries.push({
        label: 'Not stated here',
        value: 'Margins · mark size · grid',
        note: 'Design decisions with no standard behind them — IRBA uses a 3mm margin on a 50mm edge and another manual uses something else. Yours to declare; this book will not guess and then print the guess beside ISO 216.',
      });

      return present('collateral.stationery', 'Stationery', 'measured', entries);
    },
    validate: (state): readonly Finding[] => {
      if (!hasPalette(state.system)) return [];
      const under = underPrintFloor(stationerySpecs(state)[0]!.ladder);
      if (under.length === 0) return [];
      const worst = under.reduce((a, b) => (b.pt < a.pt ? b : a));
      return [
        finding(
          'collateral.stationery',
          // Warn: the floor is practitioner guidance, not a conformance
          // criterion, and this book does not invent standards.
          'warn',
          `${under.length} rung${under.length > 1 ? 's' : ''} of the scale set below the print floor, smallest ${worst.token}.`,
          { measured: `${worst.pt}pt`, expected: `≥ ${PRINT_FLOOR_PT}pt` }
        ),
      ];
    },
  },
  {
    id: 'collateral.packaging',
    name: 'Packaging & dielines',
    section: 8,
    requires: CORE,
    machine: 'M5',
    storage: 'project',
    produces: arr(obj({ format: str(), dielineUrl: str(), materials: str() }, ['format'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.packaging'],
      frequency: 1,
      sectors: 1,
      wheeler: true,
      note: 'Still 1 of 25 after retail, DTC and food were added to the sample. The likeliest reading is that packaging specs live in their own document rather than the brand book — not that brands do not specify packaging.',
    },
    render: renderAuthored(
      'collateral.packaging',
      'Packaging & dielines',
      'Formats',
      'Not specified yet. Deferred deliberately — the furthest from the engine and the heaviest to do well.'
    ),
  },
  {
    id: 'collateral.swag',
    name: 'Swag & apparel',
    section: 8,
    requires: ['logo.primary'],
    machine: 'M5',
    storage: 'project',
    produces: arr(obj({ item: str(), markVariant: str(), method: str('embroidery | print') }, ['item'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.swag'],
      frequency: 3,
      sectors: 3,
      wheeler: true,
    },
    render: renderAuthored(
      'collateral.swag',
      'Swag & apparel',
      'Items',
      'Not specified yet. Which mark variant survives embroidery is a real constraint, not a detail.'
    ),
  },
  {
    id: 'collateral.signage',
    name: 'Signage & wayfinding',
    section: 8,
    // Type and colour, not the logo. Letter height and contrast are what make
    // a sign readable, and neither needs a mark.
    requires: ['colour.palette', 'type.families'],
    machine: 'M5',
    storage: 'system',
    produces: arr(obj({ distanceM: num(), capHeightMm: num() }, ['distanceM', 'capHeightMm'])),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.signage'],
      frequency: 6,
      sectors: 6,
      wheeler: true,
      note: 'One of the eleven found by checking real books: §8 had stationery, packaging and swag and nothing environmental. At 24% across 6 sectors it is the most common component in this section \u2014 and reading distance sets minimum letter height, which makes it one of the few \u00a78 rules that is arithmetic rather than taste.',
    },
    render: (state) => {
      if (!hasPalette(state.system)) {
        return absent('collateral.signage', 'Signage & wayfinding', NO_SYSTEM);
      }
      const roles = systemRoles(state.system);
      const onGround = auditContrast(roles.text.oklch, roles.background.oklch);

      const entries: BookEntry[] = signSizes().map((size) => ({
        label: `Read at ${size.distanceM}m`,
        value: `${size.capHeightMm}mm cap height, minimum`,
      }));

      entries.push({
        label: 'Where that comes from',
        value: 'One inch of cap height per ten feet — 1:120',
        evidence: 'declared',
        note: 'The sign trade\u2019s rule of thumb, not a standard, and every source that publishes it says the same thing: it is a starting point. Typeface, contrast, viewing angle and lighting all move the real answer, so treat these as the floor below which a sign definitely cannot be read rather than a size at which it definitely can.',
      });

      entries.push({
        label: 'Cap height is not font size',
        value: 'Set the size that achieves the height',
        note: 'A face\u2019s capitals are a fraction of its em \u2014 commonly around 0.7, but it is a per-face metric the open catalogue does not carry. So specify the cap height and set the type to reach it; do not read these numbers as point sizes.',
      });

      entries.push({
        label: 'Contrast on the ground',
        value: `${onGround.ratio.toFixed(2)}:1`,
        evidence: 'measured',
        note: onGround.normalText.aa
          ? 'Text on background, measured. The distance rule assumes strong contrast; this pairing has it.'
          : 'Text on background, measured \u2014 and below AA. Every letter-height figure above assumes contrast the sign does not have, so treat them as optimistic.',
      });

      return present('collateral.signage', 'Signage & wayfinding', 'measured', entries);
    },
  },
  {
    id: 'collateral.vehicles',
    name: 'Vehicle livery',
    section: 8,
    requires: ['logo.primary'],
    machine: 'M5',
    storage: 'project',
    produces: arr(obj({ vehicle: str(), placement: str(), assetId: str() }, ['vehicle'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.vehicles'],
      frequency: 3,
      sectors: 3,
      wheeler: true,
      note: 'Observed in 3 books and prescribed by Wheeler, but had no row in the spec’s taxonomy — it appeared only inside a note on the signage row. Placed here.',
    },
    render: renderAuthored(
      'collateral.vehicles',
      'Vehicle livery',
      'Livery',
      'Not specified yet. Placement and scale of the mark on a moving, curved surface.'
    ),
  },
  {
    id: 'collateral.uniforms',
    name: 'Uniforms',
    section: 8,
    requires: ['logo.primary'],
    machine: 'M5',
    storage: 'project',
    produces: arr(obj({ role: str(), garment: str(), markVariant: str() }, ['role'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.uniforms'],
      frequency: 4,
      sectors: 4,
      wheeler: true,
      note: 'Observed in 4 books and prescribed by Wheeler, but had no row in the spec’s taxonomy. Placed here.',
    },
    render: renderAuthored(
      'collateral.uniforms',
      'Uniforms',
      'Uniforms',
      'Not specified yet. Which garment, which mark variant, and what the badge does at that size.'
    ),
  },
  {
    id: 'collateral.product-design',
    name: 'Product design',
    section: 8,
    requires: ['logo.primary', 'colour.palette'],
    machine: 'M5',
    storage: 'project',
    produces: obj({ materials: str(), finishes: str(), markApplication: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.product-design'],
      frequency: 1,
      sectors: 1,
      wheeler: true,
      note: 'Observed once and prescribed by Wheeler, but had no row in the spec’s taxonomy. Placed here. This is the component nearest to the materials-and-finishes gap the sample cannot see.',
    },
    render: renderAuthored(
      'collateral.product-design',
      'Product design',
      'Materials',
      'Not specified yet. Materials, finishes and how the mark is applied to a physical object.'
    ),
  },
];
