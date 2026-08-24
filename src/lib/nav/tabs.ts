/**
 * The single source of truth for what tabs exist and where they live.
 *
 * Navigation used to be hand-rolled in every shell — four copies, four
 * different link sets, and no tab that linked to all five. That is how Tabs 04
 * and 05 ended up with nowhere to appear: there was no one place that knew the
 * full set. Everything that renders navigation now reads this manifest, so
 * adding a tab is a one-line change and cannot drift per-page again.
 */

export type TabId = 'library' | 'compose' | 'scales' | 'visualizer' | 'typography' | 'brand';

export interface TabRoute {
  readonly id: TabId;
  readonly href: string;
  readonly label: string;
  /** `false` while a tab is still being built — it renders in the nav so the
   *  product's shape is legible, but as inert text rather than a dead link. */
  readonly built: boolean;
}

/**
 * Ordered as the work is done, not alphabetically or by age: find a color,
 * make a palette from it, deepen each color into a scale, prove the result on
 * real UI and real type, then write it down. A person reading the nav should be
 * able to infer the workflow without being told it.
 *
 * `studio` left this list on 2026-08-24 and `brand` took its slot. The Book
 * replaces the wall as the place work comes together: a wall is for exploring
 * and a guideline is for deciding, and the product only needs one home for the
 * second. `/studio` still resolves for anyone holding a bookmark — it is
 * unlinked, not deleted, and its ~4,000 tested lines come out properly once the
 * launch is behind us rather than under a deadline.
 */
export const TABS: readonly TabRoute[] = [
  { id: 'library', href: '/library', label: 'library', built: true },
  { id: 'compose', href: '/compose', label: 'compose', built: true },
  { id: 'scales', href: '/scales', label: 'scales', built: true },
  { id: 'visualizer', href: '/visualizer', label: 'visualizer', built: true },
  { id: 'typography', href: '/typography', label: 'typography', built: true },
  { id: 'brand', href: '/brand', label: 'brand', built: true },
];

/**
 * The tab ids alone, in the same order. Exists so anything that needs one
 * value per room — the landing page's generated room palette, for instance —
 * cannot drift out of step with the manifest by keeping its own list.
 */
export const ROOM_IDS: readonly TabId[] = TABS.map((tab) => tab.id);

/**
 * Routes that work but are not tabs — either older than the tab model, or
 * retired out of it. Kept separate rather than mixed into TABS so the primary
 * navigation stays exactly six items.
 */
export const SECONDARY_ROUTES = [
  { href: '/palettes', label: 'palettes' },
  { href: '/assets', label: 'assets' },
  { href: '/studio', label: 'studio' },
] as const;

export function tabById(id: TabId): TabRoute {
  const tab = TABS.find((t) => t.id === id);
  if (tab === undefined) throw new Error(`Unknown tab id: ${id}`);
  return tab;
}
