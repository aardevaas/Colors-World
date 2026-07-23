import { describe, expect, test } from 'vitest';
import { isCleanMerge, threeWayMerge } from '../merge';

describe('threeWayMerge', () => {
  test('an untouched token keeps the base value', () => {
    const base = { 'brand-5': '#3b82f6' };
    const result = threeWayMerge(base, base, base);
    expect(result.snapshot).toEqual({ 'brand-5': '#3b82f6' });
    expect(result.conflicts).toEqual([]);
  });

  test('a change on only one side is taken without conflict', () => {
    const base = { 'brand-5': '#3b82f6' };
    const ours = { 'brand-5': '#2563eb' };
    const result = threeWayMerge(base, ours, base);
    expect(result.snapshot).toEqual({ 'brand-5': '#2563eb' });
    expect(isCleanMerge(result)).toBe(true);
  });

  test('a change on the other side is taken without conflict', () => {
    const base = { 'brand-5': '#3b82f6' };
    const theirs = { 'brand-5': '#1d4ed8' };
    const result = threeWayMerge(base, base, theirs);
    expect(result.snapshot).toEqual({ 'brand-5': '#1d4ed8' });
    expect(isCleanMerge(result)).toBe(true);
  });

  test('identical changes on both sides merge cleanly', () => {
    const base = { 'brand-5': '#3b82f6' };
    const changed = { 'brand-5': '#2563eb' };
    const result = threeWayMerge(base, changed, changed);
    expect(result.snapshot).toEqual({ 'brand-5': '#2563eb' });
    expect(isCleanMerge(result)).toBe(true);
  });

  test('divergent changes on both sides produce a conflict', () => {
    const base = { 'brand-5': '#3b82f6' };
    const ours = { 'brand-5': '#2563eb' };
    const theirs = { 'brand-5': '#1d4ed8' };
    const result = threeWayMerge(base, ours, theirs);

    expect(isCleanMerge(result)).toBe(false);
    expect(result.conflicts).toEqual([
      { token: 'brand-5', base: '#3b82f6', ours: '#2563eb', theirs: '#1d4ed8' },
    ]);
    // Base is retained as the safe placeholder pending resolution.
    expect(result.snapshot['brand-5']).toBe('#3b82f6');
  });

  test('a token added identically on both sides merges cleanly', () => {
    const base = {};
    const ours = { 'accent-3': '#ef4444' };
    const theirs = { 'accent-3': '#ef4444' };
    const result = threeWayMerge(base, ours, theirs);
    expect(result.snapshot).toEqual({ 'accent-3': '#ef4444' });
    expect(isCleanMerge(result)).toBe(true);
  });

  test('a token added with different values on both sides conflicts', () => {
    const result = threeWayMerge(
      {},
      { 'accent-3': '#ef4444' },
      { 'accent-3': '#f97316' }
    );
    expect(isCleanMerge(result)).toBe(false);
    expect(result.conflicts[0]).toEqual({
      token: 'accent-3',
      base: null,
      ours: '#ef4444',
      theirs: '#f97316',
    });
    expect(result.snapshot).toEqual({});
  });

  test('modify vs delete is a conflict, not a silent resolution', () => {
    const base = { 'brand-5': '#3b82f6' };
    const ours = { 'brand-5': '#2563eb' }; // modified
    const theirs = {}; // deleted
    const result = threeWayMerge(base, ours, theirs);

    expect(isCleanMerge(result)).toBe(false);
    expect(result.conflicts[0]).toEqual({
      token: 'brand-5',
      base: '#3b82f6',
      ours: '#2563eb',
      theirs: null,
    });
  });

  test('a token removed identically on both sides merges cleanly, and stays out', () => {
    const base = { 'brand-5': '#3b82f6', keep: '#000000' };
    const ours = { keep: '#000000' };
    const theirs = { keep: '#000000' };
    const result = threeWayMerge(base, ours, theirs);
    expect(result.snapshot).toEqual({ keep: '#000000' });
    expect(isCleanMerge(result)).toBe(true);
  });

  test('conflicts are sorted by token name', () => {
    const base = { zeta: '#000000', alpha: '#ffffff' };
    const ours = { zeta: '#111111', alpha: '#eeeeee' };
    const theirs = { zeta: '#222222', alpha: '#dddddd' };
    const result = threeWayMerge(base, ours, theirs);
    expect(result.conflicts.map((c) => c.token)).toEqual(['alpha', 'zeta']);
  });
});
