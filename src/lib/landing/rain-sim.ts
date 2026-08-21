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
  /** Fixed per drop, so two drops in the same place still move differently.
   *  See `stepAbsorbed` for why this had to stop being derived from position. */
  seed: number;
  /** This drop's own top speed. Depth drives it: near drops fall faster. */
  terminal: number;
  /** 1 at the instant of landing, decaying to 0. Drives the flatten-and-recover
   *  the renderer draws, which is what makes an impact read as an impact. */
  squash: number;
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
  /** Depth of paint above the floor, px. */
  h: number;
  /** Accumulated colour, 0-255. */
  r: number;
  g: number;
  b: number;
}

/** A landing, for the moment it takes to spread and disappear. */
export interface Splash {
  readonly x: number;
  /** Height above the floor the drop met the paint at. */
  readonly y: number;
  /** 0 at impact, 1 when finished. */
  t: number;
  /** How big the drop was, which is how big the ring gets. */
  readonly size: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface World {
  readonly drops: SimDrop[];
  readonly pool: PoolColumn[];
  /** Impacts currently spreading. Short-lived; culled every step. */
  readonly splashes: Splash[];
  /**
   * Horizontal flow at each boundary BETWEEN columns, px/s — so there is one
   * more of these than there are columns, and `flow[i]` is the velocity across
   * the face to the left of `pool[i]`.
   *
   * Staggering velocity against depth like this is what makes the scheme below
   * behave: depth lives at cell centres and the thing that moves it lives at
   * the faces, so a gradient in one directly drives the other with no averaging
   * step to smear it out.
   */
  readonly flow: Float64Array;
  /** Scratch for one step's face fluxes. Held on the world rather than
   *  allocated per frame — see the note on mutation at the top of this file. */
  readonly flux: Float64Array;
  /** Viewport width the pool columns are spread across. */
  width: number;
  height: number;
  /** Distance from the top of the viewport to the floor paint collects on.
   *  Larger than `height` while the foot of the page is still below. */
  floor: number;
}

/* ------------------------------------------------------------------ physics */

/**
 * px/s². Gentle on purpose.
 *
 * This was 1500, which is roughly real gravity and completely wrong for the
 * page: the CSS build it replaced took 6-26 seconds to cross the viewport,
 * about 48-210px/s, and at 1500 a drop passed the whole hero in under a second.
 * The rain is meant to drift.
 */
export const GRAVITY = 145;

/** The range of top speeds, px/s, spanned by depth — near drops fall fastest.
 *  Matches the spread the original keyframe durations produced. */
export const TERMINAL_NEAR = 215;
export const TERMINAL_FAR = 52;
/** How long a drop sits where it landed before it starts to run off, ms. */
export const REST_MS = 380;
/** Seconds a splash takes to spread and fade. */
export const SPLASH_LIFE = 0.9;
/** Most splashes alive at once. Beyond this the oldest is dropped rather than
 *  letting a downpour turn the floor into a solid ring of foam. */
export const MAX_SPLASHES = 26;
/** px/s², sideways, once it starts running. */
export const RUNOFF_ACCEL = 420;
/** Sideways drift while falling, px/s. */
export const SWAY_SPEED = 26;

/** Columns the pool surface is sampled at. Enough for a wave to read as a
 *  curve, few enough that the whole field is a rounding error per frame. */
export const POOL_COLUMNS = 120;

/**
 * Gravity for the shallow-water solver, px/s².
 *
 * Not the same number as the one the drops fall under, and it should not be:
 * this one sets how fast waves travel across the pool, which is `sqrt(g·h)`.
 * Tuned by eye for water at this scale — real gravity here makes a 100px-deep
 * pool propagate at nearly 400px/s, which crosses the page in three seconds and
 * reads as a ripple tank rather than as paint.
 */
export const WAVE_GRAVITY = 340;

/** Per-second retention on the flow. Paint is viscous; water would be ~0.99. */
export const VISCOSITY = 0.62;

/** Retention on depth differences, which is what finally flattens the pool. */
export const SURFACE_TENSION = 0.55;
/** Ceiling on pool depth, px, so the page cannot be drowned.
 *  Kept below the footer's first line of text: the paint is meant to rise at
 *  the foot of the page, not to swallow what is written there. */
export const MAX_POOL = 165;

/* ------------------------------------------------------------------- world */

export function createPool(): PoolColumn[] {
  return Array.from({ length: POOL_COLUMNS }, () => ({ h: 0, r: 0, g: 0, b: 0 }));
}

export function createWorld(width: number, height: number): World {
  return {
    drops: [],
    pool: createPool(),
    splashes: [],
    flow: new Float64Array(POOL_COLUMNS + 1),
    flux: new Float64Array(POOL_COLUMNS + 1),
    width,
    height,
    floor: height,
  };
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
  colors: readonly [number, number, number][],
  time = 0
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
        stepAbsorbed(drop, dt, surfaces, time);
        break;
      case 'pooled':
        break;
    }
  }
  separate(world.drops, surfaces);
  stepSplashes(world, dt);
  stepPool(world, dt);
}

function stepSplashes(world: World, dt: number): void {
  for (let i = world.splashes.length - 1; i >= 0; i -= 1) {
    const splash = world.splashes[i];
    if (splash === undefined) continue;
    splash.t += dt / SPLASH_LIFE;
    if (splash.t >= 1) world.splashes.splice(i, 1);
  }
}

function stepFalling(
  drop: SimDrop,
  dt: number,
  world: World,
  surfaces: readonly Surface[],
  colors: readonly [number, number, number][]
): void {
  const previousBottom = drop.y + drop.size / 2;

  drop.vy = Math.min(drop.terminal, drop.vy + GRAVITY * dt);
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
      /*
       * It swells on the way in.
       *
       * A raindrop is 2.5-22px and reads as a speck once it is inside a 56px
       * pill — the reference is packed with blobs a third the pill's height. A
       * drop entering liquid spreading out is also the physically sensible
       * reading, and doing it to `size` rather than at draw time means the
       * separation pass keeps them off each other at their real size.
       */
      // Capped against the host's own height as well as an absolute ceiling: a
      // blob wider than the button it is in cannot be kept inside it, and the
      // separation pass below would spend every frame shoving it through a wall.
      drop.size = Math.min(
        30,
        (surface.bottom - surface.top) * 0.62,
        drop.size * 2.2 + 5
      );
      // Enters travelling, and keeps a little of the speed it arrived with.
      drop.vx = (drop.vx + (drop.x < (surface.left + surface.right) / 2 ? 40 : -40)) * 0.4;
      drop.vy = drop.vy * 0.12;
      drop.y = surface.top + drop.size;
      return;
    }

    drop.phase = 'resting';
    drop.host = i;
    drop.y = surface.top - drop.size / 2;
    // How hard it arrived, normalised — a fast drop flattens more.
    drop.squash = Math.min(1, drop.vy / drop.terminal);
    drop.vy = 0;
    drop.vx = 0;
    drop.restLeft = REST_MS;
    // Runs off whichever edge it landed nearer to, as water on a sill does.
    drop.runoff = drop.x < (surface.left + surface.right) / 2 ? -1 : 1;
    return;
  }

  // Meets the PAINT, not the floor under it.
  //
  // Testing against `world.floor` meant a drop sank through the visible surface
  // of the pool and only vanished at the true bottom, so as the paint deepened
  // there appeared to be an invisible shelf some way below the waves. The
  // surface a drop lands on is the top of whatever has already gathered in its
  // own column.
  const surfaceHere = world.floor - (world.pool[columnAt(world, drop.x)]?.h ?? 0);
  if (bottom >= surfaceHere) {
    addToPool(world, drop, colors);
  }
}

function stepResting(drop: SimDrop, dt: number, surfaces: readonly Surface[]): void {
  const surface = surfaces[drop.host];
  if (surface === undefined) {
    drop.phase = 'falling';
    return;
  }

  // The impact recovers over the first part of the rest, so the drop visibly
  // settles rather than snapping from flattened back to round.
  drop.squash = Math.max(0, drop.squash - dt * 3.4);

  // Sits, then runs. The pause is what makes it read as landing rather than
  // deflecting: paint hitting a surface stops before it moves.
  if (drop.restLeft > 0) {
    drop.restLeft -= dt * 1000;
    return;
  }

  /*
   * Eased away rather than accelerated from a standstill.
   *
   * A constant acceleration from zero means the first half-second of the run is
   * imperceptible and then it suddenly leaves, which is the part that read as
   * wrong: real paint on a sill creeps, gathers and goes. The ramp below starts
   * the drop already moving a little and grows the acceleration as it commits.
   */
  const committed = Math.min(1, Math.max(0, -drop.restLeft) / 260);
  drop.vx += RUNOFF_ACCEL * drop.runoff * (0.35 + committed) * dt;
  drop.restLeft -= dt * 1000;
  drop.x += drop.vx * dt;
  // Stays glued to the surface until it is genuinely past the edge.
  drop.y = surface.top - drop.size / 2;

  if (drop.x < surface.left - drop.size / 2 || drop.x > surface.right + drop.size / 2) {
    drop.phase = 'falling';
    // Tips over the edge carrying its sideways speed, rather than stopping dead
    // and dropping vertically the instant it clears the button.
    drop.vy = 30;
    drop.vx *= 0.5;
  }
}

/**
 * Inside the absorbing surface, drifting and bouncing off its walls.
 *
 * Slowed heavily and given no gravity: the drop is suspended in the button, not
 * falling through it. Bouncing rather than wrapping so the motion stays legible
 * as one object moving around a space.
 */
function stepAbsorbed(
  drop: SimDrop,
  dt: number,
  surfaces: readonly Surface[],
  time: number
): void {
  const surface = surfaces[drop.host];
  if (surface === undefined) {
    drop.phase = 'falling';
    return;
  }

  /*
   * Two slow oscillators, offset by this drop's own seed.
   *
   * The previous version derived the wander from POSITION —
   * `Math.sin(drop.y * 0.05) * 2 - 1` — and it had two faults that between them
   * broke the effect entirely. Position-derived motion means two drops that
   * happen to be near each other receive near-identical velocities and travel
   * together forever, so the field converged into a single clump. And that
   * expression ranges [-3, 1]: its mean is -1, a permanent leftward push, so
   * the clump then migrated to one wall and sat there.
   *
   * Seeded time-based oscillators are independent by construction and centred
   * on zero, which is what the reference actually shows: dozens of blobs
   * spread across the whole pill, each going its own way.
   */
  const wanderX = Math.sin(time * 0.7 + drop.seed) + Math.sin(time * 0.31 + drop.seed * 2.3);
  const wanderY = Math.cos(time * 0.53 + drop.seed * 1.7) + Math.cos(time * 0.23 + drop.seed);
  drop.vx += wanderX * 9 * dt;
  drop.vy += wanderY * 9 * dt;

  drop.vx = clamp(drop.vx * 0.985, -26, 26);
  drop.vy = clamp(drop.vy * 0.985, -26, 26);

  drop.x += drop.vx * dt;
  drop.y += drop.vy * dt;

  const r = drop.size / 2;
  const inset = 1.5;
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
}

/**
 * Just the suspended-blob behaviour: drift, walls, and separation.
 *
 * Exported so the liquid pill can run its own field with its own canvas without
 * carrying a rain world it has no use for — it has no falling drops, no floor
 * and no pool, only the blobs inside it. Same physics either way, so the two
 * cannot drift apart.
 */
export function stepSuspended(
  drops: readonly SimDrop[],
  dt: number,
  surfaces: readonly Surface[],
  time: number
): void {
  for (const drop of drops) {
    if (drop.phase === 'absorbed') stepAbsorbed(drop, dt, surfaces, time);
  }
  separate(drops, surfaces);
}

/**
 * Keeps absorbed drops off one another.
 *
 * Oscillators alone still let two drops occupy the same spot by coincidence,
 * and overlapping circles read as one blob rather than two. A light separation
 * pass pushes any overlapping pair apart along the line between them, which is
 * what holds the even spread the reference has. O(n²) over at most a couple of
 * dozen drops per surface — a few hundred comparisons a frame.
 */
function separate(drops: readonly SimDrop[], surfaces: readonly Surface[]): void {
  for (let i = 0; i < drops.length; i += 1) {
    const a = drops[i];
    if (a === undefined || a.phase !== 'absorbed') continue;

    for (let j = i + 1; j < drops.length; j += 1) {
      const b = drops[j];
      if (b === undefined || b.phase !== 'absorbed' || b.host !== a.host) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      // Deliberately well under the sum of the radii: the reference's blobs
      // overlap heavily, and a field held fully apart reads as a diagram of
      // circles rather than as something suspended in liquid. This only pushes
      // apart pairs sitting almost exactly on top of each other, which is what
      // would otherwise render as a single darker blob.
      const want = ((a.size + b.size) / 2) * 0.42;
      if (distance >= want || distance === 0) continue;

      const push = (want - distance) / 2;
      const nx = dx / distance;
      const ny = dy / distance;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;

      // Re-contained immediately.
      //
      // The wall clamp lives in `stepAbsorbed`, which has already run by the
      // time separation happens, so a push resolved here would otherwise sit
      // outside the button until the next frame — and in a button barely taller
      // than a blob, two of them pressing apart will always push through a wall.
      contain(a, surfaces[a.host]);
      contain(b, surfaces[b.host]);
    }
  }
}

/** Keeps a drop inside its host, killing any velocity that took it out. */
function contain(drop: SimDrop, surface: Surface | undefined): void {
  if (surface === undefined) return;
  const r = drop.size / 2;
  const inset = 1.5;

  const minX = surface.left + inset + r;
  const maxX = surface.right - inset - r;
  const minY = surface.top + inset + r;
  const maxY = surface.bottom - inset - r;

  // A blob wider than its host would give an inverted range; centre it instead.
  drop.x = minX > maxX ? (surface.left + surface.right) / 2 : clamp(drop.x, minX, maxX);
  drop.y = minY > maxY ? (surface.top + surface.bottom) / 2 : clamp(drop.y, minY, maxY);
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
  /*
   * Adding volume IS the disturbance.
   *
   * The spring model needed an explicit downward kick to make a wave, which is
   * backwards: a drop landing does not push the surface down, it puts more
   * paint there. Under shallow water that raised column immediately has a slope
   * against its neighbours, the slope drives flow, and the ring spreads on its
   * own — which is why this line went away rather than being retuned.
   */
  column.h = Math.min(MAX_POOL, column.h + volume);

  const rgb = colors[drop.color % Math.max(1, colors.length)] ?? [124, 92, 255];

  // The landing itself: a ring spreading from where it met the paint.
  world.splashes.push({
    x: drop.x,
    y: column.h,
    t: 0,
    size: drop.size,
    r: rgb[0],
    g: rgb[1],
    b: rgb[2],
  });
  if (world.splashes.length > MAX_SPLASHES) world.splashes.shift();

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
 * One step of the 1D shallow-water equations.
 *
 * This replaced a spring-coupled height field — each column pulled toward the
 * average of its neighbours — which is a perfectly good way to make a wobbling
 * line and not a way to make liquid. A membrane and a fluid differ in ways that
 * are immediately visible: a membrane's waves travel at one speed everywhere,
 * it has no notion of moving material, and clamping its height silently
 * destroys volume. Paint does none of those things.
 *
 * What is solved here is mass and momentum:
 *
 *     ∂h/∂t + ∂(hu)/∂x = 0        depth changes by what flows in and out
 *     ∂u/∂t + g·∂h/∂x  = 0        flow accelerates down the surface slope
 *
 * on a staggered grid — depth at cell centres, flow at the faces between them.
 * Three consequences you can see. Waves travel at `sqrt(g·h)`, so a deep pool
 * carries them faster than a shallow one and a swell slows and steepens as it
 * runs into the shallows. Volume is conserved by construction, because every
 * unit that leaves one cell arrives in its neighbour rather than being averaged
 * away. And paint genuinely flows sideways under its own weight instead of
 * being diffused there by a separate levelling pass.
 *
 * The flux is upwind — each face carries the depth of whichever cell the flow
 * is coming FROM. Using the average of the two is the textbook mistake here: it
 * is unconditionally unstable and the surface tears itself apart within a
 * second.
 */
export function stepPool(world: World, dt: number): void {
  const pool = world.pool;
  const flow = world.flow;
  const last = pool.length - 1;
  const dx = Math.max(1, world.width / POOL_COLUMNS);

  // Substepped to hold the CFL condition: a wave must not cross a whole cell in
  // one step, and a deep pool plus a long frame can otherwise do exactly that.
  const fastest = Math.sqrt(WAVE_GRAVITY * MAX_POOL);
  const steps = Math.max(1, Math.ceil((fastest * dt) / (dx * 0.5)));
  const h = dt / steps;
  const flux = world.flux;

  for (let n = 0; n < steps; n += 1) {
    // Momentum: flow accelerates down the surface slope.
    for (let i = 1; i <= last; i += 1) {
      const left = pool[i - 1];
      const right = pool[i];
      if (left === undefined || right === undefined) continue;
      const slope = (right.h - left.h) / dx;
      flow[i] = ((flow[i] ?? 0) - WAVE_GRAVITY * slope * h) * Math.pow(VISCOSITY, h);
    }
    // Walls: nothing flows through the ends of the page.
    flow[0] = 0;
    flow[last + 1] = 0;

    /*
     * Mass, in two passes: work out every face's flux, then apply them.
     *
     * Doing it in one pass and clamping any cell that went negative is what the
     * first version did, and clamping DESTROYS PAINT — the run lost 15% of its
     * volume to it. A face is shared between two cells, so the limit has to be
     * decided per face before anything moves: each face may carry at most what
     * the cell it draws from can actually spare, which keeps depth non-negative
     * without any clamp and conserves volume exactly, because every unit
     * removed from one cell is added to its neighbour.
     */
    for (let i = 1; i <= last; i += 1) {
      const u = flow[i] ?? 0;
      const donor = u > 0 ? pool[i - 1] : pool[i];
      if (donor === undefined) {
        flux[i] = 0;
        continue;
      }
      // Halved: a cell has two faces and either may be drawing from it.
      const spare = (donor.h * dx) / Math.max(1e-6, h) / 2;
      const carried = u * donor.h;
      flux[i] = Math.sign(carried) * Math.min(Math.abs(carried), spare);
    }
    flux[0] = 0;
    flux[last + 1] = 0;

    for (let i = 0; i <= last; i += 1) {
      const column = pool[i];
      if (column === undefined) continue;
      column.h = Math.max(0, column.h - (((flux[i + 1] ?? 0) - (flux[i] ?? 0)) / dx) * h);
    }
  }

  /*
   * A little surface tension, applied as an EXCHANGE rather than as a pull
   * toward a local mean.
   *
   * Shallow water alone is frictionless at the surface and keeps a fine chop
   * forever; paint does not. But the obvious way to damp it — nudging each
   * column toward the average of its neighbours — is not conservative: every
   * column is adjusted against values that are themselves being adjusted, and
   * the total drifts. Moving a fixed fraction of the difference ACROSS each
   * face takes exactly as much from one side as it gives the other.
   */
  const exchange = Math.min(0.25, SURFACE_TENSION * dt);
  for (let i = 0; i < last; i += 1) {
    const left = pool[i];
    const right = pool[i + 1];
    if (left === undefined || right === undefined) continue;
    const move = (left.h - right.h) * exchange * 0.5;
    left.h -= move;
    right.h += move;
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
