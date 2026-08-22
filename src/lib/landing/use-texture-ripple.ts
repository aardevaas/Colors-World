'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Lets the pointer disturb the texture of whichever band it is over.
 *
 * Writes three custom properties onto that band — `--rx`, `--ry` for where the
 * ripple originates, and `--ripple` for how hard the surface was stirred — and
 * leaves the rest to CSS. The stylesheet owns what a ripple looks like; this
 * owns only where and how strongly.
 *
 * ## Why no rAF loop
 *
 * The two hero buttons run one, because they animate continuously whether or
 * not the pointer moves. Nothing here does: the ripple's own motion is a CSS
 * animation, and the only thing this contributes is a position that changes
 * exactly when the pointer does. `pointermove` already coalesces to at most one
 * event per frame, so a loop would add a permanent frame cost to deliver the
 * same values. The easing that a damped follow would have given is a CSS
 * transition on the puck instead.
 *
 * ## Why one listener on the list
 *
 * Six bands, one listener, rather than an enter/leave pair each. `elementFromPoint`
 * is not needed — the event's own target already tells us which band it is in,
 * and walking up from it is cheaper and correct even when the pointer is over
 * the type rather than the band itself.
 */

/**
 * Pointer speed, in px/ms, treated as a fully stirred surface.
 *
 * Halved from 2.2. At that figure an ordinary move across a band produced a
 * fraction of the available disturbance and the effect was, in practice,
 * invisible — you had to flick at the room to see anything at all. An ordinary
 * pass of the cursor should stir the surface fully.
 */
const FULL_STRENGTH_SPEED = 1.1;

/** How fast the stirred-ness falls back to rest once the pointer settles. */
const DECAY_PER_MS = 0.0022;

export function useTextureRipple(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = ref.current;
    if (root === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let last: { x: number; y: number; t: number } | null = null;
    let strength = 0;

    const handleMove = (event: PointerEvent) => {
      const band = (event.target as Element | null)?.closest('li');
      if (band === null || band === undefined || !root.contains(band)) return;

      const now = event.timeStamp;
      const rect = band.getBoundingClientRect();

      if (last !== null) {
        const elapsed = Math.max(1, now - last.t);
        const speed = Math.hypot(event.clientX - last.x, event.clientY - last.y) / elapsed;
        // Decay first, then take the louder of the two, so a fast flick lands
        // at full strength while a slow drag settles rather than accumulating.
        strength = Math.max(
          0,
          Math.min(1, Math.max(strength - elapsed * DECAY_PER_MS, speed / FULL_STRENGTH_SPEED))
        );
      }
      last = { x: event.clientX, y: event.clientY, t: now };

      const element = band as HTMLElement;
      element.style.setProperty('--rx', `${(event.clientX - rect.left).toFixed(1)}px`);
      element.style.setProperty('--ry', `${(event.clientY - rect.top).toFixed(1)}px`);
      element.style.setProperty('--ripple', strength.toFixed(3));
    };

    const handleLeave = () => {
      last = null;
      strength = 0;
      for (const band of root.querySelectorAll('li')) {
        (band as HTMLElement).style.setProperty('--ripple', '0');
      }
    };

    root.addEventListener('pointermove', handleMove, { passive: true });
    root.addEventListener('pointerleave', handleLeave);

    return () => {
      root.removeEventListener('pointermove', handleMove);
      root.removeEventListener('pointerleave', handleLeave);
    };
  }, [ref]);
}
