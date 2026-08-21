import type { ReactNode } from 'react';
import { SystemLink } from '@/components/system/SystemLink';
import { TABS, tabById, type TabId } from '@/lib/nav/tabs';
import styles from './tab-nav.module.css';

interface TabNavProps {
  /** Which tab is rendering this — marked as current and never self-linked. */
  readonly current: TabId;
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
export function TabNav({ current, children }: TabNavProps) {
  const currentTab = tabById(current);

  return (
    <header className={styles.masthead}>
      <h1 className={styles.wordmark}>
        Colors World <span className={styles.wordmarkDim}>/ {currentTab.label}</span>
      </h1>

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
