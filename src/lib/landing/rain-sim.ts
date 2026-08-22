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
  /**
   * How far the drop has spread across whatever it is sitting on, 0-1.
   *
   * A drop meeting glass does not stay a drop: it flattens into a bead, wide
   * and low, held in that shape by surface tension against its own weight. This
   * rises fast on impact and relaxes back as the bead settles, and the renderer
   * reads it to decide what shape to draw at all — an airborne teardrop, a
   * spread bead, or a bead stretched out along its run.
   */
  spread: number;
}

/** A thing in the world the rain can land on. Viewport coordinates. */
export interface Surface {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  /** True for the one button that takes drops in rather than shedding them. */
  readonly absorbs: boolean;
  /** Corner radius, read from the element. The drops run around this rather
   *  than off a bounding box, which is most of what makes the shedding read as
   *  real — see `surfaceAt`. */
  readonly radius: number;
}

/** The shape of a surface directly beneath a given x. */
interface Contact {
  /** Height of the surface there. */
  readonly y: number;
  /** Its slope, radians. 0 on the flat top, rising around the shoulders. */
  readonly angle: number;
  /** Radius of curvature, or Infinity where the surface is flat. */
  readonly curvature: number;
  /** Which way downhill points: -1 left, 1 right, 0 on the flat. */
  readonly downhill: number;
}

/**
 * Where a surface actually is beneath `x`, and which way it faces.
 *
 * A button is a rounded rectangle, and treating it as its bounding box is what
 * made the shedding look amateur: a drop slid along a flat line and then
 * vanished off a corner it never touched. Between the corners the top IS flat;
 * within a radius of either end it is an arc, and a drop there is on a slope
 * that steepens the further round it goes.
 */
export function surfaceAt(surface: Surface, x: number): Contact {
  const radius = Math.max(
    0,
    Math.min(surface.radius, (surface.right - surface.left) / 2, (surface.bottom - surface.top) / 2)
  );
  const leftCentre = surface.left + radius;
  const rightCentre = surface.right - radius;

  if (radius === 0 || (x >= leftCentre && x <= rightCentre)) {
    return { y: surface.top, angle: 0, curvature: Number.POSITIVE_INFINITY, downhill: 0 };
  }

  const centreX = x < leftCentre ? leftCentre : rightCentre;
  const centreY = surface.top + radius;
  const dx = x - centreX;
  // Past the shoulder entirely: the surface has curved away underneath.
  if (Math.abs(dx) >= radius) {
    return { y: centreY, angle: Math.PI / 2, curvature: radius, downhill: Math.sign(dx) || 1 };
  }

  const dy = Math.sqrt(radius * radius - dx * dx);
  return {
    y: centreY - dy,
    // Slope of the circle at this point.
    angle: Math.atan2(Math.abs(dx), dy),
    curvature: radius,
    downhill: Math.sign(dx) || 1,
  };
}

/**
 * Where a drop ends up after travelling `distance` ALONG the surface.
 *
 * The reason this exists rather than `x += vx * dt`. A bead running off a pill
 * was advanced in x and then dropped onto whatever the surface was doing at the
 * new x — and x is a hopeless parameter for a shoulder. Approaching the side of
 * the pill the tangent stands up, `cos(angle)` goes to nothing, and a fixed
 * step along the SURFACE turns into almost no step in x at all. So the drop
 * crawled to the shoulder, stopped dead while `along` went on accelerating it,
 * and then tore off the side once the accumulated speed finally beat the arc.
 * Stall, rev, snap — on every single drop, and no amount of retuning adhesion
 * or gravity could fix it, because the problem was the parameter.
 *
 * On the arc the honest step is angular: `dθ = ds / r`. Then a drop moves the
 * same distance of wet path every frame wherever it is on the button, which is
 * what "smooth" actually means here.
 */
export function advanceAlong(
  surface: Surface,
  x: number,
  distance: number,
  downhill: number
): number {
  const radius = Math.max(
    0,
    Math.min(surface.radius, (surface.right - surface.left) / 2, (surface.bottom - surface.top) / 2)
  );
  const leftCentre = surface.left + radius;
  const rightCentre = surface.right - radius;
  const direction = downhill < 0 ? -1 : 1;

  // The flat top: along the surface and along x are the same thing.
  if (radius === 0 || (x >= leftCentre && x <= rightCentre)) {
    return x + distance * direction;
  }

  const centre = x < leftCentre ? leftCentre : rightCentre;
  const offset = Math.min(radius, Math.abs(x - centre));
  // `surfaceAt` reports exactly this angle, measured from the top of the arc.
  const theta = Math.asin(offset / Math.max(1e-6, radius));
  const next = Math.min(Math.PI / 2, theta + distance / Math.max(1e-6, radius));
  return centre + Math.sign(x - centre || direction) * radius * Math.sin(next);
}

export interface PoolColumn {
  /** Depth of paint above the floor, px. */
  h: number;
  /** Accumulated colour, 0-255. */
  r: number;
  g: number;
  b: number;
}

/**
 * A drop that met the floor on this step.
 *
 * Landings are RECORDED rather than inferred, and that is the whole point of
 * this type. The rain used to mark a drop `pooled` and leave the caller to work
 * out afterwards, from the drop's position, whether that had just happened —
 * which is not a question a position can answer. A drop parked off-screen by
 * `recycle` is also `pooled`; so is one that landed nine seconds ago. Every
 * attempt to separate those cases with a `y` threshold has eventually picked
 * the wrong one, because the threshold has to encode an assumption about where
 * the floor is and something else always moves it.
 *
 * Cleared at the top of every `step`, so this list is exactly the drops that
 * arrived during the step the caller is looking at, and reading it twice is
 * impossible.
 */
export interface Landing {
  readonly x: number;
  /** Index into the caller's palette. The simulation does not know colours. */
  readonly color: number;
  readonly size: number;
}

export interface World {
  readonly drops: SimDrop[];
  /**
   * Paint gathered on the floor.
   *
   * Only worlds that DRAW a pool have any business filling this. The rain's own
   * world leaves it empty: what the visitor sees gathering at the foot of the
   * page is the footer's pool, poured by `pourInto` from the landings below.
   */
  readonly pool: PoolColumn[];
  /** Drops that met the floor during the current step. Cleared by `step`. */
  readonly landed: Landing[];
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

/**
 * Puts pooled drops back at the top, keeping `target` of them in the air.
 *
 * Lives here rather than in the component because it is half of the drop
 * lifecycle: `step` retires a drop at the floor and this is what brings it
 * back. Split across two files that fact had no test that could see both ends,
 * and the rain quietly stopped for eighty seconds at a time without one failing.
 *
 * The viewport is passed in rather than read off `window`, so the loop that
 * decides how long it rains can be run for as many simulated minutes as anyone
 * wants without a DOM.
 */
export function recycle(
  drops: SimDrop[],
  target: number,
  width: number,
  height: number
): void {
  let airborne = 0;
  for (const drop of drops) {
    if (drop.phase === 'falling' || drop.phase === 'resting') airborne += 1;
  }

  for (const drop of drops) {
    if (airborne >= target) break;
    if (drop.phase !== 'pooled') continue;
    drop.phase = 'falling';
    drop.x = Math.random() * width;
    drop.y = -drop.size - Math.random() * height * 0.5;
    drop.vy = drop.terminal * 0.7;
    drop.vx = (Math.random() - 0.5) * 12;
    drop.host = -1;
    airborne += 1;
  }

  // Anything airborne beyond the target is parked off-screen until it is wanted
  // again, so lowering the count thins the rain without deleting anyone's fall.
  for (let i = drops.length - 1; i >= 0 && airborne > target; i -= 1) {
    const drop = drops[i];
    if (drop === undefined || drop.phase !== 'falling') continue;
    if (drop.y < 0) {
      drop.phase = 'pooled';
      airborne -= 1;
    }
  }
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
/**
 * The creep along the flat top, px/s².
 *
 * A drop on a truly level surface never moves, and the flat between a button's
 * two shoulders is exactly level — so left to gravity alone the rain would
 * simply accumulate on the buttons forever. It is not level in fact: these
 * buttons tilt under the pointer and the page scrolls beneath them. This stands
 * in for that, and it is deliberately small — it is what carries a drop to the
 * shoulder, and the shoulder does the real work.
 */
export const CREEP_ACCEL = 95;

/**
 * How strongly a drop is held where it lands, px/s² of tangential pull it can
 * resist before it starts to move.
 *
 * Surface tension pins a droplet's contact line: on glass, small drops sit
 * still on a slope that larger ones run down, because adhesion scales with the
 * contact width while weight scales with volume. Dividing by mass below is what
 * reproduces that — the same number holds a small drop and lets a big one go.
 */
export const ADHESION = 150;

/** Gravity felt along a surface. The drops' own fall is gentler than reality
 *  for legibility; a drop running off an edge should still look like it means
 *  it, so this one is nearer the truth. */
export const SURFACE_GRAVITY = 900;

/**
 * How long adhesion can hold a drop before it must start moving, ms·mass.
 *
 * Was 1200, and at that value a small drop sat PERFECTLY STILL on a button for
 * over five seconds — three-quarters of its whole time up there — and then all
 * of them tore off at once. Stillness is the thing that read as broken: real
 * beads on glass are always doing something, however slowly. So this is now
 * short, and being pinned no longer means being frozen (see `PINNED_CREEP`).
 */
export const PIN_DWELL = 400;

/**
 * What a pinned drop still manages, as a fraction of its usual creep.
 *
 * The point of the pinned phase is that a small drop clings where a big one has
 * already gone. That is a difference of SPEED, and it used to be modelled as a
 * difference between moving and not moving at all — which is both wrong and,
 * on screen, the whole problem.
 */
export const PINNED_CREEP = 0.06;
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
    landed: [],
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
  time = 0
): void {
  // Exactly one step's worth of arrivals, so a caller reading this after the
  // call sees what just happened and never what happened before.
  world.landed.length = 0;

  for (const drop of world.drops) {
    switch (drop.phase) {
      case 'falling':
        stepFalling(drop, dt, world, surfaces);
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
}

/*
 * The pool is NOT advanced here.
 *
 * `step` moves drops; `stepPool` moves paint. They used to run together, which
 * was harmless only for as long as one world did both jobs. It does not: the
 * rain's world has no pool to run, and the footer — which does — calls
 * `stepPool` on its own. Running it from here meant the rain quietly kept a
 * second body of paint that nothing drew, and that pool is what eventually
 * stopped the rain (see `land`).
 */

function stepFalling(
  drop: SimDrop,
  dt: number,
  world: World,
  surfaces: readonly Surface[]
): void {
  const previousBottom = drop.y + drop.size / 2;

  drop.vy = Math.min(drop.terminal, drop.vy + GRAVITY * dt);
  drop.y += drop.vy * dt;
  drop.x += drop.vx * dt;
  // Back to a drop once nothing is holding it flat. Quick, but not instant —
  // a bead thrown off an edge is visibly still wide for a moment.
  drop.spread = Math.max(0, drop.spread - dt * 2.6);
  drop.squash = Math.max(0, drop.squash - dt * 2.2);

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
    drop.y = surfaceAt(surface, drop.x).y - drop.size / 2;
    // How hard it arrived, normalised — a fast drop flattens more, and spreads
    // further across the surface before surface tension pulls it back in.
    drop.squash = Math.min(1, drop.vy / drop.terminal);
    drop.spread = Math.min(1, 0.45 + drop.squash * 0.55);
    drop.vy = 0;
    // Keeps a little of the sideways drift it arrived with, so drops do not all
    // start from a dead stop in the middle of a flat surface.
    drop.vx *= 0.25;
    drop.restLeft = REST_MS;
    // Heads for whichever edge it landed nearer to, as water on a sill does.
    drop.runoff = drop.x < (surface.left + surface.right) / 2 ? -1 : 1;
    return;
  }

  /*
   * The floor is the floor.
   *
   * This used to test against the top of whatever paint had already gathered in
   * the drop's own column — right when one world both gathered and drew the
   * pool, and the cause of the stall once that stopped being true. The rain's
   * pool is no longer drawn, but it went on filling, levelling under
   * `stepPool`, and lifting this line a little further every second. The
   * landing test downstream ignored anything more than 80px above the floor, so
   * once the invisible paint levelled past 80px the rain simply stopped
   * arriving — after about eighty seconds, permanently, with the drops still
   * falling in plain sight.
   *
   * If a pool is ever drawn in this world again, the surface belongs back here
   * — together with something that drains it.
   */
  if (bottom >= world.floor) {
    land(world, drop);
  }
}

/**
 * A drop on a button: pinned, then running around the shoulder, then thrown.
 *
 * Three stages, all of them physics rather than timing.
 *
 * PINNED. Surface tension holds the contact line. The drop resists a tangential
 * pull of `ADHESION / mass`, so a small drop clings where a large one has
 * already gone — which is what actually happens on glass, and it means the
 * buttons keep a scatter of small drops rather than shedding everything
 * identically.
 *
 * RUNNING. Once free it slides along the real surface, accelerated by the
 * tangential component of gravity — `g·sinθ`. On the flat top θ is 0 and only
 * `CREEP_ACCEL` moves it; around the shoulder θ grows toward vertical and it
 * accelerates hard. It follows the arc, so it is visibly running around the end
 * of the button rather than along a line drawn across it.
 *
 * THROWN. It separates where the surface can no longer hold it: on a convex
 * arc that is when `v² / R > g·cosθ`, the same condition that governs a bead
 * leaving a sphere. It leaves along the tangent carrying the speed it had, so
 * a drop that has picked up speed sails off the shoulder and a slow one dribbles
 * over the edge — which was the whole thing that read as amateur before, when
 * every drop left the same way at the same speed.
 */
function stepResting(drop: SimDrop, dt: number, surfaces: readonly Surface[]): void {
  const surface = surfaces[drop.host];
  if (surface === undefined) {
    drop.phase = 'falling';
    return;
  }

  // The impact flattens it; it rounds out again as it settles.
  drop.squash = Math.max(0, drop.squash - dt * 3.4);
  /*
   * The bead relaxes toward the shape surface tension wants, not toward a
   * sphere. A drop at rest on glass stays a wide low dome — it never becomes
   * round again while it is still touching. Running stretches it out further,
   * which is the elongation you see on a windscreen.
   */
  const wants = 0.42 + Math.min(0.4, Math.abs(drop.vx) / 260);
  drop.spread += (wants - drop.spread) * Math.min(1, dt * 5);

  const contact = surfaceAt(surface, drop.x);
  const mass = Math.max(0.05, (drop.size / 12) ** 2);
  const speed = Math.abs(drop.vx);

  /*
   * PINNED: adhesion still has hold of the contact line.
   *
   * Scaled by mass, so a heavy drop that adhesion barely holds goes almost at
   * once and a small one clings — which is what actually happens on glass, and
   * why the buttons keep a scatter of small beads rather than shedding
   * everything identically. What pinned no longer means is STOPPED: the drop
   * goes on creeping, just very slowly.
   */
  const pull = SURFACE_GRAVITY * Math.sin(contact.angle) + CREEP_ACCEL;
  const pinned = speed < 1 && pull < ADHESION / mass && drop.restLeft > -PIN_DWELL / mass;
  if (pinned) drop.restLeft -= dt * 1000;

  const downhill = contact.downhill !== 0 ? contact.downhill : drop.runoff;
  const along =
    (SURFACE_GRAVITY * Math.sin(contact.angle) + CREEP_ACCEL * 0.35) *
    (pinned ? PINNED_CREEP : 1);
  drop.vx += along * downhill * dt;

  // Travels the WET PATH, not the horizontal. `advanceAlong` carries it the
  // same distance of surface every frame whether it is on the flat or hard
  // round the shoulder — see there for why x could never do this job.
  drop.x = advanceAlong(surface, drop.x, Math.abs(drop.vx) * dt, downhill);

  const next = surfaceAt(surface, drop.x);
  drop.y = next.y - drop.size / 2;

  // THROWN: the arc can no longer supply the centripetal force to hold it.
  const v = Math.abs(drop.vx);
  /*
   * Gravity holds it to the curve, and so does the contact line.
   *
   * Without the adhesion term every drop let go at the same place — about 41°
   * round the shoulder — and left sideways at the same speed regardless of its
   * size, which is what made the shedding look mechanical. Surface tension is
   * exactly what lets a small bead follow a tight radius further than a heavy
   * one, so with it in here they part company at different points and leave on
   * different headings, which is what a windscreen actually looks like.
   */
  const holds = SURFACE_GRAVITY * Math.cos(next.angle) + ADHESION / mass;
  const needed = Number.isFinite(next.curvature) ? (v * v) / Math.max(1, next.curvature) : 0;

  /*
   * Past the widest point the surface has curved back UNDER the drop, and
   * nothing holds it there at any speed. Leaving this to the centripetal test
   * alone meant a slow bead crept to the equator, where `holds` is zero, and
   * hung on the side of the button waiting for its own acceleration to throw
   * it — which is the other half of what the stall looked like.
   */
  const atEquator = next.angle >= Math.PI / 2 - 0.02;
  const separates = atEquator || (Number.isFinite(next.curvature) && needed > holds);
  const pastEnd = drop.x < surface.left - drop.size || drop.x > surface.right + drop.size;

  if (separates) {
    drop.phase = 'falling';
    /*
     * Leaves along the tangent, carrying the speed it built up.
     *
     * A floor under the horizontal component matters: at the very side of a
     * pill the tangent is vertical, so `cos(angle)` is ~0 and the drop would
     * drop dead straight down having just run visibly sideways. Keeping a
     * fraction of its speed outward is both what a real bead does — it is
     * thrown clear — and what stops the departure looking like the drop hit an
     * invisible wall.
     */
    drop.vy = Math.max(20, v * Math.sin(next.angle));
    // A small outward floor so a drop leaving at the very side is not launched
    // dead straight down out of a surface it was visibly running around. It is
    // a nudge clear, not a throw: at 0.35 the departure read as the drop being
    // fired off the button sideways.
    drop.vx = downhill * Math.max(v * 0.16, v * Math.cos(next.angle));
    return;
  }

  if (pastEnd) {
    // Safety only: it should have separated on the arc long before here.
    drop.phase = 'falling';
    drop.vy = Math.max(20, drop.vy);
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

/**
 * A drop has met the floor.
 *
 * It stops being weather and is announced; it does not become paint here. The
 * paint is the footer's, poured by `pourInto` from the landing record, and one
 * definition of how a drop turns into volume is all this page should have. The
 * version of this function that ALSO poured — into a pool that nothing drew any
 * more — is what silently stopped the rain after eighty seconds.
 *
 * The drop stays `pooled` and keeps its position. `recycle` is what puts it
 * back at the top, and it is the only thing that should.
 */
function land(world: World, drop: SimDrop): void {
  drop.phase = 'pooled';
  world.landed.push({ x: drop.x, color: drop.color, size: drop.size });
}

/**
 * The volume one drop of this size adds to one column.
 *
 * Shared so the rain and the footer cannot disagree about how big a drop is:
 * the rain reports a diameter, and this is the only place that turns it into
 * paint. It was previously worked out once here and again in the footer, in two
 * files, from two slightly different readings of the column width.
 */
export function dropVolume(size: number, width: number): number {
  const columnWidth = width / POOL_COLUMNS;
  return (Math.PI * (size / 2) ** 2) / Math.max(1, columnWidth);
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

/**
 * Pours paint into the pool at `x`, as a landing drop does.
 *
 * Exported so the footer's wall pool can be fed by the paint run without that
 * component reimplementing the mixing rule — the pool it fills is the same
 * shallow-water field the rain used, and it should behave identically.
 */
export function pourInto(
  world: World,
  x: number,
  volume: number,
  rgb: readonly [number, number, number]
): void {
  const column = world.pool[columnAt(world, x)];
  if (column === undefined) return;

  const wasEmpty = column.h < 0.05;
  column.h = Math.min(MAX_POOL, column.h + volume);

  if (wasEmpty) {
    column.r = rgb[0];
    column.g = rgb[1];
    column.b = rgb[2];
    return;
  }
  const mix = Math.min(0.5, volume / Math.max(1, column.h));
  column.r += (rgb[0] - column.r) * mix;
  column.g += (rgb[1] - column.g) * mix;
  column.b += (rgb[2] - column.b) * mix;
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
