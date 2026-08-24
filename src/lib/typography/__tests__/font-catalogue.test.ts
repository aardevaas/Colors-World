import { describe, expect, it } from 'vitest';
import {
  CATALOGUE_FETCHED,
  CATALOGUE_SIZE,
  catalogueStats,
  cssUrl,
  fontStack,
  get,
  getByFamily,
  licenceOf,
  list,
} from '../font-catalogue';
import { KNOWN_LICENCES, licenceFor, permissionsFor } from '../font-licences';

describe('the catalogue snapshot', () => {
  it('carries the whole of Fontsource, not a curated slice', () => {
    // The room shipped four hardcoded pairings against this.
    expect(CATALOGUE_SIZE).toBeGreaterThan(2000);
  });

  it('records when it was taken, so a guideline can say how current it is', () => {
    expect(CATALOGUE_FETCHED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is overwhelmingly the same corpus Google serves', () => {
    /*
     * The measurement behind "do not integrate three font sources for
     * coverage". If this ever drops sharply, the case for adding Bunny or
     * Google as CATALOGUES rather than as delivery hosts is worth re-opening.
     */
    const { byType, total } = catalogueStats();
    expect((byType.google ?? 0) / total).toBeGreaterThan(0.9);
  });
});

describe('every licence in the catalogue is one we have actually checked', () => {
  /*
   * THE drift guard. `licenceOf` returns null for a licence we have not
   * recorded, and null renders as "not recorded" — which is honest but
   * useless. Refreshing the snapshot must therefore fail here the moment
   * Fontsource carries a licence this product cannot describe, rather than
   * quietly degrading a section of the guideline to a shrug.
   */
  it('leaves no family whose licence we cannot describe', () => {
    const unknown = new Set<string>();
    for (const font of list()) {
      if (licenceFor(font.license) === null) unknown.add(font.license);
    }
    expect([...unknown]).toEqual([]);
  });

  it('states all four permissions for every licence it knows', () => {
    for (const id of KNOWN_LICENCES) {
      const licence = licenceFor(id);
      expect(licence, id).not.toBeNull();
      const uses = permissionsFor(licence!).map((p) => p.use);
      expect(uses).toEqual(['Web embedding', 'Print', 'Bundled in a product', 'Sold on its own']);
      expect(licence!.name.length, id).toBeGreaterThan(0);
      expect(licence!.url, id).toMatch(/^https:/);
      expect(licence!.note.length, id).toBeGreaterThan(20);
    }
  });

  it('keeps the distinction that catches people out — bundling is not reselling', () => {
    /*
     * A single "commercial use" flag would be wrong in both directions for the
     * licence covering 98% of the catalogue: the OFL lets you ship a font
     * inside something you sell, and forbids selling the font on its own.
     */
    const ofl = licenceFor('OFL-1.1')!;
    expect(ofl.bundleInProduct).toBe(true);
    expect(ofl.sellStandalone).toBe(false);

    const apache = licenceFor('Apache-2.0')!;
    expect(apache.sellStandalone).toBe(true);
    expect(apache.attributionRequired).toBe(true);
  });

  it('returns null for a licence it has not checked rather than assuming the best', () => {
    expect(licenceFor('WTFPL')).toBeNull();
  });
});

describe('list', () => {
  it('matches family names case-insensitively', () => {
    const hits = list({ search: 'jakarta' });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((f) => f.family.toLowerCase().includes('jakarta'))).toBe(true);
  });

  it('filters to a category', () => {
    const mono = list({ category: 'monospace', limit: 40 });
    expect(mono.length).toBeGreaterThan(0);
    expect(mono.every((f) => f.category === 'monospace')).toBe(true);
  });

  it('filters to variable families only', () => {
    const variable = list({ variableOnly: true, limit: 30 });
    expect(variable.length).toBeGreaterThan(0);
    expect(variable.every((f) => f.variable)).toBe(true);
  });

  it('requires every named weight, not just one of them', () => {
    const hits = list({ weights: [300, 700], limit: 25 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((f) => f.weights.includes(300) && f.weights.includes(700))).toBe(true);
  });

  it('honours a limit', () => {
    expect(list({ limit: 7 })).toHaveLength(7);
  });

  it('is alphabetical, because we have no popularity data to sort by', () => {
    const names = list({ limit: 60 }).map((f) => f.family);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('returns everything for an empty query', () => {
    expect(list()).toHaveLength(CATALOGUE_SIZE);
    expect(list({ search: '   ' })).toHaveLength(CATALOGUE_SIZE);
  });
});

describe('get', () => {
  it('resolves a known slug', () => {
    expect(get('plus-jakarta-sans')?.family).toBe('Plus Jakarta Sans');
  });

  it('resolves by printed name too, since that is what a guideline states', () => {
    expect(getByFamily('Plus Jakarta Sans')?.id).toBe('plus-jakarta-sans');
    expect(getByFamily('  plus jakarta sans ')?.id).toBe('plus-jakarta-sans');
  });

  it('is null for something that is not there', () => {
    expect(get('not-a-font')).toBeNull();
    expect(getByFamily('Not A Font')).toBeNull();
    expect(licenceOf('not-a-font')).toBeNull();
  });
});

describe('cssUrl — delivery is a separate choice from the catalogue', () => {
  it('defaults to Bunny, which makes no request to Google from the visitor', () => {
    const url = cssUrl('plus-jakarta-sans')!;
    expect(url).toContain('fonts.bunny.net');
    expect(url).toContain('display=swap');
  });

  it('can serve the identical family from three different hosts', () => {
    const hosts = (['fontsource', 'bunny', 'google'] as const).map((host) =>
      cssUrl('plus-jakarta-sans', { host })
    );
    expect(hosts[0]).toContain('jsdelivr');
    expect(hosts[1]).toContain('bunny');
    expect(hosts[2]).toContain('googleapis');
    expect(new Set(hosts).size).toBe(3);
  });

  it('drops weights the family does not actually have', () => {
    const font = get('plus-jakarta-sans')!;
    const bogus = 123;
    expect(font.weights).not.toContain(bogus);
    const url = cssUrl('plus-jakarta-sans', { host: 'google', weights: [400, bogus] })!;
    expect(url).toContain('400');
    expect(url).not.toContain(String(bogus));
  });

  it('falls back to the family’s own weights when the filter leaves nothing', () => {
    const url = cssUrl('plus-jakarta-sans', { host: 'google', weights: [999] })!;
    expect(url).toMatch(/wght@\d/);
  });

  it('is null for an unknown family rather than a URL that 404s', () => {
    expect(cssUrl('not-a-font')).toBeNull();
  });
});

describe('fontStack', () => {
  it('falls back within the family’s own category, not to one generic', () => {
    /*
     * A serif falling back to a sans is a different page. Stating the stack is
     * only worth doing if the failure mode is decided rather than discovered.
     */
    const serif = list({ category: 'serif', limit: 1 })[0]!;
    const mono = list({ category: 'monospace', limit: 1 })[0]!;
    expect(fontStack(serif.id)).toMatch(/serif$/);
    expect(fontStack(mono.id)).toMatch(/monospace$/);
  });

  it('quotes the family name, since most contain spaces', () => {
    expect(fontStack('plus-jakarta-sans')).toContain('"Plus Jakarta Sans"');
  });

  it('is null for an unknown family', () => {
    expect(fontStack('not-a-font')).toBeNull();
  });
});
