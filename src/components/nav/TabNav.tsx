import type { ReactNode } from 'react';
import { SystemLink } from '@/components/system/SystemLink';
import { TABS, tabById, type TabId } from '@/lib/nav/tabs';
import styles from './tab-nav.module.css';

interface TabNavProps {
  /**
   * Which tab is rendering this — marked as current and never self-linked.
   *
   * Optional because not every page that wants the shell is a tab. `/studio`
   * was retired from the manifest on 2026-08-24 and still resolves for anyone
   * holding a bookmark; it renders the nav without claiming a slot in it.
   */
  readonly current?: TabId;
  /**
   * True when the page supplies its own `<h1>`.
   *
   * The wordmark is the page heading everywhere else, because in most rooms
   * there is nothing more important to announce than which room you are in.
   * The guideline is the exception: its own title IS the document, and two
   * `<h1>`s on one page leaves a screen reader with no single answer to
   * "what is this page". The wordmark steps down to a plain paragraph rather
   * than the document title stepping down to an `<h2>` — demoting the content
   * to make room for the chrome would be the wrong way round.
   */
  readonly pageHasOwnHeading?: boolean;
  /** Right-hand slot: share controls, account status, whatever the tab needs. */
  readonly children?: ReactNode;
}

/**
 * The persistent shell's navigation — one component, one manifest, every tab.
 *
 * `current` is passed in rather than read from `usePathname()` so this stays a
 * server component: navigation is the same on every render of a given route,
 * and shipping a client bundle plus a hydration pass for it would be waste.
 * The links themselves are `SystemLink`, a tiny client component, because the
 * one part of this that does depend on live state is the href — every room
 * link has to carry the System so the address stays true when someone opens a
 * tab in a new window or copies a link out of the nav.
 *
 * Styling deliberately routes through CSS custom properties rather than fixed
 * values. The locked product decision is that each tab is its own world —
 * typography and atmosphere shift per tab — while the shell stays
 * *structurally* constant. A tab that wants its own type (as /builder does)
 * overrides `--tab-nav-font` and the color hooks in its own scope; it does not
 * get to reinvent the markup.
 */
/**
 * The wordmark, as a heading or as plain text.
 *
 * Same element, same class, same styling either way — only the tag changes,
 * because the only thing at stake is what a screen reader calls the page.
 */
function Wordmark({ asHeading, children }: { readonly asHeading: boolean; readonly children: ReactNode }) {
  const Tag = asHeading ? 'h1' : 'p';
  return <Tag className={styles.wordmark}>{children}</Tag>;
}

export function TabNav({ current, pageHasOwnHeading = false, children }: TabNavProps) {
  const currentTab = current === undefined ? null : tabById(current);

  return (
    <header className={styles.masthead}>
      <Wordmark asHeading={!pageHasOwnHeading}>
        Colors World
        {currentTab !== null && <span className={styles.wordmarkDim}> / {currentTab.label}</span>}
      </Wordmark>

      <nav className={styles.navGroup} aria-label="Primary">
        {TABS.map((tab) => {
          if (tab.id === current) {
            return (
              <span key={tab.id} className={styles.navCurrent} aria-current="page">
                {tab.label}
              </span>
            );
          }
          if (!tab.built) {
            return (
              <span key={tab.id} className={styles.navSoon} title="In development">
                {tab.label}
              </span>
            );
          }
          return (
            <SystemLink key={tab.id} href={tab.href} className={styles.navLink}>
              {tab.label}
            </SystemLink>
          );
        })}
      </nav>

      {children !== undefined && <div className={styles.slot}>{children}</div>}
    </header>
  );
}
