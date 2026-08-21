'use client';

import { useRef, type ReactNode } from 'react';
import type { RoomColor } from '@/lib/landing/room-palette';
import { LiquidField } from './LiquidField';
import { usePointerTilt } from '@/lib/landing/use-pointer-tilt';
import styles from './liquid-button.module.css';

/**
 * The liquid pill, after "Button 01.mp4".
 *
 * Four things make that reference what it is, and all four are here:
 *
 *  1. A dense field of coral blobs drifting inside a translucent cream pill,
 *     at *varying blur* — the soft ones read as deeper inside the liquid, so
 *     the button has volume rather than a printed pattern.
 *  2. A 3D tilt that tracks the pointer across the whole viewport, not just on
 *     hover. In the reference the pill is visibly angled while the cursor sits
 *     far away at the top of the frame.
 *  3. Real depth: an underside face sitting behind the top one in Z, so the
 *     tilt reveals a thickness rather than turning a sheet of paper.
 *  4. Glossy edges: a bright specular rim, brightest where the tilt turns a
 *     face toward the light.
 *
 * The reference's cursor lens (a magnifier that warped the label) was built and
 * then removed at the founder's request — it read as a duplicated copy rather
 * than refraction, which is a fair call.
 *
 * Pointer state is written to CSS custom properties from a rAF loop rather
 * than React state — it changes every frame, and re-rendering a tree to move a
 * highlight would cost more than the effect does.
 */

interface LiquidButtonProps {
  readonly href: string;
  readonly children: ReactNode;
  /** External links get the usual rel guard. */
  readonly external?: boolean;
  /** The generated six, for the blobs suspended inside the pill. */
  readonly rooms: readonly RoomColor[];
  readonly className?: string;
}

/**
 * The pill carries its own liquid.
 *
 * It once held 22 hand-placed blobs, then nothing at all while the rain filled
 * it, and both were wrong. The blobs were a decoration arguing the button was
 * liquid; the empty pill meant the button a visitor first sees is a bare
 * capsule, when the reference is packed from its first frame.
 *
 * It now ships full, on its OWN canvas (see LiquidField) rather than on the
 * page-wide rain canvas — which sits above the whole document and so painted
 * the blobs over this button's label instead of under it. Rain still feeds it:
 * the button is `data-rain-surface="absorb"`, and every drop that lands is
 * handed over as one more blob carrying its colour.
 */

export function LiquidButton({ href, children, external = false, className, rooms }: LiquidButtonProps) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  // Shared with PrismButton so both CTAs move identically — see
  // use-pointer-tilt.ts for why that behaviour was lifted out of here.
  usePointerTilt(rootRef);

  return (
    <a
      ref={rootRef}
      href={href}
      className={className === undefined ? styles.button : `${styles.button} ${className}`}
      // The one surface that takes the rain in instead of shedding it.
      data-rain-surface="absorb"
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {/* The underside must live INSIDE the rotating group, not beside it. As a
          static plane in the parent it stayed flat while the face turned, so
          the face's far edge dipped behind it and the plane cut straight
          through — which is what showed up as a slab covering half the label.
          Rotated together, it stays directly behind the face at every angle. */}
      <span className={styles.tilt}>
        <span className={styles.underside} aria-hidden="true" />
        <span className={styles.face}>
          {/* Beneath the gloss and the label, which is the whole point of it
              living here rather than on the page-wide rain canvas. */}
          <LiquidField rooms={rooms} />
          <span className={styles.gloss} aria-hidden="true" />
          <span className={styles.label}>{children}</span>
        </span>
      </span>
    </a>
  );
}



export default LiquidButton;
