'use client';

import Link from 'next/link';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { parseColor } from '@/lib/color-engine/color';
import styles from './landing.module.css';

interface HeroHudProps {
  readonly motionEnabled: boolean;
  readonly onToggleMotion: () => void;
  /** The colour picked on the globe, if any — once set, the secondary CTA's
   *  liquid fill settles on this hue instead of continuing to cycle the
   *  full spectrum, so the button reflects the colour the visitor actually
   *  chose rather than an unrelated ambient animation. */
  readonly pickedColorHex?: string;
  /** Carries the scroll-driven fade — see LandingExperience for why it's a
   *  CSS variable on this node rather than React state. */
  readonly ref?: React.Ref<HTMLDivElement>;
}

const REPO_URL = 'https://github.com/aardevaas/Colors-World';

/** Radians-free, plain degrees — small enough that the tilt reads as glass
 *  catching light, not a card physically flipping over. */
const MAX_TILT_DEGREES = 7;

const BLOB_COUNT = 16;

/** Deterministic, not `Math.random()` — this renders during SSR, and a
 *  random value there would mismatch whatever the client re-generates on
 *  hydration. Spread via the golden angle so 16 small blobs land at visibly
 *  different sizes/timings without any two reading as a repeated pair.
 *  `top`/`left` place each blob across the button's full area (12-88%) —
 *  the drift animation only adds a few px of wobble on top of this, it
 *  doesn't do the spreading itself (see the CSS for why). */
const BLOB_CONFIGS = Array.from({ length: BLOB_COUNT }, (_, i) => ({
  size: 0.32 + ((i * 47) % 100) / 100 / 1.8,
  top: 12 + ((i * 53) % 100) * 0.76,
  left: 12 + ((i * 29) % 100) * 0.76,
  delay: -((i * 0.97) % 7),
  duration: 6 + ((i * 31) % 5),
}));

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

/** The primary CTA needs both the tilt above *and* the shine's horizontal
 *  tracking from the same pointer position, so this runs both rather than
 *  wiring two separate handlers to one event. */
function handleCtaPrimaryPointerMove(event: React.PointerEvent<HTMLElement>) {
  handleTiltPointerMove(event);
  const rect = event.currentTarget.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 100;
  event.currentTarget.style.setProperty('--mx', `${mx}%`);
}

export function HeroHud({
  motionEnabled,
  onToggleMotion,
  pickedColorHex,
  ref,
}: HeroHudProps) {
  const pickedHue =
    pickedColorHex !== undefined ? parseColor(pickedColorHex).h : undefined;
  return (
    <>
      {/* Zero-size and purely referenced by id — this never paints anything
          itself, it only defines the goo filter the secondary CTA's blobs
          use. feColorMatrix's alpha row sharpens the blur's soft edges back
          into a hard cutoff, which is what makes overlapping blurred blobs
          read as merging into one shape instead of just overlapping circles.
          stdDeviation is scaled to the blobs themselves (now 5-13px each,
          down from a few 40px+ ones) — the original 8 was tuned for those
          larger blobs and, left unchanged, blurs balls this small into one
          indistinct haze rather than a field of merging dots. */}
      <svg
        width="0"
        height="0"
        style={{ position: 'absolute' }}
        aria-hidden="true"
      >
        <filter id="cta-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 26 -11"
          />
        </filter>
      </svg>
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
            <Link
              href="/library"
              className={styles.ctaPrimary}
              onPointerMove={handleCtaPrimaryPointerMove}
              onPointerLeave={handleTiltPointerLeave}
            >
              {/* Prismatic shine, after the "Button 02.mp4" reference — see
                  the CSS for why it's adapted (overlay blend, not a literal
                  overlay of the reference's bright streak) for a light-on-
                  dark-text button instead of the reference's dark pill. */}
              <span className={styles.ctaPrimaryShine} aria-hidden="true" />
              <span className={styles.ctaPrimaryContent}>
                Explore every colour, free
              </span>
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaSecondary}
            >
              {/* Metaball liquid fill, after the "Button 01.mp4" reference —
                  SVG goo filter rather than canvas: it merges the blobs
                  *and* deforms the pill's own edge for free, since both sit
                  inside the same filter region. Confined to this button
                  alone via the wrapping isolate/overflow-hidden below, and
                  to the secondary CTA only — the primary keeps its solid
                  fill so dark-on-light contrast never depends on a moving
                  background. 16 small, individually-shaded blobs rather
                  than a few large flat ones, matching the reference's dense
                  field of small dots once looked at more closely. */}
              <span
                className={
                  pickedHue !== undefined
                    ? `${styles.blobField} ${styles.blobFieldPicked}`
                    : styles.blobField
                }
                style={
                  pickedHue !== undefined
                    ? ({ '--picked-hue': pickedHue } as React.CSSProperties)
                    : undefined
                }
                aria-hidden="true"
              >
                {BLOB_CONFIGS.map((config, i) => (
                  // eslint-disable-next-line react/no-array-index-key -- fixed-length decorative field, never reordered/inserted/removed
                  <span
                    key={i}
                    className={styles.blob}
                    style={
                      {
                        '--blob-size': `${config.size}rem`,
                        '--blob-top': `${config.top}%`,
                        '--blob-left': `${config.left}%`,
                        '--blob-delay': `${config.delay}s`,
                        '--blob-duration': `${config.duration}s`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </span>
              <span className={styles.ctaSecondaryContent}>
                <GitHubIcon />
                Star on GitHub
              </span>
            </a>
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
