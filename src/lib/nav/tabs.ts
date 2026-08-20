/**
 * The single source of truth for what tabs exist and where they live.
 *
 * Navigation used to be hand-rolled in every shell — four copies, four
 * different link sets, and no tab that linked to all five. That is how Tabs 04
 * and 05 ended up with nowhere to appear: there was no one place that knew the
 * full set. Everything that renders navigation now reads this manifest, so
 * adding a tab is a one-line change and cannot drift per-page again.
 */

export type TabId = 'library' | 'compose' | 'scales' | 'visualizer' | 'typography' | 'studio';

export interface TabRoute {
  readonly id: TabId;
  readonly href: string;
  readonly label: string;
  /** `false` while a tab is still being built — it renders in the nav so the
   *  product's shape is legible, but as inert text rather than a dead link. */
  readonly built: boolean;
}

/**
 * Ordered as the work is done, not alphabetically or by age: find a colour,
 * make a palette from it, deepen each colour into a scale, prove the result on
 * real UI and real type, then assemble it. A person reading the nav should be
 * able to infer the workflow without being told it.
 */
export const TABS: readonly TabRoute[] = [
  { id: 'library', href: '/library', label: 'library', built: true },
  { id: 'compose', href: '/compose', label: 'compose', built: true },
  { id: 'scales', href: '/scales', label: 'scales', built: true },
  { id: 'visualizer', href: '/visualizer', label: 'visualizer', built: true },
  { id: 'typography', href: '/typography', label: 'typography', built: true },
  { id: 'studio', href: '/studio', label: 'studio', built: true },
];

/**
 * Routes that predate the five-tab model and still work, but are not tabs.
 * Kept separate rather than mixed into TABS so the primary navigation stays
 * exactly five items — their long-term fate is an open question in ROADMAP.md.
 */
export const SECONDARY_ROUTES = [
  { href: '/palettes', label: 'palettes' },
  { href: '/assets', label: 'assets' },
] as const;

export function tabById(id: TabId): TabRoute {
  const tab = TABS.find((t) => t.id === id);
  if (tab === undefined) throw new Error(`Unknown tab id: ${id}`);
  return tab;
}
