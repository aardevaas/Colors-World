import { describe, expect, it } from 'vitest';
import {
  MAX_POOL,
  POOL_COLUMNS,
  REST_MS,
  TERMINAL_VELOCITY,
  columnAt,
  createWorld,
  poolVolume,
  step,
  stepPool,
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
    ...overrides,
  };
}

const BUTTON: Surface = { left: 400, top: 300, right: 600, bottom: 340, absorbs: false };
const SPONGE: Surface = { left: 700, top: 300, right: 900, bottom: 340, absorbs: true };

/** Runs the world for `seconds` in realistic frame-sized steps. */
function run(world: ReturnType<typeof createWorld>, surfaces: Surface[], seconds: number) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) step(world, dt, surfaces, COLORS);
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
    step(world, dt, surfaces, COLORS);
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
    expect(d.vy).toBeLessThanOrEqual(TERMINAL_VELOCITY + 1e-6);
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
    const d = drop({ vy: TERMINAL_VELOCITY, y: BUTTON.top - 30 });
    world.drops.push(d);

    run(world, [BUTTON], 0.5);
    expect(d.phase).toBe('resting');
  });

  it('sits still before it starts to run off', () => {
    const world = createWorld(1000, 800);
    const d = drop();
    world.drops.push(d);
    runUntil(world, [BUTTON], () => d.phase === 'resting');

    const landedAt = d.x;
    expect(d.restLeft).toBeGreaterThan(0);
    expect(d.restLeft).toBeLessThanOrEqual(REST_MS);

    // Still exactly where it landed a few frames later.
    run(world, [BUTTON], 0.1);
    expect(d.x).toBe(landedAt);
  });

  it('runs off the nearer edge and falls again', () => {
    const world = createWorld(1000, 800);
    world.floor = 100_000;
    // Landing right of centre should send it right.
    const d = drop({ x: 580 });
    world.drops.push(d);

    expect(runUntil(world, [BUTTON], () => d.phase === 'resting')).toBe(true);
    expect(d.runoff).toBe(1);

    run(world, [BUTTON], 2);
    expect(d.phase).toBe('falling');
    expect(d.x).toBeGreaterThan(BUTTON.right);
  });

  it('sends a drop that landed left of centre off the left edge', () => {
    const world = createWorld(1000, 800);
    world.floor = 100_000;
    const d = drop({ x: 420 });
    world.drops.push(d);

    run(world, [BUTTON], 3);
    expect(d.x).toBeLessThan(BUTTON.left);
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

  it('never lets an absorbed drop come to a dead stop', () => {
    const world = createWorld(1000, 800);
    const d = drop({ x: 800 });
    world.drops.push(d);
    run(world, [SPONGE], 20);
    expect(Math.abs(d.vx) + Math.abs(d.vy)).toBeGreaterThan(0);
  });
});

describe('the pool', () => {
  it('collects drops that reach the floor', () => {
    const world = createWorld(1000, 800);
    world.drops.push(drop({ x: 500 }));

    run(world, [], 3);
    expect(world.drops[0]?.phase).toBe('pooled');
    expect(poolVolume(world)).toBeGreaterThan(0);
  });

  it('puts the paint in the column it landed in', () => {
    const world = createWorld(1000, 800);
    world.drops.push(drop({ x: 120 }));
    run(world, [], 3);

    const target = columnAt(world, 120);
    // Waves spread it, so check the neighbourhood rather than one column.
    const near = world.pool
      .slice(Math.max(0, target - 4), target + 5)
      .reduce((sum, c) => sum + c.h, 0);
    expect(near).toBeGreaterThan(poolVolume(world) * 0.5);
  });

  it('takes on the colour of what landed in it', () => {
    const world = createWorld(1000, 800);
    world.drops.push(drop({ x: 500, color: 1 })); // green
    run(world, [], 3);

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
    world.drops.push(drop({ x: 500, color: 0 })); // pure red
    run(world, [], 3);

    const column = world.pool[columnAt(world, 500)];
    expect(column).toBeDefined();
    expect(column!.r).toBeCloseTo(255, 0);
    expect(column!.g).toBeCloseTo(0, 0);
  });

  it('settles rather than oscillating forever', () => {
    const world = createWorld(1000, 800);
    const column = world.pool[60];
    expect(column).toBeDefined();
    column!.h = 80;
    column!.v = -400;

    for (let i = 0; i < 60 * 20; i += 1) stepPool(world, 1 / 60);

    const energy = world.pool.reduce((sum, c) => sum + Math.abs(c.v), 0);
    expect(energy).toBeLessThan(1);
  });

  it('levels out — a spike becomes a surface', () => {
    const world = createWorld(1000, 800);
    const column = world.pool[60];
    expect(column).toBeDefined();
    column!.h = 200;

    for (let i = 0; i < 60 * 20; i += 1) stepPool(world, 1 / 60);

    const heights = world.pool.map((c) => c.h);
    const spread = Math.max(...heights) - Math.min(...heights);
    expect(spread).toBeLessThan(200);
    // And it did not simply vanish.
    expect(poolVolume(world)).toBeGreaterThan(0);
  });

  it('cannot drown the page however hard it rains', () => {
    const world = createWorld(1000, 800);
    for (let i = 0; i < 4000; i += 1) {
      world.drops.push(drop({ x: 500, y: 790, size: 22, color: i % 3 }));
    }
    run(world, [], 4);

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
