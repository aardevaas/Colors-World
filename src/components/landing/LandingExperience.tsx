'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useScrollProgress } from '@/lib/landing/use-scroll-progress';
import { resolveHudFade } from '@/lib/landing/scroll-fade';
import { HeroHud } from './HeroHud';
import styles from './landing.module.css';

/**
 * Phase 1 + 2 of the landing experience.
 *
 * The canvas is pinned (sticky) inside a tall section, so scrolling drives
 * the story while the visual holds the viewport — the same three
 * screen-heights of scroll that will later carry the globe morph and the
 * explosion. Those phases are already accounted for in the shader
 * (`uMorphProgress`) and the buffers (`aSpherePos`); they are switched off
 * rather than missing.
 */

/** Three full screen-heights of scroll, per the brief. */
const SECTION_HEIGHT_VH = 300;

const ParticleCanvas = dynamic(() => import('./ParticleCanvas'), {
  ssr: false,
  loading: () => <div className={styles.canvasFallback} />,
});

export function LandingExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);

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

  return (
    <section
      ref={sectionRef}
      className={styles.stage}
      style={{ height: `${SECTION_HEIGHT_VH}vh` }}
    >
      <div className={styles.pinned}>
        <ParticleCanvas scrollRef={scrollRef} reducedMotion={!motionEnabled} />
        <HeroHud
          ref={hudRef}
          motionEnabled={motionEnabled}
          onToggleMotion={() => setMotionEnabled((previous) => !previous)}
        />
      </div>
    </section>
  );
}
