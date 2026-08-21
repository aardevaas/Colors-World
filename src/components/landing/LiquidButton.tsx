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

/** Deterministic field — generated at random it would differ between server
 *  and client and trip hydration. Blur varies to fake depth of field.
 *
 *  `hueShift` staggers each blob's position within the shared spectrum cycle,
 *  so at any instant the field shows a spread of the same hues the "16.7
 *  million" headline is running through rather than all turning together. */
interface Blob {
  readonly top: number;
  readonly left: number;
  readonly size: number;
  readonly blur: number;
  readonly hueShift: number;
  readonly alpha: number;
  readonly duration: number;
  readonly delay: number;
}

const BLOBS: readonly Blob[] = [
  { top: 18, left: 6, size: 30, blur: 2, hueShift: 56, alpha: 0.85, duration: 9.0, delay: -0.4 },
  { top: 62, left: 3, size: 22, blur: 5, hueShift: 14, alpha: 0.6, duration: 11.5, delay: -3.1 },
  { top: 38, left: 12, size: 38, blur: 0, hueShift: 84, alpha: 0.9, duration: 8.2, delay: -1.7 },
  { top: 78, left: 16, size: 26, blur: 3, hueShift: 290, alpha: 0.7, duration: 12.4, delay: -5.2 },
  { top: 8, left: 22, size: 20, blur: 6, hueShift: 42, alpha: 0.55, duration: 10.1, delay: -2.3 },
  { top: 52, left: 26, size: 34, blur: 1, hueShift: 98, alpha: 0.88, duration: 9.6, delay: -6.0 },
  { top: 86, left: 31, size: 24, blur: 4, hueShift: 332, alpha: 0.65, duration: 13.0, delay: -0.9 },
  { top: 24, left: 36, size: 28, blur: 2, hueShift: 70, alpha: 0.8, duration: 8.8, delay: -4.4 },
  { top: 66, left: 42, size: 19, blur: 7, hueShift: 28, alpha: 0.5, duration: 11.9, delay: -2.8 },
  { top: 14, left: 47, size: 33, blur: 0, hueShift: 112, alpha: 0.92, duration: 9.3, delay: -7.1 },
  { top: 48, left: 52, size: 23, blur: 5, hueShift: 304, alpha: 0.62, duration: 12.7, delay: -1.2 },
  { top: 82, left: 56, size: 30, blur: 2, hueShift: 63, alpha: 0.84, duration: 8.5, delay: -5.8 },
  { top: 30, left: 61, size: 21, blur: 6, hueShift: 21, alpha: 0.56, duration: 10.8, delay: -3.6 },
  { top: 70, left: 66, size: 36, blur: 1, hueShift: 91, alpha: 0.9, duration: 9.9, delay: -0.2 },
  { top: 10, left: 71, size: 25, blur: 4, hueShift: 346, alpha: 0.68, duration: 12.1, delay: -6.5 },
  { top: 56, left: 76, size: 29, blur: 2, hueShift: 77, alpha: 0.86, duration: 8.9, delay: -2.0 },
  { top: 88, left: 80, size: 18, blur: 7, hueShift: 35, alpha: 0.48, duration: 13.4, delay: -4.9 },
  { top: 34, left: 84, size: 32, blur: 0, hueShift: 105, alpha: 0.91, duration: 9.1, delay: -1.5 },
  { top: 74, left: 89, size: 22, blur: 5, hueShift: 318, alpha: 0.6, duration: 11.2, delay: -7.6 },
  { top: 20, left: 93, size: 27, blur: 3, hueShift: 49, alpha: 0.78, duration: 10.4, delay: -3.3 },
  { top: 58, left: 96, size: 20, blur: 6, hueShift: 7, alpha: 0.52, duration: 12.9, delay: -5.5 },
  { top: 44, left: 19, size: 17, blur: 8, hueShift: 84, alpha: 0.44, duration: 14.0, delay: -0.7 },
];

/** How far the pill turns toward the pointer, in degrees. */
const MAX_TILT_DEG = 26;
/** Distance in pixels over which the pointer still influences the tilt. */
const INFLUENCE_PX = 620;
/** Per-second convergence for the eased follow. */
const TILT_LAMBDA = 5.5;

export function LiquidButton({ href, children, external = false, className }: LiquidButtonProps) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const handleMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };

    window.addEventListener('pointermove', handleMove, { passive: true });

    let rotX = 0;
    let rotY = 0;
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

      root.style.setProperty('--rot-x', `${rotX.toFixed(3)}deg`);
      root.style.setProperty('--rot-y', `${rotY.toFixed(3)}deg`);
      // Specular slides opposite the tilt, as a highlight on a curved face does.
      root.style.setProperty('--shine-x', `${(50 - rotY * 1.6).toFixed(2)}%`);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
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
              // Seconds into the shared 9s cycle, precomputed: a calc()
              // dividing an angle to derive a delay is not valid, so every
              // blob silently took delay 0 and the field turned as one.
              '--spectrum-delay': `${-(blob.hueShift / 360) * 9}s`,
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
      {/* The underside sits behind the face in Z. Tilting then reveals an edge,
          which is what makes the pill read as a solid rather than a sheet. */}
      <span className={styles.underside} aria-hidden="true" />
      <span className={styles.tilt}>
        {field}
        <span className={styles.gloss} aria-hidden="true" />
        <span className={styles.label}>{children}</span>
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
