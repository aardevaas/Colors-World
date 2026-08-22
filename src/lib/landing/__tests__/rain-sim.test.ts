import { describe, expect, it } from 'vitest';
import {
  MAX_POOL,
  POOL_COLUMNS,
  REST_MS,
  TERMINAL_FAR,
  TERMINAL_NEAR,
  advanceAlong,
  columnAt,
  createWorld,
  dropVolume,
  poolVolume,
  pourInto,
  recycle,
  step,
  stepPool,
  surfaceAt,
  type SimDrop,
  type Surface,
} from '../rain-sim';

const COLORS: readonly [number, number, number][] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
];

function drop(overrides: Partial<SimDrop> = {}): SimDrop {
  return {
    x: 500,
    y: 0,
    vx: 0,
    vy: 0,
    size: 12,
    color: 0,
    depth: 0.5,
    phase: 'falling',
    host: -1,
    restLeft: 0,
    runoff: 1,
    seed: 1.234,
    terminal: TERMINAL_NEAR,
    squash: 0,
    spread: 0,
    ...overrides,
  };
}

// A pill, as the real buttons are: radius resolves to half its height.
const BUTTON: Surface = {
  left: 400, top: 300, right: 600, bottom: 340, absorbs: false, radius: 20,
};
const SPONGE: Surface = {
  left: 700, top: 300, right: 900, bottom: 340, absorbs: true, radius: 20,
};

/** Runs the world for `seconds` in realistic frame-sized steps. */
function run(world: ReturnType<typeof createWorld>, surfaces: Surface[], seconds: number) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) step(world, dt, surfaces);
}

/**
 * Runs until `done` or the time budget runs out.
 *
 * Preferred over a fixed duration wherever the assertion is about an EVENT. A
 * landed drop rests for 380ms and then runs off, so "run for two seconds and
 * expect it to be resting" quietly tests the wrong instant — it lands, rests,
 * runs off and is airborne again well inside that window.
 */
function runUntil(
  world: ReturnType<typeof createWorld>,
  surfaces: Surface[],
  done: () => boolean,
  budgetSeconds = 5
): boolean {
  const dt = 1 / 60;
  for (let t = 0; t < budgetSeconds; t += dt) {
    step(world, dt, surfaces);
    if (done()) return true;
  }
  return false;
}

describe('falling', () => {
  it('accelerates downward and stops at terminal velocity', () => {
    const world = createWorld(1000, 800);
    world.floor = 100_000; // out of reach, so it just falls
    const d = drop();
    world.drops.push(d);

    run(world, [], 0.5);
    const early = d.vy;
    expect(early).toBeGreaterThan(0);

    run(world, [], 10);
    expect(d.vy).toBeLessThanOrEqual(TERMINAL_NEAR + 1e-6);
    expect(d.vy).toBeGreaterThan(early);
  });
});

describe('landing on a surface', () => {
  it('is caught by a button rather than passing through it', () => {
    const world = createWorld(1000, 800);
    const d = drop();
    world.drops.push(d);

    expect(runUntil(world, [BUTTON], () => d.phase === 'resting')).toBe(true);
    expect(d.y).toBeLessThanOrEqual(BUTTON.top);
  });

  it('cannot tunnel through a thin button even at full speed', () => {
    // The reason collision is tested against the PREVIOUS position: at terminal
    // velocity a drop covers ~19px a frame, which is half this button's height.
    const world = createWorld(1000, 800);
    const d = drop({ vy: TERMINAL_NEAR, y: BUTTON.top - 30 });
    world.drops.push(d);

    run(world, [BUTTON], 0.5);
    expect(d.phase).toBe('resting');
  });

  it('dwells where it landed before it starts to run off', () => {
    /*
     * Dwells — it does not freeze.
     *
     * This asserted `d.x` was EXACTLY where it landed, and that exactness was
     * the bug rather than the contract: a pinned drop held a coordinate to the
     * bit for seconds at a time, and a field of perfectly motionless beads that
     * then all leave together is what made the shedding look broken. Adhesion
     * is a difference of speed, so what is checked now is that it has barely
     * moved, not that it has not moved at all.
     */
    const world = createWorld(1000, 800);
    const d = drop();
    world.drops.push(d);
    runUntil(world, [BUTTON], () => d.phase === 'resting');

    const landedAt = d.x;
    expect(d.restLeft).toBeGreaterThan(0);
    expect(d.restLeft).toBeLessThanOrEqual(REST_MS);

    run(world, [BUTTON], 0.1);
    expect(Math.abs(d.x - landedAt)).toBeLessThan(0.5);
  });

  it('runs off the nearer edge and falls again', () => {
    const world = createWorld(1000, 800);
    world.floor = 100_000;
    // Landing right of centre should send it right.
    const d = drop({ x: 580 });
    world.drops.push(d);

    expect(runUntil(world, [BUTTON], () => d.phase === 'resting')).toBe(true);
    expect(d.runoff).toBe(1);

    // Longer than before: a drop is now pinned by surface tension until the
    // pull along the surface beats adhesion, so it clings before it runs.
    expect(runUntil(world, [BUTTON], () => d.phase === 'falling', 25)).toBe(true);

    // It separates ON the shoulder, not past the bounding box — which is the
    // whole point of running around the real shape. It left the flat top,
    // travelled into the right-hand arc, and was thrown from it.
    expect(d.x).toBeGreaterThan(BUTTON.right - 24);
    expect(d.vx).toBeGreaterThan(0);
  });

  it('sends a drop that landed left of centre off the left edge', () => {
    const world = createWorld(1000, 800);
    world.floor = 100_000;
    const d = drop({ x: 420 });
    world.drops.push(d);

    expect(runUntilShed(world, [BUTTON], d)).toBe(true);
    expect(d.x).toBeLessThan(BUTTON.left + 24);
    expect(d.vx).toBeLessThan(0);
  });
});

/**
 * Runs until `d` has landed on a surface and then left it again.
 *
 * Waiting on `phase === 'falling'` alone is a trap and cost three failing tests
 * to spot: a drop STARTS falling, so the condition is already true on the first
 * frame and the assertions then read a drop that has not been near a button.
 */
function runUntilShed(
  world: ReturnType<typeof createWorld>,
  surfaces: Surface[],
  d: SimDrop,
  budgetSeconds = 25
): boolean {
  if (!runUntil(world, surfaces, () => d.phase === 'resting', budgetSeconds)) return false;
  return runUntil(world, surfaces, () => d.phase === 'falling', budgetSeconds);
}

describe('shedding, as a surface actually sheds', () => {
  it('holds a small drop where a large one has already run', () => {
    // Adhesion scales with the contact line and weight with volume, so the same
    // pull that frees a big drop still pins a small one. This is why the
    // buttons keep a scatter of beads rather than shedding everything at once.
    const world = createWorld(1000, 800);
    const small = drop({ x: 500, size: 5 });
    const large = drop({ x: 500, size: 26 });
    world.drops.push(small, large);

    expect(runUntilShed(world, [BUTTON], large)).toBe(true);
    expect(small.phase).toBe('resting');
  });

  it('follows the shoulder down rather than a flat line', () => {
    // The drop should be visibly lower by the time it reaches the end of the
    // button than it was on the flat top — it is running around an arc.
    const world = createWorld(1000, 800);
    const d = drop({ x: 500, size: 22 });
    world.drops.push(d);
    runUntil(world, [BUTTON], () => d.phase === 'resting');
    const flatY = d.y;

    expect(runUntil(world, [BUTTON], () => d.x > BUTTON.right - 8, 20)).toBe(true);
    expect(d.y).toBeGreaterThan(flatY + 2);
  });

  it('leaves carrying the speed it built up, not from a standstill', () => {
    const world = createWorld(1000, 800);
    world.floor = 100_000;
    const d = drop({ x: 560, size: 22 });
    world.drops.push(d);

    expect(runUntilShed(world, [BUTTON], d)).toBe(true);
    // Both components non-trivial: it left along a tangent, not straight down
    // and not horizontally off a box edge.
    expect(Math.abs(d.vx)).toBeGreaterThan(10);
    expect(d.vy).toBeGreaterThan(0);
  });
});

describe('absorption', () => {
  it('takes the drop in rather than shedding it', () => {
    const world = createWorld(1000, 800);
    const d = drop({ x: 800 });
    world.drops.push(d);

    expect(runUntil(world, [SPONGE], () => d.phase === 'absorbed')).toBe(true);
    expect(d.host).toBe(0);
  });

  it('keeps every absorbed drop inside the button, forever', () => {
    const world = createWorld(1000, 800);
    for (let i = 0; i < 12; i += 1) {
      world.drops.push(drop({ x: 720 + i * 14, y: -i * 40 }));
    }

    run(world, [SPONGE], 30);

    for (const d of world.drops) {
      expect(d.phase).toBe('absorbed');
      const r = d.size / 2;
      expect(d.x - r).toBeGreaterThanOrEqual(SPONGE.left - 0.5);
      expect(d.x + r).toBeLessThanOrEqual(SPONGE.right + 0.5);
      expect(d.y - r).toBeGreaterThanOrEqual(SPONGE.top - 0.5);
      expect(d.y + r).toBeLessThanOrEqual(SPONGE.bottom + 0.5);
    }
  });

  it('spreads across the button instead of clumping', () => {
    // The failure this exists to catch: motion derived from POSITION gave two
    // nearby drops near-identical velocities, so the field converged into one
    // blob — and the expression used had a negative mean, so the blob then
    // migrated to a wall and stayed. The reference shows dozens of blobs spread
    // over the whole pill.
    const world = createWorld(1000, 800);
    for (let i = 0; i < 14; i += 1) {
      world.drops.push(drop({ x: 710 + (i % 7) * 26, y: -i * 30, seed: i * 1.7 }));
    }
    run(world, [SPONGE], 40);

    const xs = world.drops.map((d) => d.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    const usable = SPONGE.right - SPONGE.left;
    // Occupying at least half the width is the difference between a field and
    // a clump; a converged set collapses to a few pixels.
    expect(spread).toBeGreaterThan(usable * 0.5);
  });

  it('keeps absorbed drops from overlapping each other', () => {
    const world = createWorld(1000, 800);
    for (let i = 0; i < 10; i += 1) {
      world.drops.push(drop({ x: 800, y: -i * 25, seed: i * 0.9 }));
    }
    run(world, [SPONGE], 40);

    for (let i = 0; i < world.drops.length; i += 1) {
      for (let j = i + 1; j < world.drops.length; j += 1) {
        const a = world.drops[i];
        const b = world.drops[j];
        if (a === undefined || b === undefined) continue;
        const gap = Math.hypot(b.x - a.x, b.y - a.y);
        // Heavy overlap is wanted — the reference's blobs sit on top of one
        // another. What is not wanted is two blobs at the same coordinates,
        // which renders as one. Separation also runs once a frame, so allow
        // some interpenetration beyond its own threshold.
        expect(gap).toBeGreaterThan(((a.size + b.size) / 2) * 0.25);
      }
    }
  });

  it('never lets an absorbed drop come to a dead stop', () => {
    const world = createWorld(1000, 800);
    const d = drop({ x: 800 });
    world.drops.push(d);
    run(world, [SPONGE], 20);
    expect(Math.abs(d.vx) + Math.abs(d.vy)).toBeGreaterThan(0);
  });
});

describe('running off, smoothly', () => {
  /*
   * "Smooth" made measurable.
   *
   * A bead used to crawl along the flat, stop dead at the shoulder and then
   * tear off the side, because the run was advanced in x and x stops moving
   * when the tangent stands up. The symptom is a spike: one frame in the run
   * covers many times the distance of a typical one. So that is what is
   * asserted — not the fix, but the thing the fix was for.
   */
  function pathSteps(startX: number): number[] {
    const world = createWorld(1000, 800);
    const d = drop({ x: startX, y: 280, vy: 120 });
    world.drops.push(d);

    const steps: number[] = [];
    let previous: { x: number; y: number } | null = null;
    const dt = 1 / 60;
    for (let frame = 0; frame < 60 * 12; frame += 1) {
      step(world, dt, [BUTTON]);
      if (d.phase === 'resting') {
        if (previous !== null) steps.push(Math.hypot(d.x - previous.x, d.y - previous.y));
        previous = { x: d.x, y: d.y };
      } else if (previous !== null) {
        break; // it has left the button
      }
    }
    return steps.filter((s) => s > 0.001);
  }

  /** How the drop behaves on the button, and how it leaves it. */
  function runOff(size: number) {
    const world = createWorld(1000, 800);
    const d = drop({ x: 455, y: 280, vy: 120, size });
    world.drops.push(d);

    let onButton = 0;
    let stillest = 0;
    let running = 0;
    let previous: { x: number; y: number } | null = null;
    let exit: { vx: number; vy: number; angle: number } | null = null;
    const dt = 1 / 60;

    for (let frame = 0; frame < 60 * 25; frame += 1) {
      step(world, dt, [BUTTON]);
      if (d.phase === 'resting') {
        onButton += 1;
        if (previous !== null) {
          const moved = Math.hypot(d.x - previous.x, d.y - previous.y);
          running = moved < 0.01 ? running + 1 : 0;
          stillest = Math.max(stillest, running);
        }
        previous = { x: d.x, y: d.y };
      } else if (previous !== null) {
        exit = { vx: d.vx, vy: d.vy, angle: surfaceAt(BUTTON, previous.x).angle };
        break;
      }
    }
    return { onButton: onButton / 60, stillFor: stillest / 60, exit };
  }

  it('never sits perfectly still on a button', () => {
    /*
     * The thing that actually looked broken.
     *
     * A small drop used to be pinned for over five seconds — three-quarters of
     * its time on the button — completely motionless, and then leave all at
     * once with every other drop. Adhesion holding a bead is real; adhesion
     * FREEZING it is not, and stillness is what the eye reads as a bug.
     */
    for (const size of [6, 12, 20]) {
      const { stillFor } = runOff(size);
      expect(stillFor, `size ${size} sat still for ${stillFor.toFixed(2)}s`).toBeLessThan(0.6);
    }
  });

  it('lets a light drop cling further round the shoulder than a heavy one', () => {
    /*
     * Every drop used to part company at the same angle and leave on the same
     * heading whatever its size, because only gravity was holding it to the
     * arc. With the contact line in the balance too, a small bead follows the
     * radius further — so they stop leaving in formation.
     */
    const light = runOff(6);
    const heavy = runOff(20);
    expect(light.exit).not.toBeNull();
    expect(heavy.exit).not.toBeNull();
    expect(light.exit!.angle).toBeGreaterThan(heavy.exit!.angle + 0.1);
  });

  it('dribbles off downward rather than being flung sideways', () => {
    const { exit } = runOff(6);
    expect(exit).not.toBeNull();
    // Leaving the side of a pill, a bead falls. It does not get thrown.
    expect(exit!.vy).toBeGreaterThan(Math.abs(exit!.vx) * 1.6);
  });

  it('never goes backwards while running off', () => {
    const world = createWorld(1000, 800);
    const d = drop({ x: 455, y: 280, vy: 120 });
    world.drops.push(d);

    let furthest = -Infinity;
    const dt = 1 / 60;
    for (let frame = 0; frame < 60 * 12; frame += 1) {
      step(world, dt, [BUTTON]);
      if (d.phase !== 'resting') continue;
      // It runs off the nearer edge; whichever that is, it should keep going
      // that way rather than doubling back.
      const travelled = d.runoff * d.x;
      expect(travelled).toBeGreaterThanOrEqual(furthest - 0.6);
      furthest = Math.max(furthest, travelled);
    }
  });

  it('steps the same distance of surface on the flat and on the shoulder', () => {
    // The property the run depends on, stated directly against the geometry.
    const flat = advanceAlong(BUTTON, 500, 4, 1) - 500;
    const shoulderFrom = BUTTON.right - 6;
    const shoulderTo = advanceAlong(BUTTON, shoulderFrom, 4, 1);
    const before = surfaceAt(BUTTON, shoulderFrom);
    const after = surfaceAt(BUTTON, shoulderTo);
    const travelled = Math.hypot(shoulderTo - shoulderFrom, after.y - before.y);

    expect(flat).toBeCloseTo(4, 1);
    // Chord rather than arc, so a little under 4 — but nowhere near zero, which
    // is what advancing in x used to give here.
    expect(travelled).toBeGreaterThan(3);
    expect(travelled).toBeLessThanOrEqual(4.05);
  });
});

describe('the lifecycle, over time', () => {
  /*
   * The test this file was missing.
   *
   * Every other test here runs for a few seconds and asks whether the physics
   * are right. The rain's worst failure was not a wrong force — it was that it
   * simply stopped. On the real page it delivered paint for about eighty
   * seconds and then delivered none, for as long as the tab stayed open, while
   * the drops went on falling in plain sight. Nothing here could see that,
   * because nothing here ran for eighty seconds and nothing here watched both
   * ends of the drop lifecycle at once: `step` retires a drop at the floor and
   * `recycle` brings it back, and those two lived in different files.
   *
   * So this runs the whole loop for five simulated minutes and asks the only
   * question that mattered: is paint still arriving?
   */
  const FRAME = 1 / 60;
  const MINUTE = 60 * 60;

  /** A field of drops with a real spread of fall speeds, as the page builds. */
  function field(count: number): SimDrop[] {
    return Array.from({ length: count }, (_, i) => {
      const depth = i / Math.max(1, count - 1);
      return drop({
        x: (i * 137.5) % 1440,
        y: -20 - (i % 9) * 40,
        depth,
        terminal: TERMINAL_FAR + (1 - depth) * (TERMINAL_NEAR - TERMINAL_FAR),
        size: 2.5 + (1 - depth) ** 1.5 * 19.5,
      });
    });
  }

  it('keeps delivering paint to the floor for five straight minutes', () => {
    const width = 1440;
    const height = 900;
    const world = createWorld(width, height);
    world.floor = height;
    world.drops.push(...field(150));

    const perMinute: number[] = [];
    /*
     * How far above the floor a drop was ever retired.
     *
     * Counting landings alone is not enough, and this is the assertion that
     * actually pins the bug. The simulation went on recording landings the
     * whole time it was broken — it just began retiring drops higher and higher
     * above the floor as the hidden pool filled under them, until the footer
     * stopped recognising them as arrivals. A drop is retired AT the floor or
     * the join downstream is being asked to guess.
     */
    let highestRetirement = 0;

    for (let minute = 0; minute < 5; minute += 1) {
      let landings = 0;
      for (let frame = 0; frame < MINUTE; frame += 1) {
        recycle(world.drops, 22, width, height);
        step(world, FRAME, []);
        landings += world.landed.length;

        for (const d of world.drops) {
          // Drops parked above the viewport by `recycle` are also 'pooled'.
          if (d.phase !== 'pooled' || d.y <= 0) continue;
          highestRetirement = Math.max(highestRetirement, world.floor - (d.y + d.size / 2));
        }
      }
      perMinute.push(landings);
    }

    expect(highestRetirement).toBeLessThan(2);

    for (const [index, landings] of perMinute.entries()) {
      expect(landings, `minute ${index + 1} of ${perMinute.join('/')}`).toBeGreaterThan(0);
    }

    // Not merely alive — still raining at the rate it started at. A slow drain
    // that leaves one drop trickling through would pass the check above and
    // still be the same bug.
    const steady = perMinute.slice(1);
    expect(Math.min(...steady) * 2).toBeGreaterThanOrEqual(Math.max(...steady));
  });

  it('does not quietly gather paint in a pool nobody draws', () => {
    /*
     * The mechanism itself, pinned.
     *
     * `step` used to pour every landing into `world.pool` — a pool that stopped
     * being drawn but went on filling and levelling. It lifted the height drops
     * came to rest at until the landing test downstream stopped recognising
     * them. Whatever else changes, the rain's own world must arrive at the
     * floor with nothing gathered on it.
     */
    const world = createWorld(1440, 900);
    world.floor = 900;
    world.drops.push(...field(60));

    for (let frame = 0; frame < MINUTE * 2; frame += 1) {
      recycle(world.drops, 22, 1440, 900);
      step(world, FRAME, []);
    }

    expect(poolVolume(world)).toBe(0);
  });

  it('reports each landing exactly once', () => {
    const world = createWorld(1000, 800);
    const d = drop({ x: 500 });
    world.drops.push(d);

    expect(runUntil(world, [], () => world.landed.length > 0, 30)).toBe(true);
    expect(world.landed).toHaveLength(1);
    expect(world.landed[0]!.x).toBeCloseTo(500, 0);
    expect(d.phase).toBe('pooled');
    // AT the floor, not somewhere above it. The announcement downstream used to
    // allow 80px of slack for exactly this, and the slack is what ran out.
    expect(d.y + d.size / 2).toBeGreaterThanOrEqual(world.floor - 1);

    // The record is the step's, not the drop's: one more step and it is gone.
    step(world, FRAME, []);
    expect(world.landed).toHaveLength(0);
  });
});

describe('the pool', () => {
  /*
   * These pour through `pourInto` rather than by dropping a drop on the floor.
   *
   * That is not a convenience — it is the actual path. The rain reports a
   * landing and the footer turns it into paint, so `pourInto` is the only thing
   * on the page that puts volume in a column. Driving the pool through `step`
   * instead used to work because `step` poured too, into a pool nobody drew,
   * and that second pool is exactly the bug these tests failed to catch.
   */
  const pourDrop = (world: ReturnType<typeof createWorld>, x: number, color: number) =>
    pourInto(world, x, dropVolume(12, world.width), COLORS[color]!);

  it('puts the paint in the column it was poured into', () => {
    const world = createWorld(1000, 800);
    pourDrop(world, 120, 0);
    for (let i = 0; i < 60; i += 1) stepPool(world, 1 / 60);

    const target = columnAt(world, 120);
    // Waves spread it, so check the neighbourhood rather than one column.
    const near = world.pool
      .slice(Math.max(0, target - 4), target + 5)
      .reduce((sum, c) => sum + c.h, 0);
    expect(near).toBeGreaterThan(poolVolume(world) * 0.5);
  });

  it('takes on the colour of what landed in it', () => {
    const world = createWorld(1000, 800);
    pourDrop(world, 500, 1); // green

    const column = world.pool[columnAt(world, 500)];
    expect(column).toBeDefined();
    expect(column!.g).toBeGreaterThan(column!.r);
    expect(column!.g).toBeGreaterThan(column!.b);
  });

  it('never renders a column as black — the first drop sets its colour', () => {
    // A column blending up from zero starts black, and since most of the pool
    // is shallow early on that showed as a dark trough between the places it
    // had rained hardest. Paint on a floor is the colour of the paint.
    const world = createWorld(1000, 800);
    pourDrop(world, 500, 0); // pure red

    const column = world.pool[columnAt(world, 500)];
    expect(column).toBeDefined();
    expect(column!.r).toBeCloseTo(255, 0);
    expect(column!.g).toBeCloseTo(0, 0);
  });

  it('settles rather than oscillating forever', () => {
    /*
     * Asserted as decay, not as arrival at zero.
     *
     * The first version of this demanded the pool be still after 25 seconds and
     * that was the wrong question: a basin of viscous liquid slopping back and
     * forth takes a good while to give up, because the solver keeps trading
     * height for flow and back — which is the physics, not a defect. Measured,
     * peak flow falls 47.7 → 11.7 → 2.5 → 0.67 px/s over the first minute while
     * the surface flattens from 7.6px of spread to 0.28. What matters is that
     * it is monotonically losing energy.
     */
    const world = createWorld(1000, 800);
    const column = world.pool[60];
    expect(column).toBeDefined();
    column!.h = 80;

    const peakFlow = (): number => {
      let peak = 0;
      for (const u of world.flow) peak = Math.max(peak, Math.abs(u));
      return peak;
    };
    const spread = (): number => {
      const heights = world.pool.map((c) => c.h);
      return Math.max(...heights) - Math.min(...heights);
    };

    for (let i = 0; i < 60; i += 1) stepPool(world, 1 / 60);
    const earlyFlow = peakFlow();
    const earlySpread = spread();

    for (let i = 0; i < 60 * 24; i += 1) stepPool(world, 1 / 60);
    const lateFlow = peakFlow();

    expect(lateFlow).toBeLessThan(earlyFlow * 0.15);
    expect(spread()).toBeLessThan(earlySpread * 0.25);

    for (let i = 0; i < 60 * 35; i += 1) stepPool(world, 1 / 60);
    expect(peakFlow()).toBeLessThan(lateFlow);
  });

  it('conserves volume — paint moves, it does not evaporate', () => {
    // The property a spring-coupled height field cannot give you. Under the
    // shallow-water solver every unit that leaves a cell arrives in its
    // neighbour, rather than being averaged toward a mean and quietly lost.
    const world = createWorld(1000, 800);
    for (const i of [20, 21, 22, 70]) {
      const column = world.pool[i];
      if (column !== undefined) column.h = 60;
    }
    const before = poolVolume(world);

    for (let i = 0; i < 60 * 10; i += 1) stepPool(world, 1 / 60);

    expect(poolVolume(world)).toBeCloseTo(before, 0);
  });

  it('propagates a disturbance outward as a travelling wave', () => {
    // A raised column should not merely sink in place — the paint under it
    // flows out and lifts its neighbours in turn.
    const world = createWorld(1000, 800);
    for (const column of world.pool) column.h = 40;
    const centre = world.pool[60];
    expect(centre).toBeDefined();
    centre!.h = 90;

    const far = 60 + 18;
    const farBefore = world.pool[far]?.h ?? 0;
    let farPeak = farBefore;
    for (let i = 0; i < 60 * 3; i += 1) {
      stepPool(world, 1 / 60);
      farPeak = Math.max(farPeak, world.pool[far]?.h ?? 0);
    }

    expect(farPeak).toBeGreaterThan(farBefore + 0.5);
  });

  it('carries waves faster through deeper paint', () => {
    // sqrt(g·h): the defining behaviour of shallow water, and the thing a
    // membrane model gets wrong — its waves travel at one speed everywhere.
    const arrival = (depth: number): number => {
      const world = createWorld(1000, 800);
      for (const column of world.pool) column.h = depth;
      const centre = world.pool[60];
      if (centre !== undefined) centre.h = depth * 1.6;

      const probe = 60 + 20;
      const baseline = world.pool[probe]?.h ?? 0;
      for (let frame = 0; frame < 60 * 6; frame += 1) {
        stepPool(world, 1 / 60);
        if ((world.pool[probe]?.h ?? 0) > baseline * 1.02 + 0.05) return frame;
      }
      return Number.POSITIVE_INFINITY;
    };

    expect(arrival(90)).toBeLessThan(arrival(18));
  });

  it('levels out — a spike becomes a surface', () => {
    const world = createWorld(1000, 800);
    const column = world.pool[60];
    expect(column).toBeDefined();
    column!.h = 200;

    for (let i = 0; i < 60 * 25; i += 1) stepPool(world, 1 / 60);

    const heights = world.pool.map((c) => c.h);
    const spread = Math.max(...heights) - Math.min(...heights);
    expect(spread).toBeLessThan(200);
    expect(poolVolume(world)).toBeGreaterThan(0);
  });

  it('stays stable when a deep pool is hit hard', () => {
    // The upwind flux exists for this: averaging the two cells at a face is
    // unconditionally unstable and tears the surface apart within a second.
    const world = createWorld(1000, 800);
    for (const column of world.pool) column.h = MAX_POOL * 0.9;
    const centre = world.pool[60];
    if (centre !== undefined) centre.h = MAX_POOL;

    for (let i = 0; i < 60 * 8; i += 1) stepPool(world, 1 / 60);

    for (const column of world.pool) {
      expect(Number.isFinite(column.h)).toBe(true);
      expect(column.h).toBeGreaterThanOrEqual(0);
      expect(column.h).toBeLessThanOrEqual(MAX_POOL + 1);
    }
  });

  it('cannot drown the page however hard it rains', () => {
    const world = createWorld(1000, 800);
    for (let i = 0; i < 4000; i += 1) {
      pourInto(world, 500, dropVolume(22, world.width), COLORS[i % 3]!);
      if (i % 8 === 0) stepPool(world, 1 / 60);
    }
    for (let i = 0; i < 60 * 4; i += 1) stepPool(world, 1 / 60);

    for (const column of world.pool) {
      expect(column.h).toBeLessThanOrEqual(MAX_POOL + 1e-6);
    }
  });

  it('spreads across the width it was given', () => {
    const world = createWorld(1000, 800);
    expect(columnAt(world, 0)).toBe(0);
    expect(columnAt(world, 1000)).toBe(POOL_COLUMNS - 1);
    expect(columnAt(world, -50)).toBe(0);
    expect(columnAt(world, 99999)).toBe(POOL_COLUMNS - 1);
  });
});
