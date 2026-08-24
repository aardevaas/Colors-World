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

import { arr, obj, renderAuthored, str } from '../block';
import type { BrandComponent, ComponentId } from '../types';

const CORE: readonly ComponentId[] = ['logo.primary', 'colour.palette', 'type.families'];

export const SECTION_8: readonly BrandComponent[] = [
  {
    id: 'collateral.stationery',
    name: 'Stationery',
    section: 8,
    requires: CORE,
    machine: 'M5',
    storage: 'project',
    produces: arr(obj({ item: str(), sizeMm: str(), stock: str() }, ['item'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.stationery'],
      frequency: 4,
      sectors: 4,
      wheeler: true,
    },
    render: renderAuthored(
      'collateral.stationery',
      'Stationery',
      'Items',
      'Not specified yet. Business card, letterhead, compliment slip — sizes, stock and where the mark sits.'
    ),
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
    requires: ['logo.primary', 'type.families'],
    machine: 'M5',
    storage: 'project',
    produces: arr(obj({ type: str(), material: str(), minimumHeightMm: str() }, ['type'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['collateral.signage'],
      frequency: 6,
      sectors: 6,
      wheeler: true,
      note: 'One of the eleven found by checking real books: §8 had stationery, packaging and swag and nothing environmental. At 24% across 6 sectors it is the most common component in this section.',
    },
    render: renderAuthored(
      'collateral.signage',
      'Signage & wayfinding',
      'Signage',
      'Not specified yet. Reading distance sets minimum letter height — this is one of the few §8 rules that is computable.'
    ),
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
