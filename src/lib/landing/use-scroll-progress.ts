'use client';

import { useEffect, useRef, type RefObject } from 'react';
import Lenis from 'lenis';

/**
 * One scroll context for the whole page: Lenis smooths the real document
 * scroll, and this reports how far through a given pinned section we are.
 *
 * Deliberately *not* drei's <ScrollControls>. That mounts its own scrollable
 * container and intercepts wheel events — as does Lenis — so running both
 * double-smooths and the two fight over the same gesture. Driving uniforms
 * from the real document scroll keeps a single source of truth, and keeps
 * working when the page continues past the canvas into ordinary content.
 *
 * Values are written into a ref rather than React state on purpose: this
 * updates every frame, and re-rendering the tree 120 times a second to move
 * a particle field would cost far more than the field itself.
 */

export interface ScrollState {
  /** 0 at the moment the section's top hits the viewport top, 1 at its end. */
  progress: number;
  /** Normalised, smoothed |velocity|. ~0 idle, ~1 during a hard flick. */
  velocity: number;
}

/** Velocity in px/frame that we treat as "flat out" for the storm. */
const VELOCITY_AT_FULL_TILT = 45;
/** How fast the velocity reading falls back to zero once scrolling stops. */
const VELOCITY_DECAY = 0.06;

export function useScrollProgress(
  sectionRef: RefObject<HTMLElement | null>,
  enabled: boolean
): RefObject<ScrollState> {
  const stateRef = useRef<ScrollState>({ progress: 0, velocity: 0 });

  useEffect(() => {
    if (!enabled) {
      stateRef.current = { progress: 0, velocity: 0 };
      return;
    }

    const lenis = new Lenis({
      duration: 1.05,
      // Slightly past-1 exponent gives weight without feeling laggy.
      easing: (t: number) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
    });

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    function readProgress(): number {
      const section = sectionRef.current;
      if (section === null) return 0;
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return 0;
      return Math.min(1, Math.max(0, -rect.top / scrollable));
    }

    function handleScroll({ velocity }: { velocity: number }) {
      const normalised = Math.min(1, Math.abs(velocity) / VELOCITY_AT_FULL_TILT);
      stateRef.current = {
        progress: readProgress(),
        // Only ever jump *up* to a new peak here; the decay below walks it
        // back down, so a flick spikes hard and then eases off instead of
        // snapping to zero the instant the wheel stops.
        velocity: Math.max(stateRef.current.velocity, normalised),
      };
    }

    lenis.on('scroll', handleScroll);

    const decay = window.setInterval(() => {
      const current = stateRef.current;
      if (current.velocity > 0) {
        stateRef.current = {
          progress: current.progress,
          velocity: Math.max(0, current.velocity - VELOCITY_DECAY),
        };
      }
    }, 16);

    // Seed it, so a reload partway down the page is already correct.
    stateRef.current = { progress: readProgress(), velocity: 0 };

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(decay);
      lenis.off('scroll', handleScroll);
      lenis.destroy();
    };
  }, [sectionRef, enabled]);

  return stateRef;
}
