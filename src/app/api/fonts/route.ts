import { NextResponse } from 'next/server';
import {
  CATALOGUE_FETCHED,
  CATALOGUE_SIZE,
  bulkCssUrl,
  cssUrl,
  get,
  fontStack,
  licenceOf,
  list,
  type FontCategory,
} from '@/lib/typography/font-catalogue';

/**
 * Search the font catalogue — server-side, on purpose.
 *
 * The snapshot is ~385KB. Shipping it to the browser so someone can look at
 * three families would cost more than the entire rest of the page: /typography
 * is 8.5KB. So the catalogue stays here and the room asks it questions.
 *
 * This route reads a committed JSON file and holds no secrets, no user data and
 * no writes. Every parameter is bounded before use, because a query string is
 * the one input that arrives unvalidatable.
 */

/** Enough to fill a scrolling list, few enough that a response stays small. */
const MAX_LIMIT = 60;
const DEFAULT_LIMIT = 40;

const CATEGORIES: readonly FontCategory[] = [
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
  'icons',
  'other',
];

/** A search term long enough to be one, short enough not to be an attack. */
const MAX_SEARCH = 60;

function clampLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function parseWeights(raw: string | null): readonly number[] | undefined {
  if (raw === null || raw === '') return undefined;
  const weights = raw
    .split(',')
    .map((w) => Number.parseInt(w, 10))
    .filter((w) => Number.isFinite(w) && w >= 100 && w <= 900);
  return weights.length > 0 ? weights : undefined;
}

/** At most three roles are ever resolved at once — display, body, mono. */
const MAX_IDS = 8;

export function GET(request: Request): NextResponse {
  const params = new URL(request.url).searchParams;

  /*
   * `ids` resolves specific slugs rather than searching. A shared link carries
   * only slugs, so the room needs a way to turn the three it was given back
   * into stacks and a stylesheet without holding the catalogue itself.
   */
  const rawIds = params.get('ids');
  if (rawIds !== null && rawIds !== '') {
    const wanted = rawIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => /^[a-z0-9-]{1,60}$/.test(id))
      .slice(0, MAX_IDS);
    const found = wanted.map((id) => get(id)).filter((f) => f !== null);
    return NextResponse.json({
      catalogue: { size: CATALOGUE_SIZE, fetched: CATALOGUE_FETCHED },
      count: found.length,
      stylesheet: bulkCssUrl(found.map((f) => f.id)),
      families: found.map((font) => {
        const licence = licenceOf(font.id);
        return {
          id: font.id,
          family: font.family,
          category: font.category,
          weights: font.weights,
          variable: font.variable,
          licence: licence === null ? null : { name: licence.name, id: licence.id },
          css: cssUrl(font.id),
          stack: fontStack(font.id),
        };
      }),
    });
  }

  const rawCategory = params.get('category');
  const category = CATEGORIES.find((c) => c === rawCategory);

  const families = list({
    search: params.get('q')?.slice(0, MAX_SEARCH) ?? undefined,
    category,
    variableOnly: params.get('variable') === '1',
    weights: parseWeights(params.get('weights')),
    limit: clampLimit(params.get('limit')),
  });

  return NextResponse.json({
    catalogue: { size: CATALOGUE_SIZE, fetched: CATALOGUE_FETCHED },
    count: families.length,
    // One stylesheet for every family in this response, at the regular cut.
    // Forty separate requests per keystroke is not a search box.
    stylesheet: bulkCssUrl(families.map((f) => f.id)),
    families: families.map((font) => {
      const licence = licenceOf(font.id);
      return {
        id: font.id,
        family: font.family,
        category: font.category,
        weights: font.weights,
        variable: font.variable,
        // Resolved here so the room never has to carry the licence table
        // either — it renders what it is given.
        licence: licence === null ? null : { name: licence.name, id: licence.id },
        // The stylesheet and the stack come from the server too, for the same
        // reason: the browser should not need the catalogue to use a font from
        // it. Bunny by default, so a preview makes no request to Google.
        css: cssUrl(font.id),
        stack: fontStack(font.id),
      };
    }),
  });
}
