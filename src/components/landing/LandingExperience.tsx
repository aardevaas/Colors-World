'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { roomPalette, seedHueFromRandom } from '@/lib/landing/room-palette';
import { useScrollProgress } from '@/lib/landing/use-scroll-progress';
import { resolveHudFade } from '@/lib/landing/scroll-fade';
import { HeroHud } from './HeroHud';
import { PaintRain } from './PaintRain';
import { FeatureCards } from './FeatureCards';
import styles from './landing.module.css';

/**
 * The landing page's client shell.
 *
 * The globe that used to live here is gone, along with the entire three.js
 * stack it needed. In its place is a fullscreen shader that pours the product's
 * name as wet paint and lets the visitor push it around — the hue is read off
 * the direction the surface faces, so moving the pointer is what produces the
 * colour rather than merely revealing it.
 *
 * One seed hue is drawn per visit and travels from here into everything
 * downstream, so the spectrum in the hero and the colours the six rooms are
 * painted in are the same system rather than two unrelated palettes.
 */

interface LandingExperienceProps {
  /**
   * The credibility strip and the footer, passed in from the page because they
   * are server components — this shell has to be a client component for the
   * WebGL and the scroll, and a client component cannot import a server one.
   */
  readonly credibility?: ReactNode;
  readonly footer?: ReactNode;
}

/**
 * How long the hero holds before the page moves on. Far shorter than the 300vh
 * the globe demanded: that pushed the six rooms — which are what this page is
 * actually for — down past three full screens before they were even named.
 */
// One viewport. The extra height existed to give the globe, and then the
// painted word, room to animate across a scroll. With neither of them here
// it was half a screen of empty space between the title and the rooms.
const SECTION_HEIGHT_VH = 100;

/** How hard it rains at the top of the page. Low on purpose — the brief is
 *  "very very lightly" until the visitor starts scrolling. */
const RESTING_RAIN = 0.34;

/** Stable on the server, replaced on mount. Randomising during render would
 *  hand the server and the client different colours and break hydration. */
const INITIAL_SEED_HUE = 262;

export function LandingExperience({ credibility, footer }: LandingExperienceProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [seedHue, setSeedHue] = useState(INITIAL_SEED_HUE);

  useEffect(() => {
    setSeedHue(seedHueFromRandom(Math.random()));
  }, []);

  // One palette, generated from the seed and shared by the hero and the rooms.
  const rooms = useMemo(() => roomPalette(seedHue), [seedHue]);

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

  // Written straight to CSS variables from a frame loop rather than held in
  // React state: this changes every frame while scrolling, and re-rendering
  // the tree that often to fade some text would cost more than the shader does.
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

  return (
    <>
      <section
        ref={sectionRef}
        className={styles.stage}
        style={{ height: `${SECTION_HEIGHT_VH}vh` }}
      >
        {/* Very sparse at rest. `intensity` is the dial the scroll work will
            take over — for now it sits at the resting value so the top of
            the page shows the odd drop rather than weather. */}
        <PaintRain intensity={RESTING_RAIN} rooms={rooms} reducedMotion={!motionEnabled} />
        <div className={styles.pinned}>
          <HeroHud
            ref={hudRef}
            motionEnabled={motionEnabled}
            onToggleMotion={() => setMotionEnabled((previous) => !previous)}
          />
        </div>
      </section>
      <FeatureCards rooms={rooms} />
      {credibility}
      {footer}
    </>
  );
}
