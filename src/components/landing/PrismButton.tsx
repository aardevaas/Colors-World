'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './prism-button.module.css';

/**
 * The prismatic pill, after "Button 02.mp4".
 *
 * The reference has two distinct states, and the contrast between them is the
 * whole effect:
 *
 *  - At rest, almost nothing: a dark pill, a hairline border, white label. Read
 *    from the frames rather than assumed — several seconds of that clip are a
 *    plain button with no colour in it at all.
 *  - On hover, a ribbon of white-hot light sweeps through on an S-curve, split
 *    into spectral edges (warm on one side, cyan on the other) the way light
 *    disperses through a prism, and blooms past the pill's own edge.
 *
 * The ribbon is an SVG path stroked with a spectral gradient and blurred, not a
 * CSS gradient sweep: it has to *curve*, and a linear-gradient can only ever
 * travel in a straight line. Two copies — a sharp one inside the pill and a
 * heavily blurred one behind it — give the core and the bloom.
 */

interface PrismButtonProps {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** The S the light travels. Drawn in a 200x56 viewBox and stretched, so the
 *  curve keeps its shape whatever the button's width turns out to be. */
const RIBBON_PATH = 'M -14 44 C 26 46, 44 16, 84 20 S 150 44, 214 12';

export function PrismButton({ href, children, className }: PrismButtonProps) {
  return (
    <Link
      href={href}
      className={className === undefined ? styles.button : `${styles.button} ${className}`}
    >
      <span className={styles.bloom} aria-hidden="true">
        <Ribbon blurred />
      </span>
      <span className={styles.face}>
        <span className={styles.ribbon} aria-hidden="true">
          <Ribbon />
        </span>
        <span className={styles.label}>{children}</span>
      </span>
    </Link>
  );
}

function Ribbon({ blurred = false }: { readonly blurred?: boolean }) {
  const id = blurred ? 'prism-bloom' : 'prism-core';
  return (
    <svg
      className={styles.svg}
      viewBox="0 0 200 56"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="0">
          {/* Warm at the leading edge through white at the core to cyan at the
              trailing edge — the dispersion order light actually separates in,
              which is what stops it reading as a generic rainbow wipe. */}
          <stop offset="0%" stopColor="oklch(70% 0.21 30)" />
          <stop offset="18%" stopColor="oklch(84% 0.18 85)" />
          <stop offset="38%" stopColor="oklch(97% 0.03 200)" />
          <stop offset="58%" stopColor="oklch(92% 0.09 210)" />
          <stop offset="78%" stopColor="oklch(74% 0.19 245)" />
          <stop offset="100%" stopColor="oklch(66% 0.2 285)" />
        </linearGradient>
      </defs>
      {/* Three passes at decreasing width: a wide soft body, a mid band, and a
          thin white core. One stroke alone reads as a flat painted line. */}
      <path d={RIBBON_PATH} className={styles.strokeWide} stroke={`url(#${id}-grad)`} />
      <path d={RIBBON_PATH} className={styles.strokeMid} stroke={`url(#${id}-grad)`} />
      <path d={RIBBON_PATH} className={styles.strokeCore} />
    </svg>
  );
}

export default PrismButton;
