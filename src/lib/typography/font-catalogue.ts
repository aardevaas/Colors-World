/**
 * The font catalogue — `list · get · cssUrl · licence`.
 *
 * Four operations, kept separate on purpose, because **the catalogue, the
 * ranking and the delivery host are three independent choices** and collapsing
 * them is how a product ends up unable to change any one of them.
 *
 * ## Why Fontsource, and why not "all of them"
 *
 * Measured, not assumed: of the 2,096 families Fontsource carries, **1,976 are
 * Google faces**. Bunny serves 1,967. They are substantially the SAME CORPUS,
 * so stacking three sources adds almost no families. Integrate for facets:
 *
 * - **Fontsource** — the catalogue, and the only one carrying a per-family
 *   LICENCE, which is the thing §4 of a brand guideline actually needs.
 * - **Bunny** — a delivery host that makes no request to Google from the
 *   visitor's browser. That is a GDPR question for European clients, not a
 *   performance one.
 * - **Google** — popularity ranking, which Fontsource does not have. Needs an
 *   API key and 403s without one, so it is not wired here.
 *
 * `cssUrl` takes the host as an argument precisely so this stays a choice.
 *
 * ## Why the catalogue is baked
 *
 * `scripts/refresh-fontsource.mjs` writes the snapshot this module reads. The
 * registry's `type.licensing` is a pure renderer and cannot await a fetch; the
 * test suite must not depend on a third-party API being up; and the product
 * should work on a cold start with no upstream call. The cost is staleness,
 * and the script is how that gets paid down.
 *
 * ## KEEP THIS OUT OF THE CLIENT BUNDLE
 *
 * The snapshot is ~385KB of JSON. It costs nothing today because everything
 * importing it renders on the server, and the production build confirms it: no
 * route's First Load JS moved when this landed.
 *
 * That is a property to preserve, not a coincidence. The brand registry is pure
 * data and pure functions returning plain objects precisely so the Book can be
 * a SERVER component — the moment a client component imports the registry, this
 * file rides along with it. If the Book ever needs the catalogue in the
 * browser, give it a route handler that searches server-side and returns the
 * handful of matches, rather than shipping two thousand families to look at
 * three.
 */

import snapshot from './fontsource-catalogue.json';
import { licenceFor, type FontLicence } from './font-licences';

/** Where the CSS is served from. A delivery choice, not a catalogue one. */
export type DeliveryHost = 'fontsource' | 'bunny' | 'google';

export type FontCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'handwriting'
  | 'monospace'
  | 'icons'
  | 'other';

export interface FontFamily {
  /** Fontsource's slug — `plus-jakarta-sans`. The key for every lookup. */
  readonly id: string;
  /** The name a guideline prints — `Plus Jakarta Sans`. */
  readonly family: string;
  readonly weights: readonly number[];
  readonly styles: readonly string[];
  /** A variable font carries its weights on an axis rather than as cuts. */
  readonly variable: boolean;
  readonly category: FontCategory;
  /** SPDX-ish identifier. Resolve it with `licenceOf` rather than reading it. */
  readonly license: string;
  /** `google` for the ~94% mirrored from Google Fonts, `other` for the rest. */
  readonly type: string;
  readonly defSubset: string;
}

interface Snapshot {
  readonly source: string;
  readonly fetched: string;
  readonly count: number;
  readonly families: readonly FontFamily[];
}

const CATALOGUE = snapshot as Snapshot;
const BY_ID = new Map(CATALOGUE.families.map((f) => [f.id, f]));

/** When the snapshot was taken, so a guideline can say how current it is. */
export const CATALOGUE_FETCHED = CATALOGUE.fetched;
export const CATALOGUE_SIZE = CATALOGUE.families.length;

export interface ListQuery {
  /** Case-insensitive substring match on the family name. */
  readonly search?: string;
  readonly category?: FontCategory;
  /** Only families that carry their weights on an axis. */
  readonly variableOnly?: boolean;
  /** Only families offering every one of these weights as a real cut. */
  readonly weights?: readonly number[];
  readonly limit?: number;
}

/**
 * Families matching a query, in alphabetical order.
 *
 * Alphabetical rather than by popularity because **we do not have popularity
 * data** — that is Google's facet and it needs a key. Ordering by something we
 * cannot measure, and calling it "recommended", is exactly the folklore this
 * product labels rather than ships.
 */
export function list(query: ListQuery = {}): readonly FontFamily[] {
  const needle = query.search?.trim().toLowerCase();
  const out: FontFamily[] = [];
  const limit = query.limit ?? Number.POSITIVE_INFINITY;

  for (const font of CATALOGUE.families) {
    if (out.length >= limit) break;
    if (needle !== undefined && needle !== '' && !font.family.toLowerCase().includes(needle)) continue;
    if (query.category !== undefined && font.category !== query.category) continue;
    if (query.variableOnly === true && !font.variable) continue;
    if (query.weights !== undefined && !query.weights.every((w) => font.weights.includes(w))) continue;
    out.push(font);
  }
  return out;
}

export function get(id: string): FontFamily | null {
  return BY_ID.get(id) ?? null;
}

/** Look a family up by its printed name rather than its slug. */
export function getByFamily(family: string): FontFamily | null {
  const needle = family.trim().toLowerCase();
  return CATALOGUE.families.find((f) => f.family.toLowerCase() === needle) ?? null;
}

/**
 * The licence facts for a family, or null when the family is unknown or its
 * licence is one we have not checked.
 *
 * Null rather than a permissive default: a guideline that says "not recorded"
 * is more useful than one that says "fine" and is wrong.
 */
export function licenceOf(id: string): FontLicence | null {
  const font = get(id);
  return font === null ? null : licenceFor(font.license);
}

export interface CssUrlOptions {
  readonly host?: DeliveryHost;
  readonly weights?: readonly number[];
  readonly display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
}

/**
 * Where to fetch a family's CSS from.
 *
 * Defaults to Bunny. A European client asking "does your site call Google" has
 * a real question behind it, and defaulting to the answer that needs no
 * explanation costs nothing — the corpus is the same either way.
 *
 * `display: swap` by default, so text is readable while the face loads rather
 * than invisible.
 */
export function cssUrl(id: string, options: CssUrlOptions = {}): string | null {
  const font = get(id);
  if (font === null) return null;

  const host = options.host ?? 'bunny';
  const display = options.display ?? 'swap';
  const weights = options.weights?.filter((w) => font.weights.includes(w)) ?? font.weights;
  const chosen = weights.length > 0 ? weights : font.weights;

  if (host === 'fontsource') {
    // Fontsource serves whole families; weight selection happens at import.
    return `https://cdn.jsdelivr.net/fontsource/css/${font.id}@latest/index.css`;
  }

  const name = font.family.replace(/ /g, '+');
  if (host === 'bunny') {
    return `https://fonts.bunny.net/css?family=${name.toLowerCase().replace(/\+/g, '-')}:${chosen.join(',')}&display=${display}`;
  }
  return `https://fonts.googleapis.com/css2?family=${name}:wght@${chosen.join(';')}&display=${display}`;
}

/**
 * The CSS font stack for a family, fallback included.
 *
 * The fallback is chosen from the family's own category rather than a single
 * generic for everything: a serif that falls back to a sans is a different
 * page, and the whole point of stating a stack is that the failure mode is
 * decided rather than discovered.
 */
export function fontStack(id: string): string | null {
  const font = get(id);
  if (font === null) return null;
  const generic: Record<FontCategory, string> = {
    'sans-serif': 'system-ui, -apple-system, sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    display: 'Georgia, serif',
    handwriting: 'cursive',
    monospace: 'ui-monospace, "SF Mono", monospace',
    icons: 'sans-serif',
    other: 'sans-serif',
  };
  return `"${font.family}", ${generic[font.category]}`;
}

/**
 * One stylesheet covering a whole result set, at a single weight.
 *
 * A picker showing forty families needs forty faces, and forty separate
 * stylesheet requests on every keystroke is not a search box, it is a denial of
 * service you inflict on yourself. Bunny takes families pipe-separated, so the
 * whole page costs one request — and only the regular cut, because a name set
 * once at 400 is a specimen and the other eight weights are not being looked at.
 */
export function bulkCssUrl(ids: readonly string[], weight = 400): string | null {
  const slugs = ids
    .map((id) => get(id))
    .filter((font): font is FontFamily => font !== null)
    .map((font) => {
      // Fall back to the family's nearest available cut rather than dropping it.
      const cut = font.weights.includes(weight) ? weight : (font.weights[0] ?? weight);
      return `${font.id}:${cut}`;
    });
  if (slugs.length === 0) return null;
  return `https://fonts.bunny.net/css?family=${slugs.join('|')}&display=swap`;
}

/** How the catalogue breaks down — used by the guideline to show its own basis. */
export function catalogueStats(): {
  readonly total: number;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly byType: Readonly<Record<string, number>>;
  readonly variable: number;
} {
  const byCategory: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let variable = 0;
  for (const f of CATALOGUE.families) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    byType[f.type] = (byType[f.type] ?? 0) + 1;
    if (f.variable) variable += 1;
  }
  return { total: CATALOGUE.families.length, byCategory, byType, variable };
}
