'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { EXPLOSION_DURATION_SECONDS } from '@/lib/landing/explosion-timing';
import { useScrollProgress } from '@/lib/landing/use-scroll-progress';
import { resolveHudFade } from '@/lib/landing/scroll-fade';
import { HeroHud } from './HeroHud';
import type { HoverInfo } from './ParticleStorm';
import styles from './landing.module.css';

/**
 * Phases 1 through 4 of the landing experience.
 *
 * The canvas is pinned (sticky) inside a tall section, so scrolling drives
 * the story while the visual holds the viewport — the same three
 * screen-heights of scroll carry the storm, the globe morph, and (via click)
 * the explosion.
 */

/** Three full screen-heights of scroll, per the brief. */
const SECTION_HEIGHT_VH = 300;
/** A little slack past the shader's own climax before navigating, so the
 *  page never cuts away mid-explosion. */
const NAVIGATE_DELAY_MS = (EXPLOSION_DURATION_SECONDS + 0.15) * 1000;

const ParticleCanvas = dynamic(() => import('./ParticleCanvas'), {
  ssr: false,
  loading: () => <div className={styles.canvasFallback} />,
});

export function LandingExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const router = useRouter();

  // Respect the OS preference by default; the HUD toggle overrides it in
  // either direction, so someone who wants the spectacle can opt back in.
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMotionEnabled(!query.matches);
    function handleChange(event: MediaQueryListEvent) {
      setMotionEnabled(!event.matches);
    }
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const scrollRef = useScrollProgress(sectionRef, motionEnabled);
  const hudRef = useRef<HTMLDivElement>(null);

  // Written straight to CSS variables from a frame loop rather than held in
  // React state: this changes every frame while scrolling, and re-rendering
  // the tree that often to fade some text would cost more than the particle
  // field does. Opacity-only, so it stays on the compositor.
  useEffect(() => {
    if (!motionEnabled) return;
    let frame = 0;
    function tick() {
      frame = requestAnimationFrame(tick);
      const hud = hudRef.current;
      if (hud === null) return;
      const fade = resolveHudFade(scrollRef.current?.progress ?? 0);
      hud.style.setProperty('--copy-opacity', String(fade.copyOpacity));
      hud.style.setProperty('--cue-opacity', String(fade.cueOpacity));
      hud.style.setProperty('--copy-pointer', fade.copyPointerEvents);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [motionEnabled, scrollRef]);

  // Hover, like the fade above, is written straight to the DOM rather than
  // held in React state — it can fire every couple of frames while the
  // pointer sits over the globe, and re-rendering the component tree for a
  // tooltip position is pure waste.
  function handleHoverChange(hover: HoverInfo | null) {
    const hud = hudRef.current;
    if (hud === null) return;
    const tooltip = hud.querySelector<HTMLElement>('[data-tooltip]');
    if (tooltip === null) return;

    if (hover === null) {
      tooltip.style.opacity = '0';
      return;
    }

    const pixelX = (hover.ndcX * 0.5 + 0.5) * window.innerWidth;
    const pixelY = (1 - (hover.ndcY * 0.5 + 0.5)) * window.innerHeight;
    tooltip.style.opacity = '1';
    tooltip.style.transform = `translate(${pixelX}px, ${pixelY}px)`;

    const hexLabel = tooltip.querySelector('[data-tooltip-hex]');
    if (hexLabel !== null) hexLabel.textContent = hover.hex.toUpperCase();
  }

  // The explosion's own timing lives with the shader (EXPLOSION_DURATION_SECONDS,
  // shared via explosion-timing.ts) so this can never fall out of step with
  // what's actually happening on screen.
  function handleExplode(hex: string) {
    const hud = hudRef.current;
    const tooltip = hud?.querySelector<HTMLElement>('[data-tooltip]');
    if (tooltip !== null && tooltip !== undefined) tooltip.style.opacity = '0';

    window.setTimeout(() => {
      router.push(`/library?color=${hex.replace('#', '')}`);
    }, NAVIGATE_DELAY_MS);
  }

  return (
    <section
      ref={sectionRef}
      className={styles.stage}
      style={{ height: `${SECTION_HEIGHT_VH}vh` }}
    >
      <div className={styles.pinned}>
        <ParticleCanvas
          scrollRef={scrollRef}
          reducedMotion={!motionEnabled}
          onHoverChange={handleHoverChange}
          onExplode={handleExplode}
        />
        <HeroHud
          ref={hudRef}
          motionEnabled={motionEnabled}
          onToggleMotion={() => setMotionEnabled((previous) => !previous)}
        />
      </div>
    </section>
  );
}
