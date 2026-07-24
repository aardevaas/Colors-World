import type Matter from 'matter-js';
import { buildRainBlockSeeds, type RainBlockSeed } from './color-rain-variants';
import { drawRainBlock } from './draw-rain-block';
import { projectSpherePoint } from './sphere-projection';

/**
 * Two-phase, scroll-driven set piece below the Hero:
 *
 * 1. **Rain** (progress 0 → RAIN_PHASE_END) — each marquee hue is a
 *    "faucet": its shade variants fall under real Matter.js physics and
 *    pile up, spawn rate tied to scroll depth, not time.
 * 2. **Globe** (progress RAIN_PHASE_END → 1) — physics freezes the instant
 *    the rain phase ends (each block's last physics position becomes its
 *    migration start point), and every block eases into an assigned spot on
 *    a sphere via hand-rolled 3D→2D perspective projection (see
 *    sphere-projection.ts) — longitude = source hue, latitude = shade, so
 *    the assembled globe reads as colour-banded meridians. Further scroll
 *    keeps rotating it.
 *
 * Blocks that never got a chance to fall before the section handed off to
 * phase 2 (a very fast scroll) still get a slot on the globe — they just
 * start their migration from the centre with a slightly later arrival,
 * rather than being silently dropped.
 */

const RAIN_PHASE_END = 0.55;
const ASSEMBLE_PHASE_END = 0.82;
const ROTATION_TOTAL_RADIANS = Math.PI * 2.4;

const WALL_THICKNESS = 80;
const MIN_BLOCK_SIZE = 20;
const MAX_BLOCK_SIZE = 46;
const MAX_MIGRATION_DELAY = 0.3;
const LATE_ARRIVAL_DELAY = 0.4;
const GLOBE_RADIUS_FACTOR = 0.42;
const MAX_FRAME_DELTA_MS = 16.667;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(start: number, end: number, blend: number): number {
  return start + (end - start) * blend;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

interface FrozenPosition {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

interface LiveBlock {
  readonly seed: RainBlockSeed;
  readonly size: number;
  readonly cornerRadius: number;
  readonly theta: number;
  readonly phi: number;
  readonly migrationDelay: number;
  body: Matter.Body | null;
  frozen: FrozenPosition | null;
  lateArrival: boolean;
}

export function setupColorRain(
  matter: typeof Matter,
  section: HTMLElement,
  canvas: HTMLCanvasElement,
  marqueeHueSteps: readonly number[]
): () => void {
  const { Engine, Bodies, Composite, Body } = matter;

  const engine = Engine.create();
  engine.enableSleeping = true;

  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    return () => {};
  }

  let width = canvas.clientWidth;
  let height = canvas.clientHeight;

  function sizeCanvas(): void {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeCanvas();

  const floor = Bodies.rectangle(width / 2, height + WALL_THICKNESS / 2, width * 2, WALL_THICKNESS, {
    isStatic: true,
  });
  const leftWall = Bodies.rectangle(-WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height * 3, {
    isStatic: true,
  });
  const rightWall = Bodies.rectangle(width + WALL_THICKNESS / 2, height / 2, WALL_THICKNESS, height * 3, {
    isStatic: true,
  });
  Composite.add(engine.world, [floor, leftWall, rightWall]);

  const totalHues = Math.max(1, marqueeHueSteps.length);
  const seeds = buildRainBlockSeeds(marqueeHueSteps);
  const hueSlice = (Math.PI * 2) / totalHues;
  const latitudeSpan = Math.PI * 0.86;

  const liveBlocks: LiveBlock[] = seeds.map((seed) => {
    const size = MIN_BLOCK_SIZE + Math.random() * (MAX_BLOCK_SIZE - MIN_BLOCK_SIZE);
    const theta = seed.sourceHueIndex * hueSlice + (Math.random() - 0.5) * hueSlice * 0.6;
    const phi =
      (seed.shadeIndex / Math.max(1, seed.variantsPerHue - 1) - 0.5) * latitudeSpan +
      (Math.random() - 0.5) * 0.12;
    return {
      seed,
      size,
      cornerRadius: size * 0.18,
      theta,
      phi,
      migrationDelay: Math.random() * MAX_MIGRATION_DELAY,
      body: null,
      frozen: null,
      lateArrival: false,
    };
  });

  function activateBlock(block: LiveBlock): void {
    const columnWidth = width / totalHues;
    const x = (block.seed.sourceHueIndex + 0.5) * columnWidth + (Math.random() - 0.5) * columnWidth * 0.6;
    const body = Bodies.rectangle(x, -block.size, block.size, block.size, {
      restitution: 0.35,
      friction: 0.6,
      frictionAir: 0.001,
      chamfer: { radius: block.cornerRadius },
    });
    Body.setAngle(body, Math.random() * Math.PI);
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
    Composite.add(engine.world, body);
    block.body = body;
  }

  // --- scroll-progress-driven state machine ---
  let spawnBudget = 0;
  let maxProgressSeen = 0;
  let nextSpawnIndex = 0;
  let globePhaseStarted = false;
  const spawnRatePerProgressUnit = seeds.length / RAIN_PHASE_END;

  function currentProgress(): number {
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (total <= 0) return 1;
    return clamp01(-rect.top / total);
  }

  function beginGlobePhase(): void {
    globePhaseStarted = true;
    for (const block of liveBlocks) {
      if (block.body !== null) {
        block.frozen = { x: block.body.position.x, y: block.body.position.y, angle: block.body.angle };
        Composite.remove(engine.world, block.body);
        block.body = null;
      } else {
        block.lateArrival = true;
        block.frozen = { x: width / 2, y: height / 2, angle: Math.random() * Math.PI };
      }
    }
  }

  function handleScroll(): void {
    const progress = currentProgress();
    if (progress <= maxProgressSeen) return;

    if (!globePhaseStarted && progress >= RAIN_PHASE_END) {
      beginGlobePhase();
    }
    if (!globePhaseStarted) {
      spawnBudget += (progress - maxProgressSeen) * spawnRatePerProgressUnit;
    }
    maxProgressSeen = progress;
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // Pause the whole loop while the section is off-screen.
  let sectionVisible = true;
  const observer = new IntersectionObserver(
    (entries) => {
      sectionVisible = entries[0]?.isIntersecting ?? false;
    },
    { threshold: 0 }
  );
  observer.observe(section);

  function drawRainPhase(): void {
    if (ctx === null) return;
    ctx.clearRect(0, 0, width, height);
    for (const block of liveBlocks) {
      if (block.body === null) continue;
      drawRainBlock(ctx, {
        x: block.body.position.x,
        y: block.body.position.y,
        angle: block.body.angle,
        size: block.size,
        cornerRadius: block.cornerRadius,
        color: block.seed.swatch.hex,
      });
    }
  }

  function drawGlobePhase(): void {
    if (ctx === null) return;
    const assembleProgress = clamp01(
      (maxProgressSeen - RAIN_PHASE_END) / (ASSEMBLE_PHASE_END - RAIN_PHASE_END)
    );
    const rotation = clamp01((maxProgressSeen - RAIN_PHASE_END) / (1 - RAIN_PHASE_END)) * ROTATION_TOTAL_RADIANS;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * GLOBE_RADIUS_FACTOR;

    interface Renderable {
      readonly x: number;
      readonly y: number;
      readonly angle: number;
      readonly size: number;
      readonly cornerRadius: number;
      readonly color: string;
      readonly depth: number;
    }
    const renderables: Renderable[] = [];

    for (const block of liveBlocks) {
      if (block.frozen === null) continue;
      const delay = block.lateArrival ? LATE_ARRIVAL_DELAY : block.migrationDelay;
      const blend = easeOutCubic(clamp01((assembleProgress - delay) / Math.max(0.0001, 1 - delay)));
      const target = projectSpherePoint(block.theta, block.phi, rotation, radius, centerX, centerY);

      renderables.push({
        x: lerp(block.frozen.x, target.x, blend),
        y: lerp(block.frozen.y, target.y, blend),
        angle: block.frozen.angle,
        size: block.size * lerp(1, target.scale, blend),
        cornerRadius: block.cornerRadius,
        color: block.seed.swatch.hex,
        depth: lerp(0, target.z, blend),
      });
    }

    renderables.sort((a, b) => b.depth - a.depth);

    ctx.clearRect(0, 0, width, height);
    for (const renderable of renderables) drawRainBlock(ctx, renderable);
  }

  let frameId = 0;
  let lastTime = performance.now();

  function tick(time: number): void {
    frameId = requestAnimationFrame(tick);
    const delta = Math.min(MAX_FRAME_DELTA_MS, time - lastTime);
    lastTime = time;
    if (!sectionVisible) return;

    if (!globePhaseStarted) {
      while (spawnBudget >= 1 && nextSpawnIndex < liveBlocks.length) {
        const next = liveBlocks[nextSpawnIndex];
        if (next !== undefined) activateBlock(next);
        nextSpawnIndex += 1;
        spawnBudget -= 1;
      }
      Engine.update(engine, delta);
      drawRainPhase();
    } else {
      drawGlobePhase();
    }
  }
  frameId = requestAnimationFrame(tick);

  function handleResize(): void {
    sizeCanvas();
    Body.setPosition(floor, { x: width / 2, y: height + WALL_THICKNESS / 2 });
    Body.setPosition(leftWall, { x: -WALL_THICKNESS / 2, y: height / 2 });
    Body.setPosition(rightWall, { x: width + WALL_THICKNESS / 2, y: height / 2 });
  }
  window.addEventListener('resize', handleResize);

  return () => {
    cancelAnimationFrame(frameId);
    window.removeEventListener('scroll', handleScroll);
    window.removeEventListener('resize', handleResize);
    observer.disconnect();
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  };
}
