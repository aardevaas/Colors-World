import { describe, expect, it } from 'vitest';
import {
  INTAKE_SPEED,
  buildPath,
  sampleAt,
  stepSpray,
  stepTube,
  type Carried,
  type Ejected,
  type Point,
} from '../paint-tube';

const STRAIGHT_DOWN: Point[] = [
  { x: 0, y: 0 },
  { x: 0, y: 100 },
  { x: 0, y: 200 },
  { x: 0, y: 300 },
];

/** Down, round a loop, and out to the right. */
const WITH_LOOP: Point[] = [
  { x: 0, y: 0 },
  { x: 40, y: 120 },
  { x: 140, y: 200 },
  { x: 220, y: 120 },
  { x: 140, y: 40 },
  { x: 60, y: 120 },
  { x: 140, y: 260 },
  { x: 320, y: 300 },
];

function carried(overrides: Partial<Carried> = {}): Carried {
  return { s: 0, v: INTAKE_SPEED, lane: 0, size: 10, color: 0, ...overrides };
}

describe('buildPath', () => {
  it('passes through the points it was given', () => {
    // Catmull-Rom rather than Bezier for exactly this: the tube is designed by
    // placing the positions it must visit.
    const path = buildPath(STRAIGHT_DOWN);
    const start = sampleAt(path, 0);
    const end = sampleAt(path, path.total);

    expect(start.x).toBeCloseTo(0, 1);
    expect(start.y).toBeCloseTo(0, 1);
    expect(end.x).toBeCloseTo(0, 1);
    expect(end.y).toBeCloseTo(300, 1);
  });

  it('measures its own length', () => {
    const path = buildPath(STRAIGHT_DOWN);
    expect(path.total).toBeGreaterThan(295);
    expect(path.total).toBeLessThan(310);
  });

  it('reports a unit tangent that points along the path', () => {
    const path = buildPath(STRAIGHT_DOWN);
    const mid = sampleAt(path, path.total / 2);
    expect(Math.hypot(mid.tx, mid.ty)).toBeCloseTo(1, 3);
    // Straight down.
    expect(mid.ty).toBeCloseTo(1, 2);
  });

  it('survives being handed too few points to make a path', () => {
    const path = buildPath([{ x: 0, y: 0 }]);
    expect(path.total).toBe(0);
    expect(sampleAt(path, 10)).toEqual({ x: 0, y: 0, tx: 1, ty: 0 });
  });

  it('clamps a distance past either end', () => {
    const path = buildPath(STRAIGHT_DOWN);
    expect(sampleAt(path, -50).y).toBeCloseTo(0, 1);
    expect(sampleAt(path, path.total + 500).y).toBeCloseTo(300, 1);
  });
});

describe('travelling the tube', () => {
  it('gains speed going down', () => {
    const path = buildPath(STRAIGHT_DOWN);
    const p = carried({ v: 20 });
    stepTube([p], path, 0.2);
    expect(p.v).toBeGreaterThan(20);
  });

  it('loses speed climbing', () => {
    // The far side of the loop, where the tube is heading upward.
    const path = buildPath(WITH_LOOP);
    const climbing = findWhere(path, (sample) => sample.ty < -0.7);
    expect(climbing).toBeGreaterThan(0);

    const p = carried({ s: climbing, v: 400 });
    stepTube([p], path, 0.15);
    expect(p.v).toBeLessThan(400);
  });

  it('is slowest at the top of the loop', () => {
    // The signature of a ride rather than a conveyor.
    const path = buildPath(WITH_LOOP);
    const p = carried({ v: 900 });
    let atTop = Number.POSITIVE_INFINITY;
    let atStart = p.v;

    for (let i = 0; i < 600; i += 1) {
      stepTube([p], path, 1 / 60);
      if (p.s >= path.total) break;
      const here = sampleAt(path, p.s);
      // Near the loop's crown, where the tube is briefly level again.
      if (here.y < 60) atTop = Math.min(atTop, p.v);
    }
    expect(atTop).toBeLessThan(atStart);
  });

  it('never stalls to a standstill inside the glass', () => {
    const path = buildPath(WITH_LOOP);
    const p = carried({ v: 30 });
    for (let i = 0; i < 60 * 30; i += 1) {
      stepTube([p], path, 1 / 60);
      if (p.s >= path.total) return;
      expect(p.v).toBeGreaterThan(0);
    }
  });

  it('cannot run backwards out of the intake', () => {
    const path = buildPath(WITH_LOOP);
    const p = carried({ s: 4, v: -600 });
    for (let i = 0; i < 40; i += 1) stepTube([p], path, 1 / 60);
    expect(p.s).toBeGreaterThanOrEqual(0);
  });

  it('ejects at the end, along the tube it left by', () => {
    const path = buildPath(STRAIGHT_DOWN);
    const p = carried({ s: path.total - 2, v: 300 });
    const out = stepTube([p], path, 0.2);

    expect(out).toHaveLength(1);
    expect(out[0]?.vy).toBeGreaterThan(0);
    expect(Math.abs(out[0]?.vx ?? 99)).toBeLessThan(60);
  });

  it('everything put in eventually comes out', () => {
    const path = buildPath(WITH_LOOP);
    const carriedAll = Array.from({ length: 12 }, (_, i) => carried({ s: i * 4 }));
    let out = 0;
    for (let i = 0; i < 60 * 60 && out < 12; i += 1) {
      out += stepTube(carriedAll, path, 1 / 60).length;
    }
    expect(out).toBe(12);
    expect(carriedAll).toHaveLength(0);
  });
});

describe('the spray', () => {
  it('arcs under gravity and reports what hits the wall', () => {
    const spray: Ejected[] = [{ x: 0, y: 0, vx: 400, vy: -50, size: 8, color: 2 }];
    let hits: ReturnType<typeof stepSpray> = [];
    let peak = 0;
    for (let i = 0; i < 120 && hits.length === 0; i += 1) {
      peak = Math.min(peak, spray[0]?.y ?? 0);
      hits = stepSpray(spray, 1 / 60, 900, 300, 600);
    }

    expect(hits).toHaveLength(1);
    expect(hits[0]?.color).toBe(2);
    // A real arc: it rose above where it left, then fell well below it. Thrown
    // upward at 50px/s under 900px/s² it is over the top inside a sixteenth of
    // a second and falling for the remaining three-quarters of the flight.
    expect(peak).toBeLessThan(0);
    expect(hits[0]?.y).toBeGreaterThan(100);
  });

  it('gives up on anything that falls out of the world', () => {
    const spray: Ejected[] = [{ x: 0, y: 0, vx: 5, vy: 100, size: 8, color: 0 }];
    for (let i = 0; i < 240; i += 1) stepSpray(spray, 1 / 60, 900, 4000, 400);
    expect(spray).toHaveLength(0);
  });
});

/** First distance along `path` whose sample matches. */
function findWhere(
  path: ReturnType<typeof buildPath>,
  match: (sample: ReturnType<typeof sampleAt>) => boolean
): number {
  for (let s = 0; s < path.total; s += 2) {
    if (match(sampleAt(path, s))) return s;
  }
  return -1;
}
