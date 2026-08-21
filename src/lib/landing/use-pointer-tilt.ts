'use client';

import { useEffect, type RefObject } from 'react';

/**
 * The shared hover behaviour for the two hero CTAs.
 *
 * Both buttons now move identically. They did not before: the liquid pill had
 * a pointer-tracked 3D tilt and the prism pill had nothing at all, so the pair
 * felt like two unrelated controls sitting next to each other.
 *
 * Writes `--rot-x`, `--rot-y` and `--shine-x` onto the element from a rAF loop.
 * The CSS decides what to do with them, so each button can still look like
 * itself while behaving the same way.
 */

/** How far the pill turns toward the pointer, in degrees. */
export const MAX_TILT_DEG = 26;
/** Distance in pixels over which the pointer still influences the tilt. */
export const INFLUENCE_PX = 620;
/** Per-second convergence for the eased follow. Lower is heavier. */
export const TILT_LAMBDA = 5.5;

export function usePointerTilt(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const pointer = { x: 0, y: 0 };
    const handleMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
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

      const rect = node.getBoundingClientRect();
      if (rect.width === 0) return;

      const dx = pointer.x - (rect.left + rect.width / 2);
      const dy = pointer.y - (rect.top + rect.height / 2);

      // Falls off with distance, so a pointer on the far side of the page
      // leaves the pill near rest rather than pinned at full tilt.
      const influence = Math.max(0, 1 - Math.hypot(dx, dy) / INFLUENCE_PX);

      // Saturates within about half a button-width. A wider mapping left the
      // pill barely moving while the cursor was on it, which is exactly when
      // it should be at its most angled.
      const wantY = clamp(dx / (rect.width * 0.45), -1, 1) * MAX_TILT_DEG * influence;
      const wantX = -clamp(dy / (rect.height * 0.9), -1, 1) * MAX_TILT_DEG * influence;

      // A slow sway underneath, so neither button is ever completely static.
      const sway = now / 1000;
      const idleY = Math.sin(sway / 3.7) * 5.5;
      const idleX = Math.sin(sway / 5.3) * 3.0;

      rotX = damp(rotX, wantX + idleX, TILT_LAMBDA, dt);
      rotY = damp(rotY, wantY + idleY, TILT_LAMBDA, dt);

      node.style.setProperty('--rot-x', `${rotX.toFixed(3)}deg`);
      node.style.setProperty('--rot-y', `${rotY.toFixed(3)}deg`);
      // Specular slides opposite the tilt, as a highlight on a curved face does.
      node.style.setProperty('--shine-x', `${(50 - rotY * 1.6).toFixed(2)}%`);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
    };
  }, [ref]);
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
