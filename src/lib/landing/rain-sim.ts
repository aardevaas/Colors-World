/**
 * The paint rain, as a simulation rather than a set of CSS keyframes.
 *
 * The rain used to be 150 spans each running its own `fall` animation. That is
 * the right build for weather that only has to fall — and the wrong one the
 * moment the drops have to interact with anything, because a CSS animation
 * cannot be told that something is in the way. Everything asked for here is
 * interaction: drops landing on the buttons and running off them, drops being
 * absorbed into one of them, and drops pooling into paint at the foot of the
 * page.
 *
 * So this owns the physics and nothing else. No DOM, no canvas, no React — the
 * caller passes in the world, steps it, and draws whatever it finds. That keeps
 * every rule below testable, which matters: none of this is verifiable by
 * looking at a screenshot, because it is all motion.
 *
 * ## On mutation
 *
 * The house rule is to return new objects rather than mutate. This module is
 * the deliberate exception, and the reason is arithmetic: 150 drops at 60fps is
 * 9,000 allocations a second for state that is overwritten immediately and
 * observed by nobody. The sim state is owned entirely by its caller, created by
 * `createWorld` and handed back on every step — there is no shared state to
 * corrupt, which is what the rule exists to prevent.
 */

/** Where a drop is in its life. */
export type DropPhase =
  /** In the air. */
  | 'falling'
  /** Sitting on a surface it landed on, about to run off. */
  | 'resting'
  /** Taken into an absorbing surface, drifting around inside it. */
  | 'absorbed'
  /** Merged into the paint at the foot of the page. */
  | 'pooled';

export interface SimDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Diameter, px. */
  size: number;
  /** Index into the room palette. */
  color: number;
  /** 0 near the glass, 1 far behind it. Drives blur and dimming. */
  depth: number;
  phase: DropPhase;
  /** Which surface it is on or inside, while resting or absorbed. */
  host: number;
  /** Milliseconds left of sitting still before it starts to run. */
  restLeft: number;
  /** Which way it will run off. -1 left, 1 right. */
  runoff: number;
}

/** A thing in the world the rain can land on. Viewport coordinates. */
export interface Surface {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  /** True for the one button that takes drops in rather than shedding them. */
  readonly absorbs: boolean;
}

export interface PoolColumn {
  /** Height of paint above the floor, px. */
  h: number;
  /** Vertical velocity of the surface, px/s. Waves live here. */
  v: number;
  /** Accumulated colour, 0-255. */
  r: number;
  g: number;
  b: number;
}

export interface World {
  readonly drops: SimDrop[];
  readonly pool: PoolColumn[];
  /** Viewport width the pool columns are spread across. */
  width: number;
  height: number;
  /** Distance from the top of the viewport to the floor paint collects on.
   *  Larger than `height` while the foot of the page is still below. */
  floor: number;
}

/* ------------------------------------------------------------------ physics */

/** px/s². Heavier than earth so drops read as paint rather than feathers. */
export const GRAVITY = 1500;
/** px/s. Without a terminal velocity the tall page turns drops into streaks. */
export const TERMINAL_VELOCITY = 1150;
/** How long a drop sits where it landed before it starts to run off, ms. */
export const REST_MS = 380;
/** px/s², sideways, once it starts running. */
export const RUNOFF_ACCEL = 420;
/** Sideways drift while falling, px/s. */
export const SWAY_SPEED = 26;

/** Columns the pool surface is sampled at. Enough for a wave to read as a
 *  curve, few enough that the whole field is a rounding error per frame. */
export const POOL_COLUMNS = 120;
/** How hard a column is pulled toward its neighbours. Governs wave speed. */
export const WAVE_TENSION = 26;
/** Per-second velocity retention. Below 1 or the pool never settles. */
export const WAVE_DAMPING = 0.86;
/** How much height a column shares with its neighbours per second. */
export const WAVE_SPREAD = 5.5;
/** Downward kick a landing drop gives the surface, px/s per px of drop. */
export const SPLASH = 2.6;
/** Ceiling on pool depth, px, so the page cannot be drowned.
 *  Kept below the footer's first line of text: the paint is meant to rise at
 *  the foot of the page, not to swallow what is written there. */
export const MAX_POOL = 165;

/* ------------------------------------------------------------------- world */

export function createPool(): PoolColumn[] {
  return Array.from({ length: POOL_COLUMNS }, () => ({ h: 0, v: 0, r: 0, g: 0, b: 0 }));
}

export function createWorld(width: number, height: number): World {
  return { drops: [], pool: createPool(), width, height, floor: height };
}

/* -------------------------------------------------------------------- step */

/**
 * Advances the world by `dt` seconds.
 *
 * `dt` is clamped by the caller; a tab returning from the background otherwise
 * hands this a delta of several seconds and every drop teleports through every
 * surface in one step.
 */
export function step(
  world: World,
  dt: number,
  surfaces: readonly Surface[],
  colors: readonly [number, number, number][]
): void {
  for (const drop of world.drops) {
    switch (drop.phase) {
      case 'falling':
        stepFalling(drop, dt, world, surfaces, colors);
        break;
      case 'resting':
        stepResting(drop, dt, surfaces);
        break;
      case 'absorbed':
        stepAbsorbed(drop, dt, surfaces);
        break;
      case 'pooled':
        break;
    }
  }
  stepPool(world, dt);
}

function stepFalling(
  drop: SimDrop,
  dt: number,
  world: World,
  surfaces: readonly Surface[],
  colors: readonly [number, number, number][]
): void {
  const previousBottom = drop.y + drop.size / 2;

  drop.vy = Math.min(TERMINAL_VELOCITY, drop.vy + GRAVITY * dt);
  drop.y += drop.vy * dt;
  drop.x += drop.vx * dt;

  const bottom = drop.y + drop.size / 2;

  // Surfaces first: a drop that would have passed through one this frame is
  // caught at it, tested against where it WAS rather than where it is, so a
  // fast drop cannot tunnel through a thin button.
  for (let i = 0; i < surfaces.length; i += 1) {
    const surface = surfaces[i];
    if (surface === undefined) continue;
    if (drop.x < surface.left || drop.x > surface.right) continue;
    if (previousBottom > surface.top || bottom < surface.top) continue;

    if (surface.absorbs) {
      drop.phase = 'absorbed';
      drop.host = i;
      // Enters travelling, and keeps a little of the speed it arrived with.
      drop.vx = (drop.vx + (drop.x < (surface.left + surface.right) / 2 ? 40 : -40)) * 0.4;
      drop.vy = drop.vy * 0.12;
      drop.y = surface.top + drop.size;
      return;
    }

    drop.phase = 'resting';
    drop.host = i;
    drop.y = surface.top - drop.size / 2;
    drop.vy = 0;
    drop.vx = 0;
    drop.restLeft = REST_MS;
    // Runs off whichever edge it landed nearer to, as water on a sill does.
    drop.runoff = drop.x < (surface.left + surface.right) / 2 ? -1 : 1;
    return;
  }

  if (bottom >= world.floor) {
    addToPool(world, drop, colors);
  }
}

function stepResting(drop: SimDrop, dt: number, surfaces: readonly Surface[]): void {
  const surface = surfaces[drop.host];
  if (surface === undefined) {
    drop.phase = 'falling';
    return;
  }

  // Sits, then runs. The pause is what makes it read as landing rather than
  // deflecting: paint hitting a surface stops before it moves.
  if (drop.restLeft > 0) {
    drop.restLeft -= dt * 1000;
    return;
  }

  drop.vx += RUNOFF_ACCEL * drop.runoff * dt;
  drop.x += drop.vx * dt;
  // Stays glued to the surface until it is genuinely past the edge.
  drop.y = surface.top - drop.size / 2;

  if (drop.x < surface.left - drop.size / 2 || drop.x > surface.right + drop.size / 2) {
    drop.phase = 'falling';
    drop.vy = 0;
  }
}

/**
 * Inside the absorbing surface, drifting and bouncing off its walls.
 *
 * Slowed heavily and given no gravity: the drop is suspended in the button, not
 * falling through it. Bouncing rather than wrapping so the motion stays legible
 * as one object moving around a space.
 */
function stepAbsorbed(drop: SimDrop, dt: number, surfaces: readonly Surface[]): void {
  const surface = surfaces[drop.host];
  if (surface === undefined) {
    drop.phase = 'falling';
    return;
  }

  drop.x += drop.vx * dt;
  drop.y += drop.vy * dt;

  const r = drop.size / 2;
  const inset = 2;
  if (drop.x - r < surface.left + inset) {
    drop.x = surface.left + inset + r;
    drop.vx = Math.abs(drop.vx);
  } else if (drop.x + r > surface.right - inset) {
    drop.x = surface.right - inset - r;
    drop.vx = -Math.abs(drop.vx);
  }
  if (drop.y - r < surface.top + inset) {
    drop.y = surface.top + inset + r;
    drop.vy = Math.abs(drop.vy);
  } else if (drop.y + r > surface.bottom - inset) {
    drop.y = surface.bottom - inset - r;
    drop.vy = -Math.abs(drop.vy);
  }

  // A slow wander, so a button holding several drops does not look like a
  // pinball table.
  drop.vx = clamp(drop.vx * 0.999 + (Math.sin(drop.y * 0.05) * 2 - 1) * dt * 6, -34, 34);
  drop.vy = clamp(drop.vy * 0.999 + (Math.cos(drop.x * 0.05) * 2 - 1) * dt * 6, -34, 34);
}

/* -------------------------------------------------------------------- pool */

function addToPool(
  world: World,
  drop: SimDrop,
  colors: readonly [number, number, number][]
): void {
  drop.phase = 'pooled';

  const index = columnAt(world, drop.x);
  const column = world.pool[index];
  if (column === undefined) return;

  const columnWidth = world.width / POOL_COLUMNS;
  // Volume conserved: a drop's area spread across one column's width.
  const volume = (Math.PI * (drop.size / 2) ** 2) / Math.max(1, columnWidth);

  const wasEmpty = column.h < 0.05;
  column.h = Math.min(MAX_POOL, column.h + volume);
  column.v += SPLASH * drop.size;

  const rgb = colors[drop.color % Math.max(1, colors.length)] ?? [124, 92, 255];

  if (wasEmpty) {
    // The first drop in a column SETS the colour rather than blending toward it.
    //
    // Blending from the initial zero meant an empty column started at black and
    // crawled out of it, so the shallow parts of the pool — which is most of it
    // early on — rendered as a dark trough between the places it had rained
    // hardest. Paint on a floor is the colour of the paint from the first drop.
    column.r = rgb[0];
    column.g = rgb[1];
    column.b = rgb[2];
    return;
  }

  // After that, weighted toward what is already there, so the pool takes on the
  // colour of everything that has landed rather than flashing to the latest.
  const mix = Math.min(0.5, volume / Math.max(1, column.h));
  column.r += (rgb[0] - column.r) * mix;
  column.g += (rgb[1] - column.g) * mix;
  column.b += (rgb[2] - column.b) * mix;
}

/**
 * One step of a spring-coupled height field — the cheapest thing that behaves
 * like liquid rather than like a bar chart.
 *
 * Each column is pulled toward the average of its neighbours, which propagates
 * a disturbance sideways as a travelling wave, and damped so the surface
 * eventually flattens. A splash is a downward kick to one column; the waves
 * that follow are this integration, not an animation of one.
 */
export function stepPool(world: World, dt: number): void {
  const pool = world.pool;
  const last = pool.length - 1;

  for (let i = 0; i <= last; i += 1) {
    const column = pool[i];
    if (column === undefined) continue;
    const left = pool[i === 0 ? 0 : i - 1] ?? column;
    const right = pool[i === last ? last : i + 1] ?? column;

    const pull = (left.h + right.h) / 2 - column.h;
    column.v += pull * WAVE_TENSION * dt;
    column.v *= Math.pow(WAVE_DAMPING, dt * 60);
  }

  for (let i = 0; i <= last; i += 1) {
    const column = pool[i];
    if (column === undefined) continue;
    column.h = Math.max(0, Math.min(MAX_POOL, column.h + column.v * dt));
  }

  // Levelling: paint flows sideways as well as sloshing, or the pool keeps the
  // silhouette of wherever it happened to rain hardest.
  const spread = Math.min(0.5, WAVE_SPREAD * dt);
  const heights = pool.map((c) => c.h);
  for (let i = 0; i <= last; i += 1) {
    const column = pool[i];
    if (column === undefined) continue;
    const left = heights[i === 0 ? 0 : i - 1] ?? column.h;
    const right = heights[i === last ? last : i + 1] ?? column.h;
    column.h += ((left + right) / 2 - column.h) * spread;
  }
}

export function columnAt(world: World, x: number): number {
  const index = Math.floor((x / Math.max(1, world.width)) * POOL_COLUMNS);
  return Math.max(0, Math.min(POOL_COLUMNS - 1, index));
}

/** Total paint held, px². Used by the tests to prove nothing leaks. */
export function poolVolume(world: World): number {
  return world.pool.reduce((sum, column) => sum + column.h, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
