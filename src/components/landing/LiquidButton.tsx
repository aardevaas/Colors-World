'use client';

import { useEffect, useRef, type ReactNode } from 'react';
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
 *  3. A lens that follows the cursor and magnifies whatever is beneath it.
 *     Captured directly: with the cursor off the text "Proceed" is crisp, and
 *     with it on the text the letterforms warp into a swirl. It refracts the
 *     label and the blobs alike, so it cannot be an effect on either one
 *     alone — it is a layer over both.
 *  4. Glossy edges: a bright specular rim, brightest where the tilt turns a
 *     face toward the light.
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

/** Deterministic field — generated at random it would differ between server
 *  and client and trip hydration. Blur varies to fake depth of field. */
interface Blob {
  readonly top: number;
  readonly left: number;
  readonly size: number;
  readonly blur: number;
  readonly hue: number;
  readonly alpha: number;
  readonly duration: number;
  readonly delay: number;
}

const BLOBS: readonly Blob[] = [
  { top: 18, left: 6, size: 30, blur: 2, hue: 8, alpha: 0.85, duration: 9.0, delay: -0.4 },
  { top: 62, left: 3, size: 22, blur: 5, hue: 2, alpha: 0.6, duration: 11.5, delay: -3.1 },
  { top: 38, left: 12, size: 38, blur: 0, hue: 12, alpha: 0.9, duration: 8.2, delay: -1.7 },
  { top: 78, left: 16, size: 26, blur: 3, hue: 350, alpha: 0.7, duration: 12.4, delay: -5.2 },
  { top: 8, left: 22, size: 20, blur: 6, hue: 6, alpha: 0.55, duration: 10.1, delay: -2.3 },
  { top: 52, left: 26, size: 34, blur: 1, hue: 14, alpha: 0.88, duration: 9.6, delay: -6.0 },
  { top: 86, left: 31, size: 24, blur: 4, hue: 356, alpha: 0.65, duration: 13.0, delay: -0.9 },
  { top: 24, left: 36, size: 28, blur: 2, hue: 10, alpha: 0.8, duration: 8.8, delay: -4.4 },
  { top: 66, left: 42, size: 19, blur: 7, hue: 4, alpha: 0.5, duration: 11.9, delay: -2.8 },
  { top: 14, left: 47, size: 33, blur: 0, hue: 16, alpha: 0.92, duration: 9.3, delay: -7.1 },
  { top: 48, left: 52, size: 23, blur: 5, hue: 352, alpha: 0.62, duration: 12.7, delay: -1.2 },
  { top: 82, left: 56, size: 30, blur: 2, hue: 9, alpha: 0.84, duration: 8.5, delay: -5.8 },
  { top: 30, left: 61, size: 21, blur: 6, hue: 3, alpha: 0.56, duration: 10.8, delay: -3.6 },
  { top: 70, left: 66, size: 36, blur: 1, hue: 13, alpha: 0.9, duration: 9.9, delay: -0.2 },
  { top: 10, left: 71, size: 25, blur: 4, hue: 358, alpha: 0.68, duration: 12.1, delay: -6.5 },
  { top: 56, left: 76, size: 29, blur: 2, hue: 11, alpha: 0.86, duration: 8.9, delay: -2.0 },
  { top: 88, left: 80, size: 18, blur: 7, hue: 5, alpha: 0.48, duration: 13.4, delay: -4.9 },
  { top: 34, left: 84, size: 32, blur: 0, hue: 15, alpha: 0.91, duration: 9.1, delay: -1.5 },
  { top: 74, left: 89, size: 22, blur: 5, hue: 354, alpha: 0.6, duration: 11.2, delay: -7.6 },
  { top: 20, left: 93, size: 27, blur: 3, hue: 7, alpha: 0.78, duration: 10.4, delay: -3.3 },
  { top: 58, left: 96, size: 20, blur: 6, hue: 1, alpha: 0.52, duration: 12.9, delay: -5.5 },
  { top: 44, left: 19, size: 17, blur: 8, hue: 12, alpha: 0.44, duration: 14.0, delay: -0.7 },
];

/** How far the pill turns toward the pointer, in degrees. */
const MAX_TILT_DEG = 26;
/** Distance in pixels over which the pointer still influences the tilt. */
const INFLUENCE_PX = 620;
/** Per-second convergence for the eased follow. */
const TILT_LAMBDA = 5.5;
const LENS_LAMBDA = 14;

export function LiquidButton({ href, children, external = false, className }: LiquidButtonProps) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const handleMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, inside: pointerRef.current.inside };
    };
    const handleEnter = () => {
      pointerRef.current = { ...pointerRef.current, inside: true };
    };
    const handleLeave = () => {
      pointerRef.current = { ...pointerRef.current, inside: false };
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    root.addEventListener('pointerenter', handleEnter);
    root.addEventListener('pointerleave', handleLeave);

    let rotX = 0;
    let rotY = 0;
    let lensX = 50;
    let lensY = 50;
    let lensOn = 0;
    let last = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      const rect = root.getBoundingClientRect();
      if (rect.width === 0) return;

      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = pointerRef.current.x - cx;
      const dy = pointerRef.current.y - cy;

      // Influence falls off with distance, so a pointer on the far side of the
      // page leaves the pill near rest instead of pinned at full tilt.
      const distance = Math.hypot(dx, dy);
      const influence = Math.max(0, 1 - distance / INFLUENCE_PX);

      // Saturates within about half a button-width, not a full one: with the
      // wider mapping the pill barely moved while the cursor was on it, which
      // is precisely when the reference is at its most angled.
      const wantY = clamp(dx / (rect.width * 0.45), -1, 1) * MAX_TILT_DEG * influence;
      const wantX = -clamp(dy / (rect.height * 0.9), -1, 1) * MAX_TILT_DEG * influence;

      // A slow sway underneath, so the pill is never completely static — the
      // reference is visibly angled even with the cursor parked far away.
      const sway = now / 1000;
      const idleY = Math.sin(sway / 3.7) * 5.5;
      const idleX = Math.sin(sway / 5.3) * 3.0;

      rotX = damp(rotX, wantX + idleX, TILT_LAMBDA, dt);
      rotY = damp(rotY, wantY + idleY, TILT_LAMBDA, dt);

      const wantLensX = ((pointerRef.current.x - rect.left) / rect.width) * 100;
      const wantLensY = ((pointerRef.current.y - rect.top) / rect.height) * 100;
      lensX = damp(lensX, wantLensX, LENS_LAMBDA, dt);
      lensY = damp(lensY, wantLensY, LENS_LAMBDA, dt);
      lensOn = damp(lensOn, pointerRef.current.inside ? 1 : 0, 9, dt);

      root.style.setProperty('--rot-x', `${rotX.toFixed(3)}deg`);
      root.style.setProperty('--rot-y', `${rotY.toFixed(3)}deg`);
      root.style.setProperty('--lens-x', `${lensX.toFixed(2)}%`);
      root.style.setProperty('--lens-y', `${lensY.toFixed(2)}%`);
      root.style.setProperty('--lens-on', lensOn.toFixed(3));
      // Specular slides opposite the tilt, as a highlight on a curved face does.
      root.style.setProperty('--shine-x', `${(50 - rotY * 1.6).toFixed(2)}%`);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
      root.removeEventListener('pointerenter', handleEnter);
      root.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  const field = (
    <span className={styles.field} aria-hidden="true">
      {BLOBS.map((blob) => (
        <span
          key={`${blob.top}-${blob.left}-${blob.size}`}
          className={styles.blob}
          style={
            {
              '--top': `${blob.top}%`,
              '--left': `${blob.left}%`,
              '--size': `${blob.size}px`,
              '--blur': `${blob.blur}px`,
              '--hue': blob.hue,
              '--alpha': blob.alpha,
              '--duration': `${blob.duration}s`,
              '--delay': `${blob.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );

  return (
    <a
      ref={rootRef}
      href={href}
      className={className === undefined ? styles.button : `${styles.button} ${className}`}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      <span className={styles.tilt}>
        {field}
        <span className={styles.gloss} aria-hidden="true" />
        <span className={styles.label}>{children}</span>
        {/* The lens sits above everything and duplicates what is beneath it,
            scaled from the cursor and masked to a circle — the reference
            refracts the label and the blobs together, so it has to be a layer
            over both rather than a filter on either. */}
        <span className={styles.lens} aria-hidden="true">
          <span className={styles.lensInner}>
            {field}
            <span className={styles.label}>{children}</span>
          </span>
        </span>
      </span>
    </a>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Frame-rate independent easing — the naive lerp moves further per second on
 *  a 144Hz display than a 60Hz one. */
function damp(current: number, target: number, lambda: number, dt: number): number {
  if (!Number.isFinite(dt) || dt <= 0) return current;
  return target + (current - target) * Math.exp(-lambda * dt);
}

export default LiquidButton;
