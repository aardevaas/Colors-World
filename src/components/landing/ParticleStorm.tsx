'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Vector3,
  type Camera,
  type IUniform,
} from 'three';
import { buildParticleBuffers } from '@/lib/landing/build-particle-buffers';
import {
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
} from '@/lib/landing/particle-shaders';
import { EXPLOSION_DURATION_SECONDS } from '@/lib/landing/explosion-timing';
import { rotateSpherePosition } from '@/lib/landing/rotate-sphere-position';
import type { ScrollState } from '@/lib/landing/use-scroll-progress';

export interface HoverInfo {
  readonly hex: string;
  /** NDC, -1..1 — left to the caller to convert to pixels, since only it
   *  knows the viewport it's actually positioning a tooltip against. */
  readonly ndcX: number;
  readonly ndcY: number;
}

interface ParticleStormProps {
  readonly scrollRef: RefObject<ScrollState>;
  readonly reducedMotion: boolean;
  readonly onHoverChange?: (hover: HoverInfo | null) => void;
  /** Fires once, at the moment a particle is picked — the caller owns what
   *  happens after (navigation timing lives in the caller, not here, so the
   *  shader's own explosion duration can never drift out of sync with it). */
  readonly onExplode?: (hex: string) => void;
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

/** Phase 3: the storm gathers into the globe across this scroll window. */
const MORPH_START = 0.42;
const MORPH_END = 0.72;
/** Interaction only makes sense once the shell has actually closed. */
const ASSEMBLED_THRESHOLD = 0.97;

/** How much a hard flick multiplies fall speed. */
const VELOCITY_DRIVE_GAIN = 0.7;

/** Frames-worth of smoothing on the speed term, so it never steps visibly. */
const SPEED_SMOOTHING = 0.08;

/** ~0.2 RPM — cinematic, closer to a slow pan than a spin. */
const ROTATION_RADIANS_PER_SECOND = 0.09;
/** Earth-like axial tilt, so the spin shows latitude as well as longitude. */
const AXIAL_TILT_RADIANS = (20 * Math.PI) / 180;
/** Halved while hovering, per the brief, so a precise click is easier to land. */
const HOVER_ROTATION_DAMPING = 0.5;

/** How close (in NDC) the pointer must be to a particle to hover/pick it. */
const HOVER_NDC_RADIUS = 0.035;
/** Re-run the O(n) pick every other frame — 30k projections at 60fps is
 *  already cheap, this is a conservative margin for low-end GPUs, not a
 *  measured necessity. */
const HOVER_SCAN_FRAME_STRIDE = 2;

/** Smoothstep's smoother cousin — zero 1st and 2nd derivatives at both ends,
 *  so the gather starts and settles without a perceptible kick. */
function smootherstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

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
  readonly uRotation: { value: number };
  readonly uTilt: { value: number };
  readonly uSphereRadius: { value: number };
  readonly uExplodeProgress: { value: number };
  readonly uHoveredIndexNorm: { value: number };
}

export function ParticleStorm({
  scrollRef,
  reducedMotion,
  onHoverChange,
  onExplode,
}: ParticleStormProps) {
  const pointsRef = useRef<Points>(null);
  const smoothedBoost = useRef(0);
  const rotation = useRef(0);
  const clockRef = useRef(0);
  const hoveredIndexRef = useRef<number | null>(null);
  const explodeStartRef = useRef<number | null>(null);
  const frameParity = useRef(0);
  const pickScratch = useMemo(() => new Vector3(), []);
  const viewport = useThree((state) => state.viewport);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

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
      uRotation: { value: 0 },
      uTilt: { value: AXIAL_TILT_RADIANS },
      uSphereRadius: { value: SPHERE_RADIUS },
      uExplodeProgress: { value: 0 },
      uHoveredIndexNorm: { value: -1 },
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

  /**
   * The vertex shader is the only place a particle's on-screen position
   * actually exists — `geometry.attributes.position` holds the dummy rain
   * seat, never the live sphere position, so three's built-in raycasting
   * against the mesh would silently hit-test the wrong data entirely. This
   * reimplements the shader's own rotation (via the tested
   * `rotateSpherePosition`) on the CPU and projects it through the real
   * camera instead, which is the only way to know where a particle actually
   * rendered this frame.
   */
  function pickNearestParticle(ndcX: number, ndcY: number, activeCamera: Camera): number | null {
    const radiusSq = HOVER_NDC_RADIUS * HOVER_NDC_RADIUS;
    let bestIndex: number | null = null;
    let bestZ = -Infinity;

    for (let i = 0; i < buffers.count; i += 1) {
      const sx = buffers.spherePos[i * 3] ?? 0;
      const sy = buffers.spherePos[i * 3 + 1] ?? 0;
      const sz = buffers.spherePos[i * 3 + 2] ?? 0;
      const rotated = rotateSpherePosition({ x: sx, y: sy, z: sz }, rotation.current, AXIAL_TILT_RADIANS);

      pickScratch.set(rotated.x, rotated.y, rotated.z).project(activeCamera);
      const dx = pickScratch.x - ndcX;
      const dy = pickScratch.y - ndcY;
      if (dx * dx + dy * dy > radiusSq) continue;

      // Among candidates within the hit radius, prefer the one nearer the
      // camera (larger world z, matching the shader's own near/far
      // convention) so a hover can't "reach through" the globe to a
      // particle on the far side.
      if (rotated.z > bestZ) {
        bestZ = rotated.z;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  // Click/tap handled as a native DOM listener rather than an R3F pointer
  // event on the mesh, for the same reason picking is manual: the mesh's
  // geometry doesn't represent where anything visually is.
  useEffect(() => {
    if (reducedMotion) return;
    const canvas = gl.domElement;

    function handleClick(event: MouseEvent) {
      if (explodeStartRef.current !== null) return; // one explosion per visit
      if (uniforms.uMorphProgress.value < ASSEMBLED_THRESHOLD) return;

      const rect = canvas.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      // Recomputed at the exact click position rather than trusting
      // whatever was last hovered — this is also what makes touch taps
      // work, since touch never produces a hover in the first place.
      const index = pickNearestParticle(ndcX, ndcY, camera);
      if (index === null) return;

      const hex = buffers.hex[index];
      if (hex === undefined) return;

      explodeStartRef.current = clockRef.current;
      hoveredIndexRef.current = null;
      uniforms.uHoveredIndexNorm.value = -1;
      onHoverChange?.(null);
      onExplode?.(hex);
    }

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pickNearestParticle closes over buffers/rotation refs that are stable for the component's lifetime; re-binding per render would just churn listeners for no behavioural change.
  }, [reducedMotion, gl, camera, buffers.hex, onExplode, onHoverChange, uniforms]);

  useFrame((state, delta) => {
    uniforms.uPixelRatio.value = viewport.dpr;
    clockRef.current = state.clock.elapsedTime;

    if (reducedMotion) {
      // Serene and static: the globe already assembled, held still. No fall,
      // no ramp, no spin, no explosion — the destination without the journey.
      uniforms.uTime.value = 0;
      uniforms.uScroll.value = 0;
      uniforms.uSpeedBoost.value = 0;
      uniforms.uVisibleFraction.value = 1;
      uniforms.uMorphProgress.value = 1;
      uniforms.uRotation.value = 0;
      uniforms.uExplodeProgress.value = 0;
      return;
    }

    uniforms.uTime.value = state.clock.elapsedTime;

    const scroll = scrollRef.current ?? { progress: 0, velocity: 0 };
    uniforms.uScroll.value = scroll.progress;

    // Reveal: 50 ambient cubes at rest, everything by STORM_FULL_AT.
    const heroFraction = HERO_PARTICLES / PARTICLE_COUNT;
    const ramp = Math.min(1, scroll.progress / STORM_FULL_AT);
    uniforms.uVisibleFraction.value = heroFraction + (1 - heroFraction) * ramp;

    // Flick-driven, not depth-driven: scrolling hard makes it storm, and
    // easing off lets it settle. Depth-driven read as relentless by
    // comparison, so it was dropped.
    const target = scroll.velocity * VELOCITY_DRIVE_GAIN;

    // Frame-rate independent smoothing, so a 144Hz display doesn't converge
    // nearly twice as fast as a 60Hz one.
    const smoothingAlpha = 1 - Math.pow(1 - SPEED_SMOOTHING, delta * 60);
    smoothedBoost.current += (target - smoothedBoost.current) * smoothingAlpha;
    uniforms.uSpeedBoost.value = smoothedBoost.current;

    // Phase 3 — the gather. Reversible by construction: this reads straight
    // off scroll position, so scrolling back up unwinds the globe into rain.
    const morph = smootherstep(MORPH_START, MORPH_END, scroll.progress);
    uniforms.uMorphProgress.value = morph;

    const exploding = explodeStartRef.current !== null;
    const assembled = morph >= ASSEMBLED_THRESHOLD;

    // Hover only makes sense on a fully-formed, non-exploding globe.
    if (assembled && !exploding) {
      frameParity.current = (frameParity.current + 1) % HOVER_SCAN_FRAME_STRIDE;
      if (frameParity.current === 0) {
        const index = pickNearestParticle(state.pointer.x, state.pointer.y, state.camera);
        if (index !== hoveredIndexRef.current) {
          hoveredIndexRef.current = index;
          if (index === null) {
            uniforms.uHoveredIndexNorm.value = -1;
            onHoverChange?.(null);
          } else {
            const hex = buffers.hex[index];
            const indexNorm = buffers.indexNorm[index];
            if (hex !== undefined && indexNorm !== undefined) {
              uniforms.uHoveredIndexNorm.value = indexNorm;
              onHoverChange?.({ hex, ndcX: state.pointer.x, ndcY: state.pointer.y });
            }
          }
        }
      }
    } else if (hoveredIndexRef.current !== null) {
      hoveredIndexRef.current = null;
      uniforms.uHoveredIndexNorm.value = -1;
      onHoverChange?.(null);
    }

    // Spin fades in with the gather, halves while hovering (for a steadier
    // click), and fades back out entirely once exploding — a scattering
    // field has no axis left to spin about.
    const hoverDamping = hoveredIndexRef.current !== null ? HOVER_ROTATION_DAMPING : 1;
    rotation.current += ROTATION_RADIANS_PER_SECOND * morph * hoverDamping * delta;
    uniforms.uRotation.value = rotation.current;

    // Phase 4 — the climax. A fixed-duration ramp from the moment of the
    // click; holds at 1 afterwards so the settled/drifting state persists
    // rather than resetting.
    if (exploding) {
      const elapsed = state.clock.elapsedTime - (explodeStartRef.current ?? 0);
      uniforms.uExplodeProgress.value = Math.min(1, elapsed / EXPLOSION_DURATION_SECONDS);
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}
