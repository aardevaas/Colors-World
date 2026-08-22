'use client';

import Link from 'next/link';
import { TABS } from '@/lib/nav/tabs';
import { REPO_URL } from '@/lib/landing/repo';
import type { RoomColor } from '@/lib/landing/room-palette';
import { PaintRun } from './PaintRun';
import styles from './site-footer.module.css';

/**
 * A real footer.
 *
 * Until now the only `<footer>` on this page held the single word "scroll" —
 * a semantic element used for decoration, which meant the page had no footer
 * at all and a screen reader announcing "content information" arrived at a
 * scroll hint. The scroll cue has gone back to being a plain element; this is
 * the landmark.
 *
 * Every room is listed, because the nav is pinned inside the app and a visitor
 * on the landing page has no other way to see what the product is made of.
 *
 * It is also where the rain goes. The paint run behind this — a fan, a length
 * of glass and a wall it gets hosed at — is the end of the story the top of the
 * page starts: everything that has been falling for four screens is caught
 * here, put through a loop and thrown at the edge. See PaintRun.
 *
 * The text sits above it and the run is scenery, never a layer over the links.
 */
interface SiteFooterProps {
  /** The generated six, so the paint is the same colors as the weather. */
  readonly rooms: readonly RoomColor[];
}

export function SiteFooter({ rooms }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <PaintRun rooms={rooms} />

      <div className={styles.inner}>
        <div className={styles.brandColumn}>
          <p className={styles.wordmark}>Colors World</p>
          <p className={styles.tagline}>
            An open-source studio for color and typography. Every color computed, every
            claim measurable.
          </p>
          <a
            className={styles.action}
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.actionLabel}>Read the source</span>
            <span className={styles.actionArrow} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" focusable="false">
                <path
                  d="M4 12h15M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                />
              </svg>
            </span>
          </a>
        </div>

        <nav className={styles.column} aria-label="Rooms">
          <h2 className={styles.columnHeading}>Rooms</h2>
          <ul className={styles.list}>
            {TABS.map((tab) => (
              <li key={tab.id}>
                <Link href={tab.href} className={styles.link}>
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.column}>
          <h2 className={styles.columnHeading}>Project</h2>
          <ul className={styles.list}>
            <li>
              <a className={styles.link} href={REPO_URL} target="_blank" rel="noopener noreferrer">
                Source on GitHub
              </a>
            </li>
            <li>
              <a
                className={styles.link}
                href={`${REPO_URL}/blob/main/LICENSE`}
                target="_blank"
                rel="noopener noreferrer"
              >
                MIT licence
              </a>
            </li>
            <li>
              <a
                className={styles.link}
                href={`${REPO_URL}/issues`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Report something
              </a>
            </li>
          </ul>
        </div>
      </div>

      <p className={styles.colophon}>
        Built by{' '}
        <a
          className={styles.link}
          href="https://github.com/aardevaas"
          target="_blank"
          rel="noopener noreferrer"
        >
          aardevaas
        </a>
        . Color in OKLCH, contrast in WCAG and APCA, gamut mapping to sRGB, Display P3 and
        Rec2020.
      </p>
    </footer>
  );
}
