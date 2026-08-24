/**
 * Provenance, recomputed from the research rather than trusted.
 *
 * Version 1 of this taxonomy was transcribed, not researched: 50 of 54
 * components came from one list and 0 were externally validated, and it looked
 * authoritative anyway. `provenance` exists so that cannot happen again — but
 * a hand-typed frequency is exactly as trustworthy as the hand-typed "4.5:1"
 * this product is built to replace.
 *
 * So the numbers written into the registry are read back out of
 * `docs/research/brand-book-sample.json` here and compared. A frequency can
 * never drift from the sample it claims to come from; widening the sample and
 * forgetting to update the registry is a failing test, not a silent lie.
 *
 * The last test in this file is the one that matters most. It asserts that
 * every component the research observed has somewhere to live — which is the
 * check that would have caught `gov.contact` (8 of 25) and `gov.metrics` (the
 * component the entire governance-whitespace argument rests on) being absent
 * from the taxonomy that was about to be turned into a schema.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../registry';

interface SampleBook {
  readonly id: string;
  readonly name: string;
  readonly sector: string;
  readonly depth: string;
  readonly sections: readonly string[];
}

const sample = JSON.parse(
  readFileSync(new URL('../../../../docs/research/brand-book-sample.json', import.meta.url), 'utf8')
) as { books: readonly SampleBook[] };

/** Reference books are a practitioner composite, not an organisation's book. */
const REAL_BOOKS = sample.books.filter((b) => b.sector !== 'reference');
const REFERENCE_SECTIONS = new Set(
  sample.books.filter((b) => b.sector === 'reference').flatMap((b) => b.sections)
);

/** Every research id the sample knows about, real books and reference alike. */
const ALL_SAMPLE_IDS = new Set([
  ...REAL_BOOKS.flatMap((b) => b.sections),
  ...REFERENCE_SECTIONS,
]);

function booksContaining(ids: readonly string[]): readonly SampleBook[] {
  return REAL_BOOKS.filter((b) => ids.some((id) => b.sections.includes(id)));
}

describe('the sample is the one the registry was built from', () => {
  it('is 25 real books across 13 sectors', () => {
    expect(REAL_BOOKS).toHaveLength(25);
    expect(new Set(REAL_BOOKS.map((b) => b.sector)).size).toBe(13);
  });
});

describe('every recorded frequency is the sample’s, not a typo', () => {
  it.each(REGISTRY.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const books = booksContaining(c.provenance.observedAs);
    expect(c.provenance.frequency).toBe(books.length);
    expect(c.provenance.sectors).toBe(new Set(books.map((b) => b.sector)).size);
  });
});

describe('every Wheeler flag is the reference book’s, not an opinion', () => {
  it.each(REGISTRY.map((c) => [c.id, c] as const))('%s', (_id, c) => {
    const prescribed = c.provenance.observedAs.some((id) => REFERENCE_SECTIONS.has(id));
    expect(c.provenance.wheeler).toBe(prescribed);
  });
});

describe('provenance cannot claim evidence it does not have', () => {
  it('gives a frequency above zero only to components with an observation', () => {
    for (const c of REGISTRY) {
      if (c.provenance.frequency > 0) {
        expect(c.provenance.observedAs.length, c.id).toBeGreaterThan(0);
      }
    }
  });

  it('names a research id for every component claiming to be observed', () => {
    for (const c of REGISTRY) {
      if (c.provenance.origin === 'observed' && c.provenance.frequency > 0) {
        expect(c.provenance.observedAs.length, c.id).toBeGreaterThan(0);
      }
    }
  });

  it('only cites research ids the sample actually contains', () => {
    for (const c of REGISTRY) {
      for (const id of c.provenance.observedAs) {
        expect(ALL_SAMPLE_IDS.has(id), `${c.id} cites "${id}", which is not in the sample`).toBe(
          true
        );
      }
    }
  });

  it('marks an observation shared between components as shared', () => {
    const homes = new Map<string, string[]>();
    for (const c of REGISTRY) {
      for (const id of c.provenance.observedAs) {
        homes.set(id, [...(homes.get(id) ?? []), c.id]);
      }
    }
    for (const [researchId, owners] of homes) {
      if (owners.length > 1) {
        for (const owner of owners) {
          const c = REGISTRY.find((x) => x.id === owner)!;
          expect(
            c.provenance.sharedObservation,
            `${owner} shares "${researchId}" with ${owners.filter((o) => o !== owner).join(', ')} but does not say so`
          ).toBe(true);
        }
      }
    }
  });
});

describe('nothing the research found is homeless', () => {
  /*
   * The regression this file exists for. Thirteen ids were observed in real
   * brand books and had no row in the taxonomy — the same failure that grew
   * the list by 20% the first time anyone checked. Widening the sample must
   * fail here rather than quietly dropping components on the floor.
   */
  it('houses every component id the sample records', () => {
    const housed = new Set(REGISTRY.flatMap((c) => c.provenance.observedAs));
    const homeless = [...ALL_SAMPLE_IDS].filter((id) => !housed.has(id)).sort();
    expect(homeless).toEqual([]);
  });

  it('reproduces the three CORE components at the frequencies measured', () => {
    const core = REGISTRY.filter((c) => c.provenance.frequency >= 18).map((c) => [
      c.id,
      c.provenance.frequency,
    ]);
    expect(core).toEqual([
      ['logo.primary', 22],
      ['colour.palette', 18],
      ['type.families', 20],
    ]);
  });

  it('keeps the governance whitespace at zero across all four components', () => {
    for (const id of ['gov.metrics', 'gov.taxonomy', 'gov.version-changelog', 'gov.launch']) {
      const c = REGISTRY.find((x) => x.id === id)!;
      expect(c.provenance.frequency, id).toBe(0);
      expect(c.provenance.wheeler, id).toBe(true);
    }
  });
});
