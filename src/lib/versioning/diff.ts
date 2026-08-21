import { deltaEOk, parseColor, shortestHueDelta } from '@/lib/color-engine';
import type { PaletteSnapshot, TokenDelta } from './types';

// Re-exported for existing consumers — deltaEOk/shortestHueDelta live in the
// color engine now (they're perceptual-distance primitives, not versioning
// concerns), but this module's public surface stays the same.
export { deltaEOk, shortestHueDelta };

/**
 * Per-token diff between two snapshots. Every token that appears in either
 * snapshot gets an entry — including unchanged ones — so a caller can render
 * a complete before/after view without cross-referencing the raw snapshots.
 *
 * Results are sorted by token name for a stable, diffable ordering.
 */
export function diffSnapshots(
  before: PaletteSnapshot,
  after: PaletteSnapshot
): TokenDelta[] {
  const tokens = new Set([...Object.keys(before), ...Object.keys(after)]);
  const deltas: TokenDelta[] = [];

  for (const token of tokens) {
    const beforeValue = before[token];
    const afterValue = after[token];

    if (beforeValue === undefined && afterValue !== undefined) {
      deltas.push({ token, kind: 'added', before: null, after: afterValue });
      continue;
    }

    if (beforeValue !== undefined && afterValue === undefined) {
      deltas.push({ token, kind: 'removed', before: beforeValue, after: null });
      continue;
    }

    if (beforeValue === afterValue) {
      deltas.push({
        token,
        kind: 'unchanged',
        before: beforeValue ?? null,
        after: afterValue ?? null,
      });
      continue;
    }

    // Both defined and different — the only branch where "before"/"after" are
    // guaranteed non-undefined, so this cast is sound.
    const beforeOklch = parseColor(beforeValue as string);
    const afterOklch = parseColor(afterValue as string);

    deltas.push({
      token,
      kind: 'changed',
      before: beforeValue as string,
      after: afterValue as string,
      deltaL: afterOklch.l - beforeOklch.l,
      deltaC: afterOklch.c - beforeOklch.c,
      deltaH: shortestHueDelta(beforeOklch.h, afterOklch.h),
      deltaEOk: deltaEOk(beforeOklch, afterOklch),
    });
  }

  return deltas.sort((a, b) => a.token.localeCompare(b.token));
}
