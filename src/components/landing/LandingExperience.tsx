'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { EXPLOSION_DURATION_SECONDS } from '@/lib/landing/explosion-timing';
import { useScrollProgress } from '@/lib/landing/use-scroll-progress';
import { resolveHudFade } from '@/lib/landing/scroll-fade';
import { HeroHud } from './HeroHud';
import { FeatureCards } from './FeatureCards';
import type { HoverInfo } from './ParticleStorm';
import styles from './landing.module.css';

/**
 * The full landing experience, phases 1 through 5.
 *
 * The canvas is a fixed, viewport-covering backdrop for the whole page (see
 * landing.module.css's `.pinned`) — the 300vh `.stage` section drives the
 * scroll-linked story (storm, globe morph, rotation) entirely on its own
 * pacing.
 *
 * The feature cards are *not* ordinary scroll-reachable content — they
 * don't exist in the document at all until a click has actually exploded
 * the globe. Rendering them unconditionally right after `.stage` (the
 * original approach) meant they'd appear the moment someone scrolled past
 * 300vh regardless of whether they'd ever clicked, so a curious scroll
 * would show the cards laid directly over a fully intact, still-rotating,
 * unexploded globe — exactly the "sitting on top of the globe" mess this
 * was rewritten to fix. Gating the cards behind explosion state means
 * there's simply nowhere to scroll to until the story has actually reached
 * that point.
 */

/** Three full screen-heights of scroll, per the brief. */
const SECTION_HEIGHT_VH = 300;
/** A little slack past the shader's own climax before revealing the cards,
 *  so they never appear mid-explosion. */
const CARDS_REVEAL_DELAY_MS = (EXPLOSION_DURATION_SECONDS + 0.15) * 1000;

const ParticleCanvas = dynamic(() => import('./ParticleCanvas'), {
  ssr: false,
  loading: () => <div className={styles.canvasFallback} />,
});

export function LandingExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [pickedColorHex, setPickedColorHex] = useState<string | null>(null);
  const [cardsRevealed, setCardsRevealed] = useState(false);

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

  // Once the cards actually mount (the DOM they live in didn't exist a
  // moment ago), scroll to present them — otherwise "after the explosion we
  // show the cards" would require the visitor to already be scrolling
  // further on their own initiative to ever discover that anything changed.
  useEffect(() => {
    if (!cardsRevealed) return;
    cardsRef.current?.scrollIntoView({ behavior: motionEnabled ? 'smooth' : 'auto', block: 'start' });
  }, [cardsRevealed, motionEnabled]);

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
  // what's actually happening on screen. Picking a colour no longer navigates
  // anywhere by itself — it reveals the toolkit instead, and the picked
  // colour rides along into the Library card specifically, so choosing to
  // enter Library still carries it forward.
  function handleExplode(hex: string) {
    const hud = hudRef.current;
    const tooltip = hud?.querySelector<HTMLElement>('[data-tooltip]');
    if (tooltip !== null && tooltip !== undefined) tooltip.style.opacity = '0';

    setPickedColorHex(hex);
    window.setTimeout(() => setCardsRevealed(true), CARDS_REVEAL_DELAY_MS);
  }

  return (
    <>
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
      {cardsRevealed && (
        <div ref={cardsRef}>
          <FeatureCards pickedColorHex={pickedColorHex ?? undefined} />
        </div>
      )}
    </>
  );
}
