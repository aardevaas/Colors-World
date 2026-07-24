import { describe, expect, test } from 'vitest';
import { projectSpherePoint } from '../sphere-projection';

describe('projectSpherePoint', () => {
  const radius = 100;
  const centerX = 200;
  const centerY = 200;

  test('far pole (theta=0, phi=0) projects to centre with positive depth', () => {
    const point = projectSpherePoint(0, 0, 0, radius, centerX, centerY);
    expect(point.x).toBeCloseTo(centerX);
    expect(point.y).toBeCloseTo(centerY);
    expect(point.z).toBeCloseTo(radius);
    expect(point.scale).toBeLessThan(1);
  });

  test('near pole (theta=PI, phi=0) projects to centre with negative depth and larger scale', () => {
    const point = projectSpherePoint(Math.PI, 0, 0, radius, centerX, centerY);
    expect(point.x).toBeCloseTo(centerX);
    expect(point.y).toBeCloseTo(centerY);
    expect(point.z).toBeCloseTo(-radius);
    expect(point.scale).toBeGreaterThan(1);
  });

  test('equatorial edge point (theta=PI/2, phi=0) has zero depth and unit scale', () => {
    const point = projectSpherePoint(Math.PI / 2, 0, 0, radius, centerX, centerY);
    expect(point.z).toBeCloseTo(0);
    expect(point.scale).toBeCloseTo(1);
    expect(point.x).toBeCloseTo(centerX + radius);
  });

  test('poles (phi=+-PI/2) always land on the vertical axis regardless of theta', () => {
    const northPole = projectSpherePoint(1.234, Math.PI / 2, 0, radius, centerX, centerY);
    const southPole = projectSpherePoint(-2.5, -Math.PI / 2, 0, radius, centerX, centerY);
    expect(northPole.x).toBeCloseTo(centerX);
    expect(southPole.x).toBeCloseTo(centerX);
    expect(northPole.y).toBeLessThan(centerY);
    expect(southPole.y).toBeGreaterThan(centerY);
  });

  test('rotation composes with theta — rotating by R is the same as adding R to theta', () => {
    const rotated = projectSpherePoint(0, 0.4, Math.PI / 2, radius, centerX, centerY);
    const preRotated = projectSpherePoint(Math.PI / 2, 0.4, 0, radius, centerX, centerY);
    expect(rotated.x).toBeCloseTo(preRotated.x);
    expect(rotated.y).toBeCloseTo(preRotated.y);
    expect(rotated.z).toBeCloseTo(preRotated.z);
  });

  test('nearer points always scale larger than farther points', () => {
    const near = projectSpherePoint(Math.PI, 0, 0, radius, centerX, centerY);
    const middle = projectSpherePoint(Math.PI / 2, 0, 0, radius, centerX, centerY);
    const far = projectSpherePoint(0, 0, 0, radius, centerX, centerY);
    expect(near.scale).toBeGreaterThan(middle.scale);
    expect(middle.scale).toBeGreaterThan(far.scale);
  });
});
