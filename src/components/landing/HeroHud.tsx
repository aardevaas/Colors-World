'use client';

import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { REPO_URL } from '@/lib/landing/repo';
import type { RoomColor } from '@/lib/landing/room-palette';
import { GlowTitle } from './GlowTitle';
import { LiquidButton } from './LiquidButton';
import { PrismButton } from './PrismButton';
import styles from './landing.module.css';

interface HeroHudProps {
  /** The generated six — handed to the liquid pill for the blobs inside it. */
  readonly rooms: readonly RoomColor[];
  /** Carries the scroll-driven fade — see LandingExperience for why it's a
   *  CSS variable on this node rather than React state. */
  readonly ref?: React.Ref<HTMLDivElement>;
}

const SUB_COPY =
  'The free, open-source studio for color, palettes, branding, and typography — built in the open, for everyone.';

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

export function HeroHud({ ref, rooms }: HeroHudProps) {
  return (
    <>
      <div className={styles.hud} ref={ref}>

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
            <GlowTitle>Every color.</GlowTitle>
            <br />
            <GlowTitle>All </GlowTitle>
            <span className={styles.headlineAccent}>16.7 million</span>
            <GlowTitle> of them.</GlowTitle>
          </h1>
          {/*
            Split into words so each can arrive on its own beat.

            Words, not letters: a per-letter reveal on body copy fights reading
            rather than leading it, and a screen reader handed a paragraph of
            inline-block letters is liable to spell it. Word spans concatenate
            normally, and the spaces between them are real text nodes.
          */}
          <p className={styles.sub}>
            {SUB_COPY.split(' ').map((word, index) => (
              <span
                key={`${word}-${index}`}
                className={styles.subWord}
                style={{ '--word-index': index } as React.CSSProperties}
              >
                {word}
              </span>
            ))}
          </p>
          <a
            href="https://github.com/aardevaas"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.builtBy}
            data-rain-surface="shed"
            onPointerMove={handleTiltPointerMove}
            onPointerLeave={handleTiltPointerLeave}
          >
            {/* The pane's own body. Decorative. There is no streak element
                any more: every version of a diagonal light sweep across this
                face has read as a line drawn through the middle of it rather
                than as a reflection, because a gradient stop IS an edge. Glass
                this thin, indoors, does not carry one. */}
            <span className={styles.glassReflection} aria-hidden="true" />

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
            {/* /library, not /studio. The headline promises "every color,
                all 16.7 million of them" and /library is that promise made
                good on sight — an infinite grid of computed color that asks
                nothing of a first-time visitor. /studio is a blank canvas
                with a dot grid: the right room once you have something to
                arrange, and the wrong one to land in. */}
            {/* The prismatic pill, after "Button 02.mp4" — a dark pill at rest
                with the spectral ribbon arriving only on hover. Replaces the
                earlier light-on-dark adaptation of that same reference, which
                had to invert it to survive a near-white fill. */}
            <PrismButton href="/library">Explore Every Color</PrismButton>
            {/* The liquid pill, after "Button 01.mp4". */}
            <LiquidButton href={REPO_URL} external rooms={rooms}>
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
