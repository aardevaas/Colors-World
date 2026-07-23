/**
 * Palette version control — a git-like DAG over `PaletteSnapshot`s.
 *
 * Pure TypeScript, same discipline as `color-engine`: no persistence, no
 * React, fully testable in isolation. Supabase wiring (Phase 3b) stores
 * `VersionNode`s and their snapshots; everything in this module is agnostic
 * to where that data actually lives.
 */

export type {
  ChangeKind,
  MergeConflict,
  MergeResult,
  PaletteSnapshot,
  TokenDelta,
  VersionNode,
} from './types';

export { blendOklch } from './blend';
export { findLowestCommonAncestor, isAncestor } from './dag';
export { deltaEOk, diffSnapshots, shortestHueDelta } from './diff';
export { isCleanMerge, threeWayMerge } from './merge';
export { formatConflictReport } from './report';
export { snapshotFromScales } from './snapshot';
