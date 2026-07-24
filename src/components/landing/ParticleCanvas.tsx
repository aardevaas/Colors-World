'use client';

import { useEffect, useState, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { EXPLOSION_DURATION_SECONDS } from '@/lib/landing/explosion-timing';
import type { ScrollState } from '@/lib/landing/use-scroll-progress';
import { ParticleStorm, type HoverInfo } from './ParticleStorm';
import { ExplosionEffects } from './ExplosionEffects';
import styles from './landing.module.css';

interface ParticleCanvasProps {
  readonly scrollRef: RefObject<ScrollState>;
  readonly reducedMotion: boolean;
  readonly onHoverChange?: (hover: HoverInfo | null) => void;
  readonly onExplode?: (hex: string) => void;
}

/** A little past the shader's own climax, so the effect never visibly
 *  unmounts mid-decay. */
const POST_PROCESSING_WINDOW_MS = (EXPLOSION_DURATION_SECONDS + 0.3) * 1000;

/**
 * Isolated so it can be dynamically imported with `ssr: false` — this is the
 * boundary that keeps three.js (~150kb gzipped on its own) out of the initial
 * bundle and off the critical path. The HUD around it still server-renders,
 * so the headline and CTAs are in the HTML for crawlers regardless.
 */
export default function ParticleCanvas({
  scrollRef,
  reducedMotion,
  onHoverChange,
  onExplode,
}: ParticleCanvasProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [postProcessingAllowed, setPostProcessingAllowed] = useState(true);
  const [explosionActive, setExplosionActive] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  function handleExplode(hex: string) {
    setExplosionActive(true);
    window.setTimeout(() => setExplosionActive(false), POST_PROCESSING_WINDOW_MS);
    onExplode?.(hex);
  }

  const showPostProcessing = explosionActive && !isTouchDevice && postProcessingAllowed;

  return (
    <Canvas
      className={styles.canvas}
      dpr={[1, 2]}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 55, position: [0, 0, 9], near: 0.1, far: 100 }}
    >
      <color attach="background" args={['#050508']} />
      {/* Bloom/chromatic aberration are the two heaviest passes in the whole
          experience — bypass them automatically if a device can't hold 50fps,
          rather than let a brief climax tank the frame rate. */}
      <PerformanceMonitor
        onDecline={() => setPostProcessingAllowed(false)}
        onIncline={() => setPostProcessingAllowed(true)}
        flipflops={3}
        factor={0.5}
        bounds={() => [50, 60]}
      />
      <ParticleStorm
        scrollRef={scrollRef}
        reducedMotion={reducedMotion}
        onHoverChange={onHoverChange}
        onExplode={handleExplode}
      />
      {showPostProcessing && <ExplosionEffects />}
    </Canvas>
  );
}
