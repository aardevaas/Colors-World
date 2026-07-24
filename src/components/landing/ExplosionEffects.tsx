'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import { Vector2 } from 'three';

/**
 * Mounted only for the ~1s explosion climax (see ParticleCanvas) — never
 * present during the rain, the globe, or the settled stardust, so the extra
 * render pass never costs anything outside that one moment.
 *
 * Bloom is inherently "selective" here without any masking work: it only
 * touches pixels the WebGL canvas actually drew, and the HUD/feature-card
 * copy is separate DOM sitting in its own stacking layer on top of it.
 */

/** Decays to 0 well inside the climax, so the aberration reads as an impact
 *  rather than a lingering lens distortion. */
const ABERRATION_DECAY_SECONDS = 0.5;
const ABERRATION_PEAK = 0.0045;

function AnimatedChromaticAberration() {
  // Owned directly (not read back through a ref to the effect instance):
  // `ChromaticAberrationEffect` stores whatever it's given in its `offset`
  // uniform without coercing it, so this must already be a real `Vector2` —
  // a plain `[x, y]` tuple silently becomes the stored value with no `.set`.
  // Mutating our own instance in place also means never touching a `ref` to
  // the underlying effect: `@react-three/postprocessing`'s wrapper keys its
  // constructor-arg memo off `JSON.stringify(props)`, and under React 19 an
  // unforwarded `ref` prop rides along inside that object — once the ref
  // holds the live (circularly self-referencing) effect instance, any
  // upstream re-render during the explosion (PerformanceMonitor's
  // decline/incline flip-flops are tuned to land in exactly this window)
  // throws trying to serialize it.
  const offset = useMemo(() => new Vector2(ABERRATION_PEAK, ABERRATION_PEAK), []);
  const mountTime = useRef<number | null>(null);

  useFrame((state) => {
    if (mountTime.current === null) mountTime.current = state.clock.elapsedTime;

    const elapsed = state.clock.elapsedTime - mountTime.current;
    const decay = Math.max(0, 1 - elapsed / ABERRATION_DECAY_SECONDS);
    const magnitude = ABERRATION_PEAK * decay;
    offset.set(magnitude, magnitude);
  });

  return <ChromaticAberration offset={offset} />;
}

export function ExplosionEffects() {
  return (
    <EffectComposer>
      <Bloom intensity={1.4} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
      <AnimatedChromaticAberration />
    </EffectComposer>
  );
}
