import { describe, expect, test } from 'vitest';
import { generateScale } from '@/lib/color-engine';
import { findLowestCommonAncestor } from '../dag';
import { diffSnapshots } from '../diff';
import { formatConflictReport } from '../report';
import { isCleanMerge, threeWayMerge } from '../merge';
import { snapshotFromScales } from '../snapshot';
import type { VersionNode } from '../types';

/**
 * A realistic branch-diverge-merge scenario, exercising every module in the
 * versioning package together: scale generation → snapshot → DAG → diff →
 * merge → human-readable report. Unit tests prove each piece is correct in
 * isolation; this proves they actually compose into the workflow described in
 * ARCHITECTURE.md.
 */
describe('end-to-end: branch, diverge, merge', () => {
  test('a conflicting edit on the same token surfaces a resolvable conflict', () => {
    const baseScale = generateScale({
      name: 'brand',
      anchors: [{ step: 5, color: '#3b82f6' }],
    });
    const baseSnapshot = snapshotFromScales([baseScale]);

    // Both branches nudge the same single swatch by hand — a designer picking
    // a slightly different shade for step 5 in the color picker — rather than
    // regenerating the whole scale, which would recompute every step and stop
    // this from being a "same token" conflict at all.
    const oursSnapshot = { ...baseSnapshot, 'brand-5': '#2563eb' };
    const theirsSnapshot = { ...baseSnapshot, 'brand-5': '#1d4ed8' };

    const versions = new Map<string, VersionNode>([
      ['base', { id: 'base', parentIds: [] }],
      ['ours', { id: 'ours', parentIds: ['base'] }],
      ['theirs', { id: 'theirs', parentIds: ['base'] }],
    ]);

    const mergeBaseId = findLowestCommonAncestor(versions, 'ours', 'theirs');
    expect(mergeBaseId).toBe('base');

    const merge = threeWayMerge(baseSnapshot, oursSnapshot, theirsSnapshot);
    expect(isCleanMerge(merge)).toBe(false);
    expect(merge.conflicts).toHaveLength(1);
    expect(merge.conflicts[0]!.token).toBe('brand-5');

    const report = formatConflictReport(merge.conflicts);
    expect(report).toContain('✕ brand-5');
    expect(report).toContain('1 conflict(s) require resolution.');

    // The rest of the scale (steps 0-4, 6-9) was never touched by either
    // branch, so it merges cleanly even though the palette as a whole has a
    // conflict — a conflict on one token must not block the other nine.
    expect(merge.conflicts.map((c) => c.token)).not.toContain('brand-0');
    expect(merge.snapshot['brand-0']).toBe(baseSnapshot['brand-0']);
  });

  test('divergent edits to different tokens merge cleanly with no conflicts', () => {
    const baseSnapshot = snapshotFromScales([
      generateScale({ name: 'brand', anchors: [{ step: 5, color: '#3b82f6' }] }),
      generateScale({ name: 'accent', anchors: [{ step: 5, color: '#ef4444' }] }),
    ]);

    // "ours" hand-edits only the brand swatch.
    const oursSnapshot = { ...baseSnapshot, 'brand-5': '#2563eb' };

    // "theirs" hand-edits only the accent swatch.
    const theirsSnapshot = { ...baseSnapshot, 'accent-5': '#f97316' };

    const merge = threeWayMerge(baseSnapshot, oursSnapshot, theirsSnapshot);

    expect(isCleanMerge(merge)).toBe(true);
    expect(merge.snapshot['brand-5']).toBe('#2563eb');
    expect(merge.snapshot['accent-5']).toBe('#f97316');
    expect(formatConflictReport(merge.conflicts)).toBe('No conflicts.');

    // And the diff from base to the merged result shows exactly the two
    // intentional changes, nothing more.
    const changes = diffSnapshots(baseSnapshot, merge.snapshot).filter(
      (delta) => delta.kind === 'changed'
    );
    expect(changes.map((c) => c.token).sort()).toEqual(['accent-5', 'brand-5']);
    expect(changes.every((c) => c.deltaEOk! > 0)).toBe(true);
  });
});
