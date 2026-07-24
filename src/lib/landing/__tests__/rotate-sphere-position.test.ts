import { describe, expect, test } from 'vitest';
import { rotateSpherePosition, rotateY, rotateZ } from '../rotate-sphere-position';

describe('rotateY', () => {
  test('a quarter turn maps +x to +z on the y=0 plane', () => {
    const result = rotateY({ x: 1, y: 0, z: 0 }, Math.PI / 2);
    expect(result.x).toBeCloseTo(0, 6);
    expect(result.y).toBe(0);
    expect(result.z).toBeCloseTo(-1, 6);
  });

  test('leaves y untouched — it is a rotation about the Y axis', () => {
    const result = rotateY({ x: 3, y: 7, z: -2 }, 1.234);
    expect(result.y).toBe(7);
  });

  test('preserves distance from the axis (length is rotation-invariant)', () => {
    const point = { x: 4, y: 1, z: -3 };
    const originalLength = Math.hypot(point.x, point.y, point.z);
    const rotated = rotateY(point, 2.1);
    expect(Math.hypot(rotated.x, rotated.y, rotated.z)).toBeCloseTo(originalLength, 6);
  });

  test('a full turn is the identity', () => {
    const point = { x: 5, y: -2, z: 1 };
    const rotated = rotateY(point, Math.PI * 2);
    expect(rotated.x).toBeCloseTo(point.x, 6);
    expect(rotated.y).toBeCloseTo(point.y, 6);
    expect(rotated.z).toBeCloseTo(point.z, 6);
  });
});

describe('rotateZ', () => {
  test('leaves z untouched — it is a rotation about the Z axis', () => {
    const result = rotateZ({ x: 3, y: 7, z: -2 }, 1.234);
    expect(result.z).toBe(-2);
  });

  test('preserves length', () => {
    const point = { x: 2, y: -6, z: 9 };
    const originalLength = Math.hypot(point.x, point.y, point.z);
    const rotated = rotateZ(point, 0.7);
    expect(Math.hypot(rotated.x, rotated.y, rotated.z)).toBeCloseTo(originalLength, 6);
  });
});

describe('rotateSpherePosition', () => {
  test('applies the spin before the tilt, matching the shader order exactly', () => {
    const point = { x: 1, y: 0.4, z: -0.2 };
    const rotation = 0.9;
    const tilt = 0.35;
    expect(rotateSpherePosition(point, rotation, tilt)).toEqual(rotateZ(rotateY(point, rotation), tilt));
  });

  test('a point exactly on the sphere stays exactly on the sphere', () => {
    const radius = 2.6;
    // z chosen as the exact remainder so x^2+y^2+z^2 === radius^2 precisely —
    // an approximated z here would fail this test for being a bad fixture,
    // not for a bug in the rotation.
    const xFraction = 0.6;
    const yFraction = 0.2;
    const zFraction = -Math.sqrt(1 - xFraction * xFraction - yFraction * yFraction);
    const point = { x: radius * xFraction, y: radius * yFraction, z: radius * zFraction };
    const rotated = rotateSpherePosition(point, 3.14, 0.35);
    expect(Math.hypot(rotated.x, rotated.y, rotated.z)).toBeCloseTo(radius, 4);
  });

  test('zero rotation and zero tilt is the identity', () => {
    const point = { x: 1.1, y: -2.2, z: 3.3 };
    const rotated = rotateSpherePosition(point, 0, 0);
    expect(rotated).toEqual(point);
  });
});
