'use client';

import { type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import type { ScrollState } from '@/lib/landing/use-scroll-progress';
import { ParticleStorm } from './ParticleStorm';
import styles from './landing.module.css';

interface ParticleCanvasProps {
  readonly scrollRef: RefObject<ScrollState>;
  readonly reducedMotion: boolean;
}

/**
 * Isolated so it can be dynamically imported with `ssr: false` — this is the
 * boundary that keeps three.js (~150kb gzipped on its own) out of the initial
 * bundle and off the critical path. The HUD around it still server-renders,
 * so the headline and CTAs are in the HTML for crawlers regardless.
 */
export default function ParticleCanvas({
  scrollRef,
  reducedMotion,
}: ParticleCanvasProps) {
  return (
    <Canvas
      className={styles.canvas}
      dpr={[1, 2]}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      camera={{ fov: 55, position: [0, 0, 9], near: 0.1, far: 100 }}
    >
      <color attach="background" args={['#050508']} />
      <ParticleStorm scrollRef={scrollRef} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
