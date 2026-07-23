import { describe, expect, test } from 'vitest';
import { findLowestCommonAncestor, isAncestor } from '../dag';
import type { VersionNode } from '../types';

function graph(edges: Record<string, readonly string[]>): Map<string, VersionNode> {
  const map = new Map<string, VersionNode>();
  for (const [id, parentIds] of Object.entries(edges)) {
    map.set(id, { id, parentIds });
  }
  return map;
}

describe('findLowestCommonAncestor', () => {
  test('a version is its own ancestor', () => {
    const versions = graph({ a: [] });
    expect(findLowestCommonAncestor(versions, 'a', 'a')).toBe('a');
  });

  test('finds the fork point of two simple branches', () => {
    //   base
    //   /  \
    // ours theirs
    const versions = graph({
      base: [],
      ours: ['base'],
      theirs: ['base'],
    });
    expect(findLowestCommonAncestor(versions, 'ours', 'theirs')).toBe('base');
  });

  test('picks the nearer common ancestor on a longer linear chain', () => {
    // root -> a -> b -> ours
    //              \--> theirs
    const versions = graph({
      root: [],
      a: ['root'],
      b: ['a'],
      ours: ['b'],
      theirs: ['b'],
    });
    expect(findLowestCommonAncestor(versions, 'ours', 'theirs')).toBe('b');
  });

  test('walks past a merge commit to find the true fork point', () => {
    // root -> a -> ours
    //          \-> b -> theirs
    // a merge commit "m" (parents ours, b) exists but is not on either
    // queried path, and must not confuse the search.
    const versions = graph({
      root: [],
      a: ['root'],
      ours: ['a'],
      b: ['a'],
      theirs: ['b'],
      m: ['ours', 'b'],
    });
    expect(findLowestCommonAncestor(versions, 'ours', 'theirs')).toBe('a');
  });

  test('returns null for disjoint histories', () => {
    const versions = graph({
      a: [],
      ours: ['a'],
      c: [],
      theirs: ['c'],
    });
    expect(findLowestCommonAncestor(versions, 'ours', 'theirs')).toBeNull();
  });

  test('finds a common ancestor across a merge commit', () => {
    // root -> a -> b (merge of a and c) -> ours
    //    \--> c ----^
    //          \--> theirs
    const versions = graph({
      root: [],
      a: ['root'],
      c: ['root'],
      b: ['a', 'c'],
      ours: ['b'],
      theirs: ['c'],
    });
    expect(findLowestCommonAncestor(versions, 'ours', 'theirs')).toBe('c');
  });
});

describe('isAncestor', () => {
  test('true for a direct parent', () => {
    const versions = graph({ a: [], b: ['a'] });
    expect(isAncestor(versions, 'a', 'b')).toBe(true);
  });

  test('true transitively through several generations', () => {
    const versions = graph({ a: [], b: ['a'], c: ['b'], d: ['c'] });
    expect(isAncestor(versions, 'a', 'd')).toBe(true);
  });

  test('false for unrelated versions', () => {
    const versions = graph({ a: [], b: [] });
    expect(isAncestor(versions, 'a', 'b')).toBe(false);
  });

  test('false when the direction is reversed', () => {
    const versions = graph({ a: [], b: ['a'] });
    expect(isAncestor(versions, 'b', 'a')).toBe(false);
  });
});
