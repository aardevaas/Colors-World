'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  type IUniform,
} from 'three';
import { buildParticleBuffers } from '@/lib/landing/build-particle-buffers';
import {
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
} from '@/lib/landing/particle-shaders';
import type { ScrollState } from '@/lib/landing/use-scroll-progress';

export type StormDrive = 'velocity' | 'progress';

interface ParticleStormProps {
  readonly scrollRef: RefObject<ScrollState>;
  readonly drive: StormDrive;
  readonly reducedMotion: boolean;
}

const PARTICLE_COUNT = 30_000;
const SPHERE_RADIUS = 2.6;
const FIELD_WIDTH = 16;
const FIELD_DEPTH = 7;
const FIELD_HEIGHT = 13;

/** Phase 1's "sparse trickle" — a stable subset of the same 30k system. */
const HERO_PARTICLES = 50;
/** Scroll fraction by which the storm is at full density (Phase 2 complete). */
const STORM_FULL_AT = 0.4;

/** How much a hard flick multiplies fall speed, in 'velocity' mode. */
const VELOCITY_DRIVE_GAIN = 0.7;
/** How much depth-of-scroll multiplies fall speed, in 'progress' mode. */
const PROGRESS_DRIVE_GAIN = 0.5;

/** Frames-worth of smoothing on the speed term, so it never steps visibly. */
const SPEED_SMOOTHING = 0.08;

/**
 * Held as a typed object rather than reached for through the material's
 * index-signature `uniforms` record — every write below is then checked, and
 * a renamed uniform becomes a compile error instead of a silent no-op that
 * would stay invisible until someone noticed the field had stopped reacting.
 * three's own type wants an index signature, so the cast is confined to the
 * single point where the object is handed over.
 */
interface StormUniforms {
  readonly uTime: { value: number };
  readonly uScroll: { value: number };
  readonly uPixelRatio: { value: number };
  readonly uVisibleFraction: { value: number };
  readonly uSpeedBoost: { value: number };
  readonly uFieldHeight: { value: number };
  readonly uMorphProgress: { value: number };
}

export function ParticleStorm({ scrollRef, drive, reducedMotion }: ParticleStormProps) {
  const pointsRef = useRef<Points>(null);
  const smoothedBoost = useRef(0);
  const viewport = useThree((state) => state.viewport);

  const buffers = useMemo(
    () =>
      buildParticleBuffers({
        count: PARTICLE_COUNT,
        sphereRadius: SPHERE_RADIUS,
        fieldWidth: FIELD_WIDTH,
        fieldDepth: FIELD_DEPTH,
      }),
    []
  );

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    // `position` is never read by the vertex shader — every real coordinate
    // is computed there — but three needs one to know the draw count.
    geo.setAttribute('position', new BufferAttribute(buffers.rainStart, 3));
    geo.setAttribute('aRainStart', new BufferAttribute(buffers.rainStart, 3));
    geo.setAttribute('aSpherePos', new BufferAttribute(buffers.spherePos, 3));
    geo.setAttribute('aColor', new BufferAttribute(buffers.color, 3));
    geo.setAttribute('aSpeed', new BufferAttribute(buffers.speed, 1));
    geo.setAttribute('aSize', new BufferAttribute(buffers.size, 1));
    geo.setAttribute('aIndexNorm', new BufferAttribute(buffers.indexNorm, 1));
    return geo;
  }, [buffers]);

  const uniforms = useMemo<StormUniforms>(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPixelRatio: { value: 1 },
      uVisibleFraction: { value: HERO_PARTICLES / PARTICLE_COUNT },
      uSpeedBoost: { value: 0 },
      uFieldHeight: { value: FIELD_HEIGHT },
      uMorphProgress: { value: 0 },
    }),
    []
  );

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: uniforms as unknown as Record<string, IUniform>,
      }),
    [uniforms]
  );

  useFrame((state, delta) => {
    uniforms.uPixelRatio.value = viewport.dpr;

    if (reducedMotion) {
      // Serene, static, fully-formed field — no fall, no ramp, no flicker.
      uniforms.uTime.value = 0;
      uniforms.uScroll.value = 0;
      uniforms.uSpeedBoost.value = 0;
      uniforms.uVisibleFraction.value = 1;
      return;
    }

    uniforms.uTime.value = state.clock.elapsedTime;

    const scroll = scrollRef.current ?? { progress: 0, velocity: 0 };
    uniforms.uScroll.value = scroll.progress;

    // Reveal: 50 ambient cubes at rest, everything by STORM_FULL_AT.
    const heroFraction = HERO_PARTICLES / PARTICLE_COUNT;
    const ramp = Math.min(1, scroll.progress / STORM_FULL_AT);
    uniforms.uVisibleFraction.value = heroFraction + (1 - heroFraction) * ramp;

    // The Q14 comparison, live: flick-driven vs depth-driven acceleration.
    const target =
      drive === 'velocity'
        ? scroll.velocity * VELOCITY_DRIVE_GAIN
        : scroll.progress * PROGRESS_DRIVE_GAIN;

    // Frame-rate independent smoothing, so a 144Hz display doesn't converge
    // nearly twice as fast as a 60Hz one.
    const alpha = 1 - Math.pow(1 - SPEED_SMOOTHING, delta * 60);
    smoothedBoost.current += (target - smoothedBoost.current) * alpha;
    uniforms.uSpeedBoost.value = smoothedBoost.current;
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}
