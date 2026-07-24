'use client';

import Link from 'next/link';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import styles from './landing.module.css';

interface HeroHudProps {
  readonly motionEnabled: boolean;
  readonly onToggleMotion: () => void;
}

const REPO_URL = 'https://github.com/aardevaas/Colors-World';

export function HeroHud({ motionEnabled, onToggleMotion }: HeroHudProps) {
  return (
    <div className={styles.hud}>
      <header className={styles.hudTop}>
        <span className={styles.wordmark}>Colors World</span>
        <div className={styles.hudControls}>
          <button
            type="button"
            onClick={onToggleMotion}
            className={styles.hudToggle}
            aria-pressed={motionEnabled}
          >
            motion: {motionEnabled ? 'on' : 'off'}
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.hudLink}
          >
            GitHub
          </a>
        </div>
      </header>

      <main className={styles.copy}>
        <p className={styles.eyebrow}>Open-source · Free forever</p>
        <h1 className={styles.headline}>
          Every colour.
          <br />
          All <span className={styles.headlineAccent}>16.7 million</span> of them.
        </h1>
        <p className={styles.sub}>
          The free, open-source studio for colour, palettes, branding, and typography —
          built in the open, for everyone.
        </p>
        <a
          href="https://github.com/aardevaas"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.builtBy}
        >
          Built by: aardevaas
          <GitHubIcon className={styles.builtByIcon} />
        </a>
        <div className={styles.ctaRow}>
          <Link href="/studio" className={styles.ctaPrimary}>
            Enter the studio for free
          </Link>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaSecondary}
          >
            <GitHubIcon />
            Star on GitHub
          </a>
        </div>
      </main>

      <footer className={styles.scrollCue} aria-hidden="true">
        <span className={styles.scrollCueLabel}>scroll</span>
        <span className={styles.scrollCueLine} />
      </footer>
    </div>
  );
}
