/**
 * Which of the guideline a given reader is shown.
 *
 * One renderer, filtered — never a second renderer. That is the whole design
 * decision behind this file, and it is worth stating plainly because the
 * obvious alternative is so much easier to start and so much worse to own: a
 * separate "export" or "public" template that renders the same components a
 * second time. Two renderers diverge. They always diverge, and they diverge
 * silently, because nobody diffs a PDF against a web page. **Every view here
 * is the internal document with things DELETED from it**, so a view cannot
 * state anything the internal document does not, and a component added to the
 * registry appears in all of them or none.
 *
 * ## What exists now
 *
 * `hideUnset` — the export-time trim. The internal document deliberately shows
 * what is missing: a block saying "no mark uploaded yet" is a to-do list the
 * reader can act on, which is why not-set blocks stay visible and quiet rather
 * than being hidden or counted. But a guideline being *handed to someone* is a
 * different act from a guideline being *worked on*, and eleven blocks
 * explaining what has not been decided yet is not what you send. So it is a
 * choice, made at the moment of export, and it lives in the URL rather than in
 * component state — which is what makes it survive into the printed PDF, since
 * the page is rendered on the server and print sees exactly what the server
 * sent.
 *
 * ## What plugs in next
 *
 * `audience`. The commercial book — the one for people outside the company —
 * is this same document with the internals deleted: findings, not-set blocks,
 * exception routes and approval state. It is a case in `visibleBlocks` and a
 * sibling function for findings, not a new template. It is declared as a type
 * here and deliberately has exactly one member today: the shape is settled so
 * that adding it later is a switch case rather than a refactor, and shipping
 * an unreviewed commercial book early is not a favour to anyone.
 */

import type { BookBlock } from './types';

/**
 * Who the document is being rendered for.
 *
 * One member on purpose — see the module note. `'commercial'` joins it after
 * the September launch, and when it does, every rule about what it deletes
 * belongs in this file.
 */
export type BookAudience = 'internal';

export interface BookView {
  readonly audience: BookAudience;
  /** Drop blocks that have nothing in them yet. An export choice, not a mode. */
  readonly hideUnset: boolean;
}

/**
 * The query parameter carrying the view.
 *
 * `hide`, not one of the codec's own keys. The System owns `c a r t m sg s f`,
 * and this has to be a parameter the codec ignores and `encodeSystem` never
 * writes — so a shared link hands over the whole internal guideline, and
 * trimming it stays a decision the person exporting makes each time rather
 * than one that rides along invisibly with the palette.
 */
export const BOOK_VIEW_PARAM = 'hide';

const HIDE_UNSET = 'unset';

/** The document as a whole, for the person building it. */
export const DEFAULT_BOOK_VIEW: BookView = { audience: 'internal', hideUnset: false };

/**
 * Read the view out of a query string.
 *
 * Anything unrecognised falls back to showing everything. A URL is the one
 * input nobody validates before it arrives, and the failure that matters is
 * asymmetric: showing a block that could have been trimmed is a tidiness
 * problem, while hiding one because of a typo is a guideline quietly missing a
 * rule.
 */
export function parseBookView(params: URLSearchParams): BookView {
  return {
    audience: 'internal',
    hideUnset: params.get(BOOK_VIEW_PARAM) === HIDE_UNSET,
  };
}

/**
 * The query string for a view, keeping whatever System it is handed.
 *
 * The toggle is a link rather than a button because the Book is a server
 * component: a click has to be a navigation for the document to be rebuilt,
 * and a link is also the version that works before any JavaScript arrives and
 * that a person can bookmark.
 */
export function viewQuery(view: BookView, systemQuery = ''): string {
  const params = new URLSearchParams(systemQuery);
  if (view.hideUnset) params.set(BOOK_VIEW_PARAM, HIDE_UNSET);
  else params.delete(BOOK_VIEW_PARAM);
  return params.toString();
}

/** The blocks this view shows, in the order the registry produced them. */
export function visibleBlocks(
  blocks: readonly BookBlock[],
  view: BookView
): readonly BookBlock[] {
  if (!view.hideUnset) return blocks;
  return blocks.filter((block) => block.kind === 'present');
}
