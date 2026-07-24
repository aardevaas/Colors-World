'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BufferAttribute,
  BufferGeometry,
  NormalBlending,
  Points,
  Raycaster,
  ShaderMaterial,
  Vector2,
  type IUniform,
} from 'three';
import { buildParticleBuffers } from '@/lib/landing/build-particle-buffers';
import {
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
} from '@/lib/landing/particle-shaders';
import { CARDS_REVEAL_DELAY_SECONDS, EXPLOSION_DURATION_SECONDS } from '@/lib/landing/explosion-timing';
import {
  quatConjugate,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  quatToArray,
  rotateVector,
  type Quat,
} from '@/lib/landing/quaternion';
import { vec3Normalize, type Vec3 } from '@/lib/landing/vec3';
import {
  buildSphereBucketGrid,
  findNearestParticleNearPoint,
  raySphereIntersect,
} from '@/lib/landing/sphere-picking';
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

/** Phase 3: the storm gathers into the globe across this scroll window.
 *  Widened from an earlier 0.42-0.72 — the creation felt too quick. */
const MORPH_START = 0.42;
const MORPH_END = 0.88;
/** Interaction only makes sense once the shell has actually closed. */
const ASSEMBLED_THRESHOLD = 0.97;

/** How much a hard flick multiplies fall speed. */
const VELOCITY_DRIVE_GAIN = 0.7;

/** Frames-worth of smoothing on the speed term, so it never steps visibly. */
const SPEED_SMOOTHING = 0.08;

/** ~0.2 RPM — cinematic, closer to a slow pan than a spin. */
const ROTATION_RADIANS_PER_SECOND = 0.09;
/** Earth-like axial tilt — applied as a fixed roll after the Y-axis spin,
 *  exactly as the old rotateZ(rotateY(p, rotation), tilt) composed the two,
 *  just expressed as a quaternion product now (see TILT_QUAT below). */
const AXIAL_TILT_RADIANS = (20 * Math.PI) / 180;
/** Halved while hovering, per the brief, so a precise click is easier to land. */
const HOVER_ROTATION_DAMPING = 0.5;

const WORLD_Y: Vec3 = { x: 0, y: 1, z: 0 };
const WORLD_Z: Vec3 = { x: 0, y: 0, z: 1 };
/** Constant — computed once at module load, not per render. */
const TILT_QUAT: Quat = quatFromAxisAngle(WORLD_Z, AXIAL_TILT_RADIANS);

/** Re-run the pick every other frame — cheap now that it's a ray-sphere test
 *  plus a bucket lookup rather than a scan of every particle, but there's
 *  still no reason to do it on frames the mouse hasn't moved. */
const HOVER_SCAN_FRAME_STRIDE = 2;

/**
 * True trackball rotation — replaces the old two-knob "dx spins around
 * world Y, dy tilts around world Z" scheme, which is exactly what made the
 * globe not "fully 3D": those were the only two axes it could ever combine.
 * The drag axis is perpendicular to the drag direction in screen space
 * (standard virtual-trackball technique) and, because the camera only ever
 * dollies along Z and never rolls (see the zoom section below), screen
 * space and world space share the same X/Y orientation — so no separate
 * camera-space transform is needed.
 *
 * Sign convention here is derived (drag right -> the point facing the
 * camera moves right; drag down -> it moves down) and cross-checked against
 * quaternion.test.ts's own verified rotation directions, but — like the
 * Euler version's own comment said — this still can't be felt out visually
 * in this sandbox. Flip the axis's sign if it reads backwards live.
 */
const DRAG_RADIANS_PER_PIXEL = 0.006;
/** Below this total pointer travel, a press+release is a click, not a drag —
 *  otherwise every tap-to-explode would also nudge the globe by a pixel. */
const DRAG_DISTANCE_THRESHOLD_PX = 6;
/** Auto-rotation stays paused this long after a drag ends (once the glide
 *  below has also died down), then eases back in — resuming instantly would
 *  feel like the drag was ignored. */
const AUTO_ROTATION_RESUME_DELAY_SECONDS = 2;

/** Smoothness (brief §12, D5): a released drag keeps spinning and decays,
 *  rather than stopping dead the instant the pointer lifts. Velocity is
 *  approximated from the last pointermove delta rather than true dx/dt —
 *  pointermove doesn't fire on a fixed clock, and a live-tunable decay curve
 *  is a better use of effort than exact velocity integration for a feel-only
 *  parameter like this. */
const DRAG_GLIDE_DAMPING_PER_60FPS_FRAME = 0.92;
const DRAG_GLIDE_STOP_THRESHOLD = 0.02;

/**
 * Zoom (brief §12, D3): a camera dolly along Z, not drei's OrbitControls —
 * OrbitControls binds wheel globally, and this canvas is `position: fixed;
 * inset: 0` covering the whole viewport, so it would swallow page scroll
 * everywhere, including the scroll that drives the entire rain-to-globe
 * story. Gated to "assembled and not exploding" so scrolling still controls
 * the gather at every other point in the experience.
 */
const ZOOM_MIN_DISTANCE = 4.5;
const ZOOM_MAX_DISTANCE = 12;
const ZOOM_INITIAL_DISTANCE = 9; // matches ParticleCanvas's camera={{ position: [0, 0, 9] }}
const ZOOM_WHEEL_SENSITIVITY = 0.012;

/** Once the feature cards are on screen, the moving, saturated field behind
 *  them reads as noise the copy has to compete with — ease the whole field's
 *  colour brightness down rather than leaving it at full intensity forever. */
const BACKGROUND_DIM_DURATION_SECONDS = 5;
const BACKGROUND_DIM_TARGET = 0.25;

/** Smoothstep's smoother cousin — zero 1st and 2nd derivatives at both ends,
 *  so the gather starts and settles without a perceptible kick. */
function smootherstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  readonly uOrient: { value: [number, number, number, number] };
  readonly uExplodeProgress: { value: number };
  readonly uHoveredIndexNorm: { value: number };
  readonly uBrightness: { value: number };
}

export function ParticleStorm({
  scrollRef,
  reducedMotion,
  onHoverChange,
  onExplode,
}: ParticleStormProps) {
  const pointsRef = useRef<Points>(null);
  const smoothedBoost = useRef(0);
  const clockRef = useRef(0);
  const hoveredIndexRef = useRef<number | null>(null);
  const explodeStartRef = useRef<number | null>(null);
  const frameParity = useRef(0);
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndcScratch = useMemo(() => new Vector2(), []);
  const viewport = useThree((state) => state.viewport);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);

  // Auto-spin (advances on its own, per the scroll-driven gather) is kept
  // separate from the manual drag orientation rather than summed into one
  // accumulator — pausing auto-rotation during a drag is then just "don't
  // advance this one", with nothing to unwind afterwards. autoRotation is a
  // scalar recomputed into a fresh quaternion each frame (not accumulated by
  // repeated multiplication) specifically so it reproduces the exact,
  // already-tuned auto-spin feel from the Euler version. dragOrient is the
  // opposite: a genuinely accumulated quaternion, since free-axis drag has
  // no simpler scalar representation — this is where the "not fully 3D"
  // constraint actually lived before, and removing the constraint means
  // this one has to compose properly instead of being reset each frame.
  const autoRotation = useRef(0);
  const dragOrient = useRef<Quat>({ x: 0, y: 0, z: 0, w: 1 });
  const dragVelocity = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragLast = useRef<{ x: number; y: number } | null>(null);
  const dragDistance = useRef(0);
  const wasDragging = useRef(false);
  const autoRotationResumeAt = useRef(0);
  const zoomDistance = useRef(ZOOM_INITIAL_DISTANCE);

  function currentOrientation(): Quat {
    const spin = quatFromAxisAngle(WORLD_Y, autoRotation.current);
    const tiltedSpin = quatMultiply(TILT_QUAT, spin);
    return quatNormalize(quatMultiply(dragOrient.current, tiltedSpin));
  }

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

  // Built once from the unrotated seats — see sphere-picking.ts. Turns
  // picking from an O(particle count) scan into a bucket lookup plus a
  // handful of candidates (brief §12, D4).
  const bucketGrid = useMemo(
    () => buildSphereBucketGrid(buffers.spherePos, buffers.count, SPHERE_RADIUS),
    [buffers]
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
      uOrient: { value: [0, 0, 0, 1] },
      uExplodeProgress: { value: 0 },
      uHoveredIndexNorm: { value: -1 },
      uBrightness: { value: 1 },
    }),
    []
  );

  // Brief §12, D2: the globe's "too much white light" and "I can see
  // through it" were the same bug — additive blending with no depth
  // sorting, so the far side of the shell summed straight through the near
  // side instead of being occluded by it. Normal blending plus real depth
  // writing/testing means the depth buffer now genuinely occludes the far
  // side, which is also why the vertex shader's old depthFade/facing
  // workaround is gone rather than merely adjusted — there's nothing left
  // for it to compensate for.
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        blending: NormalBlending,
        uniforms: uniforms as unknown as Record<string, IUniform>,
      }),
    [uniforms]
  );

  /**
   * Ray-sphere intersection + bucket grid (brief §12, D4) — replaces the old
   * "project all 30k particles into NDC and take the nearest" scan. The
   * globe is a literal sphere, so a pointer ray can be intersected with it
   * analytically, the hit point inverse-rotated back into the unrotated
   * frame the buffers were built in, and resolved to a nearby lattice seat
   * via the bucket grid — a few dozen candidates, never all of them. This
   * is also exact rather than the old approach's radius-guessed NDC
   * tolerance, since it starts from an actual point on the sphere's
   * surface rather than a 2D screen distance.
   */
  function pickParticleAtNdc(ndcX: number, ndcY: number, orient: Quat): number | null {
    ndcScratch.set(ndcX, ndcY);
    raycaster.setFromCamera(ndcScratch, camera);
    const rayOrigin: Vec3 = {
      x: raycaster.ray.origin.x,
      y: raycaster.ray.origin.y,
      z: raycaster.ray.origin.z,
    };
    const rayDir: Vec3 = {
      x: raycaster.ray.direction.x,
      y: raycaster.ray.direction.y,
      z: raycaster.ray.direction.z,
    };

    const worldHit = raySphereIntersect(rayOrigin, rayDir, SPHERE_RADIUS);
    if (worldHit === null) return null;

    const localHit = rotateVector(worldHit, quatConjugate(orient));
    return findNearestParticleNearPoint(localHit, buffers.spherePos, bucketGrid);
  }

  /** Left-multiplies a small rotation derived from a screen-space drag delta
   *  into the accumulated drag orientation — this is the actual trackball,
   *  see the DRAG_RADIANS_PER_PIXEL comment above for the axis derivation. */
  function applyDragDelta(dx: number, dy: number) {
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-4) return;
    const angle = distance * DRAG_RADIANS_PER_PIXEL;
    const axis = vec3Normalize({ x: dy, y: dx, z: 0 });
    const delta = quatFromAxisAngle(axis, angle);
    dragOrient.current = quatNormalize(quatMultiply(delta, dragOrient.current));
  }

  // Click, drag-to-orbit, tap-to-explode, and wheel/pinch-to-zoom all
  // handled as native DOM listeners rather than R3F pointer events on the
  // mesh, for the same reason picking is manual: the mesh's geometry
  // doesn't represent where anything visually is.
  //
  // Click stays live even when reducedMotion is true — the globe is already
  // rendered fully assembled and static in that mode (see useFrame below),
  // and a visitor still needs a way to pick a colour and reveal the feature
  // cards. Only the drag-to-orbit and zoom listeners are skipped for reduced
  // motion; reorienting/zooming a globe that isn't supposed to be moving
  // doesn't fit the preference, and there is nothing for it to interact
  // with while static.
  useEffect(() => {
    const canvas = gl.domElement;

    function handleClick(event: MouseEvent) {
      // A drag that just ended still delivers a native 'click' on release —
      // suppress exactly that one so reorienting the globe never also
      // detonates it.
      if (wasDragging.current) {
        wasDragging.current = false;
        return;
      }
      if (explodeStartRef.current !== null) return; // one explosion per visit
      if (uniforms.uMorphProgress.value < ASSEMBLED_THRESHOLD) return;

      const rect = canvas.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      // Recomputed at the exact click position rather than trusting
      // whatever was last hovered — this is also what makes touch taps
      // work, since touch never produces a hover in the first place.
      const index = pickParticleAtNdc(ndcX, ndcY, currentOrientation());
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

    if (reducedMotion) {
      return () => canvas.removeEventListener('click', handleClick);
    }

    function handlePointerDown(event: PointerEvent) {
      if (explodeStartRef.current !== null) return;
      if (uniforms.uMorphProgress.value < ASSEMBLED_THRESHOLD) return;
      isDragging.current = true;
      dragDistance.current = 0;
      dragVelocity.current = { x: 0, y: 0 };
      dragLast.current = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    }

    function handlePointerMove(event: PointerEvent) {
      if (!isDragging.current || dragLast.current === null) return;
      const dx = event.clientX - dragLast.current.x;
      const dy = event.clientY - dragLast.current.y;
      dragLast.current = { x: event.clientX, y: event.clientY };
      dragDistance.current += Math.hypot(dx, dy);
      dragVelocity.current = { x: dx, y: dy };
      applyDragDelta(dx, dy);
    }

    function handlePointerUp(event: PointerEvent) {
      if (!isDragging.current) return;
      isDragging.current = false;
      dragLast.current = null;
      if (dragDistance.current > DRAG_DISTANCE_THRESHOLD_PX) {
        wasDragging.current = true;
        autoRotationResumeAt.current = clockRef.current + AUTO_ROTATION_RESUME_DELAY_SECONDS;
        // dragVelocity carries into the glide (see useFrame) as-is.
      } else {
        dragVelocity.current = { x: 0, y: 0 };
      }
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    }

    // Brief §12, D3: only ever intercepts the gesture while the globe is
    // assembled, not exploding, and not already at the outward zoom limit —
    // stopPropagation there specifically keeps Lenis (which listens on
    // window, in the bubble phase — see use-scroll-progress.ts) from also
    // reacting to the same wheel event as a page-scroll, which would zoom
    // and scroll at once. Releasing the event untouched at the limit is the
    // escape hatch: without it, reaching max zoom-out would trap the
    // visitor on a full-viewport canvas with no way to scroll back up.
    function handleWheel(event: WheelEvent) {
      if (explodeStartRef.current !== null) return;
      if (uniforms.uMorphProgress.value < ASSEMBLED_THRESHOLD) return;

      const proposed = zoomDistance.current + event.deltaY * ZOOM_WHEEL_SENSITIVITY;
      if (proposed > ZOOM_MAX_DISTANCE) return;

      event.preventDefault();
      event.stopPropagation();
      zoomDistance.current = clamp(proposed, ZOOM_MIN_DISTANCE, ZOOM_MAX_DISTANCE);
    }

    // Pinch-to-zoom: tracks the two-finger distance at pinch start and
    // scales the zoom distance by how much that distance has changed since.
    const pinchStartDistance = { current: null as number | null };
    const pinchStartZoom = { current: ZOOM_INITIAL_DISTANCE };

    function touchPairDistance(touches: TouchList): number | null {
      if (touches.length < 2) return null;
      const a = touches[0];
      const b = touches[1];
      if (a === undefined || b === undefined) return null;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    }

    function handleTouchStart(event: TouchEvent) {
      const distance = touchPairDistance(event.touches);
      if (distance === null) return;
      pinchStartDistance.current = distance;
      pinchStartZoom.current = zoomDistance.current;
    }

    function handleTouchMove(event: TouchEvent) {
      if (pinchStartDistance.current === null) return;
      if (explodeStartRef.current !== null) return;
      if (uniforms.uMorphProgress.value < ASSEMBLED_THRESHOLD) return;
      const distance = touchPairDistance(event.touches);
      if (distance === null) return;
      // Fingers spreading apart (distance grows) should zoom in (smaller
      // camera distance), hence start/current rather than current/start.
      const scale = pinchStartDistance.current / distance;
      zoomDistance.current = clamp(
        pinchStartZoom.current * scale,
        ZOOM_MIN_DISTANCE,
        ZOOM_MAX_DISTANCE
      );
      event.preventDefault();
    }

    function handleTouchEnd(event: TouchEvent) {
      if (event.touches.length < 2) pinchStartDistance.current = null;
    }

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pickParticleAtNdc/currentOrientation/applyDragDelta close over refs and buffers that are stable for the component's lifetime; re-binding per render would just churn listeners for no behavioural change.
  }, [reducedMotion, gl, camera, buffers.hex, onExplode, onHoverChange, uniforms]);

  useFrame((state, delta) => {
    uniforms.uPixelRatio.value = viewport.dpr;
    clockRef.current = state.clock.elapsedTime;

    // Timed off the click itself (not React's cardsRevealed state, which
    // this component has no reason to know about) so the fade can't drift
    // out of sync with the cards — CARDS_REVEAL_DELAY_SECONDS is the same
    // constant LandingExperience uses to decide when to mount them. Runs
    // ahead of the reducedMotion branch below since a click still reaches
    // this component in that mode too (see the click handler above).
    if (explodeStartRef.current !== null) {
      const revealAt = explodeStartRef.current + CARDS_REVEAL_DELAY_SECONDS;
      const dimT = clamp((state.clock.elapsedTime - revealAt) / BACKGROUND_DIM_DURATION_SECONDS, 0, 1);
      uniforms.uBrightness.value = 1 - smootherstep(0, 1, dimT) * (1 - BACKGROUND_DIM_TARGET);
    }

    if (reducedMotion) {
      // Serene and static: the globe already assembled, held still. No fall,
      // no ramp, no spin, no explosion — the destination without the journey.
      uniforms.uTime.value = 0;
      uniforms.uScroll.value = 0;
      uniforms.uSpeedBoost.value = 0;
      uniforms.uVisibleFraction.value = 1;
      uniforms.uMorphProgress.value = 1;
      const orientArray = uniforms.uOrient.value;
      orientArray[0] = TILT_QUAT.x;
      orientArray[1] = TILT_QUAT.y;
      orientArray[2] = TILT_QUAT.z;
      orientArray[3] = TILT_QUAT.w;
      uniforms.uExplodeProgress.value = 0;
      camera.position.z = ZOOM_INITIAL_DISTANCE;
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

    // Glide (brief §12, D5): a released drag keeps rotating and decays
    // rather than stopping dead. Only runs while not actively being
    // re-dragged; a fresh pointerdown zeroes the velocity anyway.
    const glideSpeed = Math.hypot(dragVelocity.current.x, dragVelocity.current.y);
    const isGliding = !isDragging.current && glideSpeed > DRAG_GLIDE_STOP_THRESHOLD;
    if (isGliding) {
      applyDragDelta(dragVelocity.current.x, dragVelocity.current.y);
      const decay = Math.pow(DRAG_GLIDE_DAMPING_PER_60FPS_FRAME, delta * 60);
      dragVelocity.current = {
        x: dragVelocity.current.x * decay,
        y: dragVelocity.current.y * decay,
      };
    }

    // Hover only makes sense on a fully-formed, non-exploding globe, and not
    // mid-drag — the pointer is busy reorienting, not inspecting.
    const orient = currentOrientation();
    if (assembled && !exploding && !isDragging.current) {
      frameParity.current = (frameParity.current + 1) % HOVER_SCAN_FRAME_STRIDE;
      if (frameParity.current === 0) {
        const index = pickParticleAtNdc(state.pointer.x, state.pointer.y, orient);
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
    // click), and pauses entirely while dragging, gliding, or for a couple
    // of seconds after the glide dies down — otherwise auto-spin would
    // immediately fight whatever angle was just dialed in by hand. Fades
    // back out entirely once exploding — a scattering field has no axis
    // left to spin about.
    const autoRotationPaused =
      isDragging.current || isGliding || state.clock.elapsedTime < autoRotationResumeAt.current;
    if (!autoRotationPaused) {
      const hoverDamping = hoveredIndexRef.current !== null ? HOVER_ROTATION_DAMPING : 1;
      autoRotation.current += ROTATION_RADIANS_PER_SECOND * morph * hoverDamping * delta;
    }

    const finalOrient = autoRotationPaused ? orient : currentOrientation();
    const orientArray = uniforms.uOrient.value;
    const [x, y, z, w] = quatToArray(finalOrient);
    orientArray[0] = x;
    orientArray[1] = y;
    orientArray[2] = z;
    orientArray[3] = w;

    // Zoom (brief §12, D3) — a plain camera dolly. The `9.0 / -mvPosition.z`
    // term already in the vertex shader's gl_PointSize makes points scale
    // correctly as the camera moves, with no shader change needed here.
    camera.position.z = zoomDistance.current;

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
