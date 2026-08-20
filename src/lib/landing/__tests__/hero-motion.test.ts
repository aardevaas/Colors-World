import { describe, expect, it } from 'vitest';
import {
  POINTER_PITCH_DEG,
  POINTER_YAW_DEG,
  composeRotation,
  damp,
  dampEuler,
  idleTumble,
  pointerRotation,
} from '../hero-motion';

const DEG = Math.PI / 180;

describe('idleTumble — the motion that runs when nobody is touching it', () => {
  it('keeps moving with no input at all', () => {
    // The whole reason this function exists. Proven on the reference by two
    // captures with the pointer unmoved and the word at different angles.
    const a = idleTumble(0);
    const b = idleTumble(2.5);
    expect(a).not.toEqual(b);
  });

  it('never visibly repeats inside a minute', () => {
    // Three sines on unrelated periods. If someone "tidies" them to a common
    // period the motion becomes a metronome, so this guards the choice.
    const start = idleTumble(0);
    for (let t = 1; t <= 60; t += 0.5) {
      const now = idleTumble(t);
      const identical =
        Math.abs(now.x - start.x) < 1e-6 &&
        Math.abs(now.y - start.y) < 1e-6 &&
        Math.abs(now.z - start.z) < 1e-6;
      expect(identical).toBe(false);
    }
  });

  it('stays within a gentle amplitude on every axis', () => {
    // A tumble that swings too far stops reading as "resting" and starts
    // reading as "spinning", which is not what the reference does.
    for (let t = 0; t < 200; t += 0.37) {
      const e = idleTumble(t);
      expect(Math.abs(e.x)).toBeLessThanOrEqual(8 * DEG);
      expect(Math.abs(e.y)).toBeLessThanOrEqual(14 * DEG);
      expect(Math.abs(e.z)).toBeLessThanOrEqual(4 * DEG);
    }
  });

  it('is deterministic and survives a nonsense clock', () => {
    expect(idleTumble(3.2)).toEqual(idleTumble(3.2));
    expect(idleTumble(Number.NaN)).toEqual(idleTumble(0));
  });
});

describe('pointerRotation — which way it turns', () => {
  it('turns toward the cursor, not away from it', () => {
    // Sign error here is the difference between the word looking at you and
    // recoiling from you. Cursor to the right => positive yaw.
    expect(pointerRotation(1, 0).y).toBeGreaterThan(0);
    expect(pointerRotation(-1, 0).y).toBeLessThan(0);
    // Screen Y is inverted relative to rotation pitch.
    expect(pointerRotation(0, 1).x).toBeLessThan(0);
    expect(pointerRotation(0, -1).x).toBeGreaterThan(0);
  });

  it('is centred and still at the middle of the screen', () => {
    expect(pointerRotation(0, 0)).toEqual({ x: -0, y: 0, z: 0 });
  });

  it('clamps beyond the viewport rather than winding up', () => {
    expect(pointerRotation(9, 9)).toEqual(pointerRotation(1, 1));
    expect(pointerRotation(-9, -9)).toEqual(pointerRotation(-1, -1));
  });

  it('never exceeds its stated limits', () => {
    const corner = pointerRotation(1, 1);
    expect(Math.abs(corner.y)).toBeCloseTo(POINTER_YAW_DEG * DEG, 10);
    expect(Math.abs(corner.x)).toBeCloseTo(POINTER_PITCH_DEG * DEG, 10);
  });

  it('survives NaN from a pointer event that has not fired yet', () => {
    expect(pointerRotation(Number.NaN, Number.NaN)).toEqual({ x: -0, y: 0, z: 0 });
  });
});

describe('damp — the lag that makes it feel weighted', () => {
  it('moves toward the target without overshooting it', () => {
    let v = 0;
    for (let i = 0; i < 100; i += 1) {
      const next = damp(v, 10, 6, 1 / 60);
      expect(next).toBeGreaterThanOrEqual(v);
      expect(next).toBeLessThanOrEqual(10);
      v = next;
    }
    expect(v).toBeCloseTo(10, 3);
  });

  it('converges the same amount per second at any frame rate', () => {
    // The naive lerp form fails this: it moves further per second at 144Hz
    // than at 60Hz, so the feel changes with the machine.
    const settle = (dt: number) => {
      let v = 0;
      for (let t = 0; t < 1; t += dt) v = damp(v, 1, 4, dt);
      return v;
    };
    expect(Math.abs(settle(1 / 60) - settle(1 / 144))).toBeLessThan(0.01);
  });

  it('holds still when the clock does not advance', () => {
    expect(damp(3, 10, 5, 0)).toBe(3);
    expect(damp(3, 10, 5, Number.NaN)).toBe(3);
  });

  it('damps all three axes together', () => {
    const out = dampEuler({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 3 }, 5, 1 / 60);
    expect(out.x).toBeGreaterThan(0);
    expect(out.y).toBeGreaterThan(out.x);
    expect(out.z).toBeGreaterThan(out.y);
  });
});

describe('composeRotation', () => {
  it('adds the pointer offset on top of the idle tumble', () => {
    const idle = idleTumble(4);
    const ptr = pointerRotation(0.5, -0.25);
    const out = composeRotation(idle, ptr);
    expect(out.x).toBeCloseTo(idle.x + ptr.x, 12);
    expect(out.y).toBeCloseTo(idle.y + ptr.y, 12);
  });

  it('still tumbles when the pointer contributes nothing', () => {
    // Someone who never moves their mouse must still see motion.
    const rest = pointerRotation(0, 0);
    expect(composeRotation(idleTumble(1), rest)).not.toEqual(
      composeRotation(idleTumble(3), rest)
    );
  });
});
