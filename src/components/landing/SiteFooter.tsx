import Link from 'next/link';
import { TABS } from '@/lib/nav/tabs';
import { REPO_URL } from '@/lib/landing/repo-stats';
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
 */
export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandColumn}>
          <p className={styles.wordmark}>Colors World</p>
          <p className={styles.tagline}>
            An open-source studio for colour and typography. Every colour computed, every
            claim measurable.
          </p>
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
        . Colour in OKLCH, contrast in WCAG and APCA, gamut mapping to sRGB, Display P3 and
        Rec2020.
      </p>
    </footer>
  );
}
