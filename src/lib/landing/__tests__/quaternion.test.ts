import { describe, expect, it } from 'vitest';
import {
  quatConjugate,
  quatFromAxisAngle,
  quatIdentity,
  quatLength,
  quatMultiply,
  quatNormalize,
  rotateVector,
} from '../quaternion';
import { vec3Length } from '../vec3';

const HALF_PI = Math.PI / 2;

describe('quatFromAxisAngle + rotateVector', () => {
  it('identity quaternion leaves a vector unchanged', () => {
    const v = { x: 1, y: 2, z: 3 };
    const result = rotateVector(v, quatIdentity());
    expect(result.x).toBeCloseTo(v.x);
    expect(result.y).toBeCloseTo(v.y);
    expect(result.z).toBeCloseTo(v.z);
  });

  it('zero-angle rotation is the identity', () => {
    const q = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0);
    const result = rotateVector({ x: 1, y: 0, z: 0 }, q);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('rotates 90deg around Z: (1,0,0) -> (0,1,0)', () => {
    const q = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, HALF_PI);
    const result = rotateVector({ x: 1, y: 0, z: 0 }, q);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
    expect(result.z).toBeCloseTo(0);
  });

  it('rotates 90deg around Y: (0,0,1) -> (1,0,0)', () => {
    const q = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, HALF_PI);
    const result = rotateVector({ x: 0, y: 0, z: 1 }, q);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
    expect(result.z).toBeCloseTo(0);
  });

  it('rotation about an axis leaves a point on that axis unchanged', () => {
    const axis = { x: 0, y: 1, z: 0 };
    const q = quatFromAxisAngle(axis, 1.234);
    const result = rotateVector({ x: 0, y: 5, z: 0 }, q);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(5);
    expect(result.z).toBeCloseTo(0);
  });

  it('preserves vector length (rotation is an isometry)', () => {
    const axis = { x: 1, y: 1, z: 1 };
    const q = quatFromAxisAngle(
      { x: axis.x / Math.sqrt(3), y: axis.y / Math.sqrt(3), z: axis.z / Math.sqrt(3) },
      0.77
    );
    const v = { x: 3, y: -4, z: 1.5 };
    const result = rotateVector(v, q);
    expect(vec3Length(result)).toBeCloseTo(vec3Length(v));
  });
});

describe('quatMultiply', () => {
  it('composes so multiply(a, b) applies b first, then a', () => {
    // Rotate 90deg about Z, then 90deg about X.
    const rotateZ90 = quatFromAxisAngle({ x: 0, y: 0, z: 1 }, HALF_PI);
    const rotateX90 = quatFromAxisAngle({ x: 1, y: 0, z: 0 }, HALF_PI);
    const combined = quatMultiply(rotateX90, rotateZ90);

    const v = { x: 1, y: 0, z: 0 };
    const viaCombined = rotateVector(v, combined);
    const viaSequential = rotateVector(rotateVector(v, rotateZ90), rotateX90);

    expect(viaCombined.x).toBeCloseTo(viaSequential.x);
    expect(viaCombined.y).toBeCloseTo(viaSequential.y);
    expect(viaCombined.z).toBeCloseTo(viaSequential.z);
  });

  it('multiplying by identity is a no-op', () => {
    const q = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.5);
    const result = quatMultiply(q, quatIdentity());
    expect(result.x).toBeCloseTo(q.x);
    expect(result.y).toBeCloseTo(q.y);
    expect(result.z).toBeCloseTo(q.z);
    expect(result.w).toBeCloseTo(q.w);
  });
});

describe('quatConjugate', () => {
  it('undoes the rotation it conjugates', () => {
    const q = quatFromAxisAngle(
      { x: 0.4082, y: 0.4082, z: 0.8165 },
      1.1
    );
    const v = { x: 2, y: -1, z: 0.5 };
    const rotated = rotateVector(v, q);
    const restored = rotateVector(rotated, quatConjugate(q));
    expect(restored.x).toBeCloseTo(v.x, 3);
    expect(restored.y).toBeCloseTo(v.y, 3);
    expect(restored.z).toBeCloseTo(v.z, 3);
  });
});

describe('quatNormalize', () => {
  it('produces a unit-length quaternion', () => {
    const q = quatNormalize({ x: 1, y: 2, z: 3, w: 4 });
    expect(quatLength(q)).toBeCloseTo(1);
  });

  it('falls back to identity for a zero quaternion rather than dividing by zero', () => {
    const q = quatNormalize({ x: 0, y: 0, z: 0, w: 0 });
    expect(q).toEqual(quatIdentity());
  });

  it('repeated multiplication stays unit-length after renormalizing each step', () => {
    let q = quatIdentity();
    const step = quatFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.31);
    for (let i = 0; i < 500; i += 1) {
      q = quatNormalize(quatMultiply(step, q));
    }
    expect(quatLength(q)).toBeCloseTo(1, 5);
  });
});
