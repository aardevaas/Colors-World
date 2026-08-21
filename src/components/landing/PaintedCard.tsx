'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import {
  STROKE_WIDTH,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  buildStrokes,
} from '@/lib/landing/paint-stroke';
import styles from './painted-card.module.css';

/**
 * A card painted into existence, stroke by stroke.
 *
 * The strokes are not a mask over a finished card — they *are* the card's
 * surface. Each is an SVG path in the room's colour that draws itself, and the
 * panel exists only where paint has been laid down. Masking a completed card
 * would have been easier and would have looked like a reveal; this looks like
 * painting because it is the same operation.
 *
 * Three techniques carry it:
 *
 *  - `pathLength="1"` normalises every path, so `stroke-dasharray: 1` and an
 *    offset of ±1 draws it end to end with no measurement. The alternative is
 *    `getTotalLength()` per path at runtime, which forces layout and has to be
 *    redone on every resize.
 *  - A brush tip rides the path via `offset-path`/`offset-distance`, so there
 *    is something visibly *doing* the painting rather than a line growing on
 *    its own.
 *  - `STROKE_WIDTH` is applied here from the geometry module rather than set in
 *    CSS, because it is a geometry constant: the strokes have to be wider than
 *    the largest gap between their centres or the finished panel shows seams.
 *    One number governs both, and the test checks the relationship.
 *
 * A scroll-driven version (`animation-timeline: view()`) was built first and is
 * the better mechanism — compositor-run, no listener, scrubs with the scroll.
 * It is not what ships: this environment reports `document.hidden`, hidden
 * documents do not advance scroll timelines, and an inactive timeline is
 * indistinguishable from a broken selector from here. The reveal is driven by
 * an IntersectionObserver instead, whose behaviour can be observed. See the
 * stylesheet for the swap.
 */

export interface PaintedCardProps {
  readonly href: string;
  readonly index: number;
  /** The room's colour — the paint this card is made of. */
  readonly hex: string;
  readonly room: string;
  readonly route: string;
  readonly subtitle: string;
  readonly highlights: readonly string[];
  readonly featured?: boolean;
  readonly children?: ReactNode;
}

export function PaintedCard({
  href,
  index,
  hex,
  room,
  route,
  subtitle,
  highlights,
  featured = false,
}: PaintedCardProps) {
  const strokes = useMemo(() => buildStrokes(), []);

  return (
    <Link
      href={href}
      className={featured ? `${styles.card} ${styles.featured}` : styles.card}
      style={
        {
          '--paint': hex,
          // Staggers whole cards against each other so the six do not all
          // paint in unison as the grid scrolls past.
          '--card-index': index,
        } as React.CSSProperties
      }
    >
      <svg
        className={styles.paint}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Roughens the stroke edges so they read as pigment rather than as
              vector geometry. Cheap: one turbulence, applied once. */}
          <filter id={`paint-edge-${index}`} x="-12%" y="-30%" width="124%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9 0.55" numOctaves="2" seed={index * 7 + 3} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <g filter={`url(#paint-edge-${index})`}>
          {strokes.map((stroke, i) => (
            <path
              key={stroke.d}
              className={styles.stroke}
              d={stroke.d}
              pathLength="1"
              strokeWidth={STROKE_WIDTH}
              style={
                {
                  '--from': stroke.from,
                  '--start': stroke.start,
                  '--end': stroke.end,
                  // Expressed as percentages for `animation-range`, which does
                  // not accept unitless fractions.
                  '--start-pct': `${(stroke.start * 100).toFixed(2)}%`,
                  '--end-pct': `${(stroke.end * 100).toFixed(2)}%`,
                  '--stroke-order': i,
                } as React.CSSProperties
              }
            />
          ))}
        </g>
      </svg>

      {/* The wet tip. Rides the last stroke's path, so it is still travelling
          as the panel completes. */}
      <span
        className={styles.tip}
        aria-hidden="true"
        style={{ offsetPath: `path("${strokes[strokes.length - 1]?.d ?? ''}")` } as React.CSSProperties}
      />

      <div className={styles.content}>
        <p className={styles.room}>{room}</p>
        <p className={styles.route}>{route}</p>
        <p className={styles.subtitle}>{subtitle}</p>
        <ul className={styles.highlights}>
          {highlights.slice(0, featured ? 3 : 2).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <span className={styles.enter}>
          Open {room}
          <span aria-hidden="true"> →</span>
        </span>
      </div>
    </Link>
  );
}

export default PaintedCard;
