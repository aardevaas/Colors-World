'use client';

import Link from 'next/link';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { LiquidButton } from './LiquidButton';
import { PrismButton } from './PrismButton';
import styles from './landing.module.css';

interface HeroHudProps {
  readonly motionEnabled: boolean;
  readonly onToggleMotion: () => void;
  /** Carries the scroll-driven fade — see LandingExperience for why it's a
   *  CSS variable on this node rather than React state. */
  readonly ref?: React.Ref<HTMLDivElement>;
}

const REPO_URL = 'https://github.com/aardevaas/Colors-World';

/** Radians-free, plain degrees — small enough that the tilt reads as glass
 *  catching light, not a card physically flipping over. */
const MAX_TILT_DEGREES = 7;

function handleTiltPointerMove(event: React.PointerEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const px = (event.clientX - rect.left) / rect.width;
  const py = (event.clientY - rect.top) / rect.height;
  const tiltY = (px - 0.5) * 2 * MAX_TILT_DEGREES;
  const tiltX = (0.5 - py) * 2 * MAX_TILT_DEGREES;
  event.currentTarget.style.setProperty('--tilt-x', `${tiltX.toFixed(2)}deg`);
  event.currentTarget.style.setProperty('--tilt-y', `${tiltY.toFixed(2)}deg`);
}

function handleTiltPointerLeave(event: React.PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--tilt-x', '0deg');
  event.currentTarget.style.setProperty('--tilt-y', '0deg');
}

export function HeroHud({
  motionEnabled,
  onToggleMotion,
  ref,
}: HeroHudProps) {
  return (
    <>
      <div className={styles.hud} ref={ref}>
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

        {/* The skip link in app/page.tsx targets this. It has to carry an id
            *and* be focusable: `#main` did not exist anywhere in the document
            before, so "Skip to content" — the one control provided
            specifically for keyboard and screen-reader visitors — moved focus
            nowhere at all, and `tabIndex={-1}` is what makes a non-interactive
            element actually accept that focus rather than silently dropping
            it. This is the right target because it holds the h1, the sub, and
            both calls to action: everything the pinned WebGL stage is
            otherwise in the way of. */}
        <main id="main" tabIndex={-1} className={styles.copy}>
          <p className={styles.eyebrow}>Open-source · Free forever</p>
          <h1 className={styles.headline}>
            Every colour.
            <br />
            All <span className={styles.headlineAccent}>16.7 million</span> of
            them.
          </h1>
          <p className={styles.sub}>
            The free, open-source studio for colour, palettes, branding, and
            typography — built in the open, for everyone.
          </p>
          <a
            href="https://github.com/aardevaas"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.builtBy}
            onPointerMove={handleTiltPointerMove}
            onPointerLeave={handleTiltPointerLeave}
          >
            {/* Decorative mounting hardware — carries no text, so it stays out
              of the link's accessible name ("Built by: aardevaas"). */}
            <span
              className={`${styles.bolt} ${styles.boltTop} ${styles.boltLeft}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.bolt} ${styles.boltTop} ${styles.boltRight}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.bolt} ${styles.boltBottom} ${styles.boltLeft}`}
              aria-hidden="true"
            />
            <span
              className={`${styles.bolt} ${styles.boltBottom} ${styles.boltRight}`}
              aria-hidden="true"
            />
            <span className={styles.builtByLabel}>Built by:</span>
            <span className={styles.builtByName}>aardevaas</span>
            <GitHubIcon className={styles.builtByIcon} />
          </a>
          <div className={styles.ctaRow}>
            {/* /library, not /studio. The headline promises "every colour,
                all 16.7 million of them" and /library is that promise made
                good on sight — an infinite grid of computed colour that asks
                nothing of a first-time visitor. /studio is a blank canvas
                with a dot grid: the right room once you have something to
                arrange, and the wrong one to land in. */}
            {/* The prismatic pill, after "Button 02.mp4" — a dark pill at rest
                with the spectral ribbon arriving only on hover. Replaces the
                earlier light-on-dark adaptation of that same reference, which
                had to invert it to survive a near-white fill. */}
            <PrismButton href="/library">Explore Every Color</PrismButton>
            {/* The liquid pill, after "Button 01.mp4". */}
            <LiquidButton href={REPO_URL} external>
              <GitHubIcon />
              Star on GitHub
            </LiquidButton>
          </div>
        </main>

        {/* A div, not a footer. This is a scroll hint; using the landmark for
            it meant the page had no real footer and a screen reader
            announcing "content information" arrived at the word "scroll".
            The actual footer is now at the end of the document. */}
        <div className={styles.scrollCue} aria-hidden="true">
          <span className={styles.scrollCueLabel}>scroll</span>
          <span className={styles.scrollCueLine} />
        </div>

      </div>
    </>
  );
}
