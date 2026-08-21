'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { roomPalette, seedHueFromRandom } from '@/lib/landing/room-palette';
import { useScrollProgress } from '@/lib/landing/use-scroll-progress';
import { resolveHudFade } from '@/lib/landing/scroll-fade';
import { RESTING_INTENSITY, rainIntensityAt, visibleDrops } from '@/lib/landing/rain';
import { HeroHud } from './HeroHud';
import { PaintRain } from './PaintRain';
import { ColorRooms } from './ColorRooms';
import styles from './landing.module.css';

/**
 * The landing page's client shell.
 *
 * The globe that used to live here is gone, along with the entire three.js
 * stack it needed. In its place is a fullscreen shader that pours the product's
 * name as wet paint and lets the visitor push it around — the hue is read off
 * the direction the surface faces, so moving the pointer is what produces the
 * color rather than merely revealing it.
 *
 * One seed hue is drawn per visit and travels from here into everything
 * downstream, so the spectrum in the hero and the colors the six rooms are
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


/** Stable on the server, replaced on mount. Randomising during render would
 *  hand the server and the client different colors and break hydration. */
const INITIAL_SEED_HUE = 262;

export function LandingExperience({ credibility, footer }: LandingExperienceProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const hudRef = useRef<HTMLDivElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [rainCount, setRainCount] = useState(() => visibleDrops(RESTING_INTENSITY));
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

  /*
   * One loop drives the whole sequence: the hero fades out, and the rain comes
   * up to replace it.
   *
   * Progress is measured in viewports scrolled from the top, not as a fraction
   * of the hero section. That matters — `useScrollProgress` divides by
   * (sectionHeight - viewportHeight), and the hero is exactly one viewport tall
   * since the globe was removed, so it was returning a flat 0 and the fade had
   * silently stopped happening at all.
   *
   * The fade goes straight to CSS variables rather than React state, because it
   * changes every frame. The rain cannot: how many drops exist is a render
   * decision. So it is quantised to the drop count and only committed when that
   * integer actually changes — around fifty renders across the whole page
   * instead of one per frame.
   */
  useEffect(() => {
    if (!motionEnabled) return;
    let frame = 0;
    let lastCount = -1;

    function tick() {
      frame = requestAnimationFrame(tick);
      const viewports = window.scrollY / Math.max(1, window.innerHeight);

      const hud = hudRef.current;
      if (hud !== null) {
        const fade = resolveHudFade(viewports);
        hud.style.setProperty('--copy-opacity', String(fade.copyOpacity));
        hud.style.setProperty('--cue-opacity', String(fade.cueOpacity));
        hud.style.setProperty('--copy-pointer', fade.copyPointerEvents);
      }

      const next = visibleDrops(rainIntensityAt(viewports));
      if (next !== lastCount) {
        lastCount = next;
        setRainCount(next);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [motionEnabled]);

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
        <PaintRain count={rainCount} rooms={rooms} reducedMotion={!motionEnabled} />
        <div className={styles.pinned}>
          {/* No props but the ref. The motion toggle lived in the top bar that
              has been removed, so motion now follows the OS preference alone —
              which is what `motionEnabled` is initialised from. */}
          <HeroHud ref={hudRef} />
        </div>
      </section>
      <ColorRooms rooms={rooms} />
      {credibility}
      {footer}
    </>
  );
}
