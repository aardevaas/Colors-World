import type Matter from 'matter-js';
import { buildRainBlockSeeds, type RainBlockSeed } from './color-rain-variants';
import { drawRainBlock, drawSphereTile } from './draw-rain-block';
import { projectSpherePoint } from './sphere-projection';

/**
 * Two-phase, scroll-driven set piece below the Hero:
 *
 * 1. **Rain** (progress 0 → RAIN_PHASE_END) — each marquee hue is a
 *    "faucet": its shade variants fall under real Matter.js physics and
 *    pile up, spawn rate tied to scroll depth, not time.
 * 2. **Globe** (progress RAIN_PHASE_END → 1) — physics freezes the instant
 *    the rain phase ends (each block's last physics position becomes its
 *    migration start point), and every block "blooms" into a small cluster
 *    of surface tiles that ease onto assigned spots on a sphere via
 *    hand-rolled 3D→2D perspective projection (see sphere-projection.ts) —
 *    longitude = source hue, latitude = shade, laid out on a deterministic
 *    (no jitter) grid so the surface reads as clean, continuous rainbow
 *    bands rather than a scatter. Each grid cell blooms into a CLUSTER_GRID²
 *    cluster of tiles sized to overlap their neighbours, so the assembled
 *    globe is a dense, gapless surface rather than a handful of floating
 *    dots. Further scroll keeps rotating it.
 *
 * Blocks that never got a chance to fall before the section handed off to
 * phase 2 (a very fast scroll) still get their cluster of tiles on the
 * globe — they just start migrating from the centre with a slightly later
 * arrival, rather than being silently dropped.
 */

const RAIN_PHASE_END = 0.55;
const ASSEMBLE_PHASE_END = 0.82;
const ROTATION_TOTAL_RADIANS = Math.PI * 2.4;

const WALL_THICKNESS = 80;
const MIN_BLOCK_SIZE = 16;
const MAX_BLOCK_SIZE = 36;
const MAX_MIGRATION_DELAY = 0.3;
const LATE_ARRIVAL_DELAY = 0.4;
const GLOBE_RADIUS_FACTOR = 0.42;
const MAX_FRAME_DELTA_MS = 16.667;

/** Every (hue, shade) grid cell blooms into a CLUSTER_GRID x CLUSTER_GRID
 * patch of tiles at assembly time — this is what gives the sphere real
 * surface density instead of one dot per cell. */
const CLUSTER_GRID = 2;
/** How much each tile's diameter overlaps its notional cell — generously
 * over 1 so neighbouring tiles always overlap rather than risk a gap. */
const TILE_OVERLAP_FACTOR = 1.8;
const LATITUDE_SPAN = Math.PI * 0.86;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(start: number, end: number, blend: number): number {
  return start + (end - start) * blend;
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Centred fractional offsets for an N x N grid, e.g. N=2 -> [-0.25, 0.25]. */
function buildClusterFractions(gridSize: number): number[] {
  return Array.from({ length: gridSize }, (_, index) => (index + 0.5) / gridSize - 0.5);
}

interface SphereSlot {
  readonly theta: number;
  readonly phi: number;
}

interface FrozenPosition {
  readonly x: number;
  readonly y: number;
}

interface LiveBlock {
  readonly seed: RainBlockSeed;
  readonly size: number;
  readonly cornerRadius: number;
  readonly subTiles: readonly SphereSlot[];
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

  const seeds = buildRainBlockSeeds(marqueeHueSteps);
  const totalHues = Math.max(1, marqueeHueSteps.length);
  const shadeRings = Math.max(1, seeds[0]?.variantsPerHue ?? 1);
  const hueSlice = (Math.PI * 2) / totalHues;
  const phiStep = shadeRings > 1 ? LATITUDE_SPAN / (shadeRings - 1) : 0;
  const clusterFractions = buildClusterFractions(CLUSTER_GRID);

  const liveBlocks: LiveBlock[] = seeds.map((seed) => {
    const size = MIN_BLOCK_SIZE + Math.random() * (MAX_BLOCK_SIZE - MIN_BLOCK_SIZE);
    const cellTheta = seed.sourceHueIndex * hueSlice;
    const cellPhi = -LATITUDE_SPAN / 2 + seed.shadeIndex * phiStep;

    const subTiles: SphereSlot[] = [];
    for (const rowFraction of clusterFractions) {
      for (const colFraction of clusterFractions) {
        subTiles.push({
          theta: cellTheta + colFraction * hueSlice,
          phi: cellPhi + rowFraction * phiStep,
        });
      }
    }

    return {
      seed,
      size,
      cornerRadius: size * 0.18,
      subTiles,
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
        block.frozen = { x: block.body.position.x, y: block.body.position.y };
        Composite.remove(engine.world, block.body);
        block.body = null;
      } else {
        block.lateArrival = true;
        block.frozen = { x: width / 2, y: height / 2 };
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

    // Sized off the equator — the widest, most gap-prone ring — so every
    // other ring (naturally denser toward the poles) only ever overlaps
    // more, never less.
    const equatorialHueArc = radius * hueSlice;
    const phiArc = radius * phiStep;
    const cellDimension = Math.max(equatorialHueArc, phiArc);
    const finalTileRadius = (cellDimension / CLUSTER_GRID / 2) * TILE_OVERLAP_FACTOR;

    interface Renderable {
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly color: string;
      readonly depth: number;
    }
    const renderables: Renderable[] = [];

    for (const block of liveBlocks) {
      if (block.frozen === null) continue;
      const delay = block.lateArrival ? LATE_ARRIVAL_DELAY : block.migrationDelay;
      const blend = easeOutCubic(clamp01((assembleProgress - delay) / Math.max(0.0001, 1 - delay)));
      const startRadius = block.size / 2;

      for (const slot of block.subTiles) {
        const target = projectSpherePoint(slot.theta, slot.phi, rotation, radius, centerX, centerY);
        renderables.push({
          x: lerp(block.frozen.x, target.x, blend),
          y: lerp(block.frozen.y, target.y, blend),
          radius: Math.max(0, lerp(startRadius, finalTileRadius * target.scale, blend)),
          color: block.seed.swatch.hex,
          depth: lerp(0, target.z, blend),
        });
      }
    }

    renderables.sort((a, b) => b.depth - a.depth);

    ctx.clearRect(0, 0, width, height);
    for (const renderable of renderables) drawSphereTile(ctx, renderable);
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
