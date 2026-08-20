import { describe, expect, it } from 'vitest';
import { signedDistanceField } from '../distance-field';

/** Builds a coverage grid from an ASCII picture — `#` inside, `.` outside. */
function grid(rows: readonly string[]): {
  coverage: Float32Array;
  width: number;
  height: number;
} {
  const height = rows.length;
  const width = rows[0]!.length;
  const coverage = new Float32Array(width * height);
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      coverage[y * width + x] = cell === '#' ? 1 : 0;
    });
  });
  return { coverage, width, height };
}

function at(
  field: Float32Array,
  width: number,
  x: number,
  y: number
): number {
  return field[y * width + x]!;
}

describe('signedDistanceField — the sign', () => {
  it('is positive inside the shape and negative outside it', () => {
    const { coverage, width, height } = grid([
      '.....',
      '.###.',
      '.###.',
      '.###.',
      '.....',
    ]);
    const field = signedDistanceField(coverage, width, height);
    expect(at(field, width, 2, 2)).toBeGreaterThan(0);
    expect(at(field, width, 0, 0)).toBeLessThan(0);
  });

  it('grows toward the middle of a shape', () => {
    // The whole inflation trick depends on this: distance from the edge is
    // used as height, so a stroke's centre has to be its highest point or the
    // lettering comes out flat.
    const { coverage, width, height } = grid([
      '.......',
      '.#####.',
      '.#####.',
      '.#####.',
      '.#####.',
      '.#####.',
      '.......',
    ]);
    const field = signedDistanceField(coverage, width, height);
    expect(at(field, width, 3, 3)).toBeGreaterThan(at(field, width, 1, 3));
    expect(at(field, width, 3, 3)).toBeGreaterThan(at(field, width, 3, 1));
  });

  it('grows with distance away from a shape', () => {
    const { coverage, width, height } = grid([
      '.........',
      '.........',
      '.........',
      '....#....',
      '.........',
      '.........',
      '.........',
    ]);
    const field = signedDistanceField(coverage, width, height);
    // Further out is more negative.
    expect(at(field, width, 0, 3)).toBeLessThan(at(field, width, 2, 3));
    expect(at(field, width, 2, 3)).toBeLessThan(at(field, width, 3, 3));
  });
});

describe('signedDistanceField — the distances are real distances', () => {
  it('measures a straight edge in whole pixels', () => {
    // A 1-pixel-wide column: the cell itself is one step from the outside, so
    // a correct transform reports exactly 1 rather than "some positive number".
    const { coverage, width, height } = grid(['.#.', '.#.', '.#.']);
    const field = signedDistanceField(coverage, width, height);
    expect(at(field, width, 1, 1)).toBeCloseTo(1, 6);
  });

  it('measures diagonals as diagonals, not as steps', () => {
    // A Manhattan or chamfer approximation gets this wrong, and the error
    // shows up as faceting along every curved stroke.
    const { coverage, width, height } = grid([
      '.....',
      '.....',
      '..#..',
      '.....',
      '.....',
    ]);
    const field = signedDistanceField(coverage, width, height);
    // The cell diagonally two out sits at sqrt(2^2 + 2^2) from the shape.
    expect(Math.abs(at(field, width, 0, 0))).toBeCloseTo(Math.sqrt(8), 6);
    expect(Math.abs(at(field, width, 4, 4))).toBeCloseTo(Math.sqrt(8), 6);
  });

  it('is symmetric — a symmetric shape has a symmetric field', () => {
    const { coverage, width, height } = grid([
      '.....',
      '.###.',
      '.###.',
      '.###.',
      '.....',
    ]);
    const field = signedDistanceField(coverage, width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        expect(at(field, width, x, y)).toBeCloseTo(
          at(field, width, width - 1 - x, y),
          6
        );
        expect(at(field, width, x, y)).toBeCloseTo(
          at(field, width, x, height - 1 - y),
          6
        );
      }
    }
  });
});

describe('signedDistanceField — degenerate input', () => {
  it('handles a grid with nothing in it', () => {
    const { coverage, width, height } = grid(['...', '...', '...']);
    const field = signedDistanceField(coverage, width, height);
    expect(field).toHaveLength(9);
    for (const value of field) expect(value).toBeLessThan(0);
  });

  it('handles a grid that is entirely shape', () => {
    const { coverage, width, height } = grid(['###', '###', '###']);
    const field = signedDistanceField(coverage, width, height);
    for (const value of field) expect(value).toBeGreaterThan(0);
  });

  it('handles a single row and a single column', () => {
    expect(() => signedDistanceField(new Float32Array([0, 1, 0]), 3, 1)).not.toThrow();
    expect(() => signedDistanceField(new Float32Array([0, 1, 0]), 1, 3)).not.toThrow();
  });

  it('is deterministic', () => {
    const { coverage, width, height } = grid(['.#.', '###', '.#.']);
    expect(Array.from(signedDistanceField(coverage, width, height))).toEqual(
      Array.from(signedDistanceField(coverage, width, height))
    );
  });
});
