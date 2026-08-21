'use client';

import { useRef, type ReactNode } from 'react';
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
  readonly className?: string;
}

/**
 * The pill ships EMPTY.
 *
 * It used to carry 22 hand-placed blobs drifting inside it — a deterministic
 * field, because generating them at random differed between server and client
 * and tripped hydration. They are gone, and what fills the pill now is the
 * rain: this button is marked `data-rain-surface="absorb"`, so every drop that
 * lands on it is taken in and stays, drifting around inside. See PaintRain.
 *
 * That is a better version of the same idea. The blobs were a decoration that
 * argued the button was liquid; the drops are the page's own weather actually
 * collecting in it, and no two visits fill it the same way.
 */

export function LiquidButton({ href, children, external = false, className }: LiquidButtonProps) {
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
          <span className={styles.gloss} aria-hidden="true" />
          <span className={styles.label}>{children}</span>
        </span>
      </span>
    </a>
  );
}



export default LiquidButton;
