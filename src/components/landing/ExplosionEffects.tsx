'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer } from '@react-three/postprocessing';
import type { ChromaticAberrationEffect } from 'postprocessing';

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
  const effectRef = useRef<ChromaticAberrationEffect>(null);
  const mountTime = useRef<number | null>(null);

  useFrame((state) => {
    const effect = effectRef.current;
    if (effect === null) return;
    if (mountTime.current === null) mountTime.current = state.clock.elapsedTime;

    const elapsed = state.clock.elapsedTime - mountTime.current;
    const decay = Math.max(0, 1 - elapsed / ABERRATION_DECAY_SECONDS);
    const magnitude = ABERRATION_PEAK * decay;
    effect.offset.set(magnitude, magnitude);
  });

  return <ChromaticAberration ref={effectRef} offset={[ABERRATION_PEAK, ABERRATION_PEAK]} />;
}

export function ExplosionEffects() {
  return (
    <EffectComposer>
      <Bloom intensity={1.4} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur />
      <AnimatedChromaticAberration />
    </EffectComposer>
  );
}
