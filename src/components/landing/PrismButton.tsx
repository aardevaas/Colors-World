'use client';

import Link from 'next/link';
import { useRef, type ReactNode } from 'react';
import { usePointerTilt } from '@/lib/landing/use-pointer-tilt';
import styles from './prism-button.module.css';

/**
 * The prismatic pill, after "Button 02.mp4".
 *
 * Rebuilt from a 10fps close crop of the reference, because the first version
 * had the mechanism wrong. Nothing in that clip slides. It is a warm-white mass
 * anchored at the left end, a cyan mass anchored at the right, and a thin
 * dispersed filament wriggling between them — all fixed in place, breathing.
 *
 * A travelling stroke is what produced the "passive left to right pass" with a
 * visible cut-off: a line that crosses the button must enter and exit, and the
 * reference's light does neither.
 *
 * The dispersion is three strokes on the same path — a wide soft body, a mid
 * band and a thin white core — with the two outer ones carrying a spectral
 * gradient. That is what separates into rainbow edges rather than reading as a
 * single colored line.
 */

interface PrismButtonProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** Matches the first `snake` keyframe. Kept as an attribute as well as in CSS
 *  so the filament still draws if `d` animation is unsupported. */
const RIBBON_PATH = 'M -6 40 C 34 46, 62 16, 104 24 S 168 48, 206 18';

export function PrismButton({ href, children, className }: PrismButtonProps) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  // The same hook the liquid pill uses, so the two CTAs move identically.
  // Before this they behaved nothing alike — one tracked the pointer in 3D and
  // the other was inert — and the pair read as two unrelated controls.
  usePointerTilt(rootRef);

  return (
    <Link
      ref={rootRef}
      href={href}
      className={className === undefined ? styles.button : `${styles.button} ${className}`}
      // Rain lands on this one and runs off it.
      data-rain-surface="shed"
    >
      {/* The underside lives INSIDE the rotating group, same as on the liquid
          pill: outside it, it stays flat while the face turns and the face's
          far edge sinks behind it. Rotated together it stays directly behind
          the face and only ever shows as a sliver of thickness. */}
      <span className={styles.tilt}>
        <span className={styles.underside} aria-hidden="true" />
        <span className={styles.face}>
          <span className={styles.glowLeft} aria-hidden="true" />
          <span className={styles.glowRight} aria-hidden="true" />
          <span className={styles.filament} aria-hidden="true">
            <svg
              className={styles.svg}
              viewBox="0 0 200 56"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <linearGradient id="prism-spectrum" x1="0" y1="0" x2="1" y2="0">
                  {/* Dispersion order, warm through white to cool — the sequence
                      light actually separates into. A symmetrical rainbow reads
                      as a generic gradient instead. */}
                  <stop offset="0%" stopColor="oklch(72% 0.21 30)" />
                  <stop offset="14%" stopColor="oklch(86% 0.18 85)" />
                  <stop offset="28%" stopColor="oklch(84% 0.17 150)" />
                  <stop offset="46%" stopColor="oklch(99% 0.02 220)" />
                  <stop offset="64%" stopColor="oklch(90% 0.12 210)" />
                  <stop offset="82%" stopColor="oklch(76% 0.18 240)" />
                  <stop offset="100%" stopColor="oklch(66% 0.21 285)" />
                </linearGradient>
              </defs>
              <path d={RIBBON_PATH} className={styles.strokeWide} stroke="url(#prism-spectrum)" />
              <path d={RIBBON_PATH} className={styles.strokeMid} stroke="url(#prism-spectrum)" />
              <path d={RIBBON_PATH} className={styles.strokeCore} />
            </svg>
          </span>
          <span className={styles.fringe} aria-hidden="true" />
          <span className={styles.gloss} aria-hidden="true" />
          <span className={styles.label}>{children}</span>
        </span>
      </span>
    </Link>
  );
}

export default PrismButton;
