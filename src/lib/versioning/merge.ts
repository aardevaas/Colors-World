import type { MergeConflict, MergeResult, PaletteSnapshot } from './types';

/**
 * Three-way merge of two snapshots against their common ancestor, one token
 * at a time. Standard VCS semantics, applied to color tokens instead of
 * lines of text:
 *
 * - Neither side changed a token → keep the base value.
 * - Only one side changed it → take that side's value (this is what makes an
 *   ordinary, non-conflicting branch merge "just work").
 * - Both sides changed it to the *same* value → take that value, no conflict.
 * - Both sides changed it to *different* values → conflict. This includes the
 *   case where one side deleted the token and the other modified it — a
 *   modify/delete conflict, which is still a real conflict and must not be
 *   silently resolved by picking either side.
 *
 * The merged snapshot fills conflicted tokens with the base value (or omits
 * them if the token didn't exist at the base) as a safe placeholder pending
 * resolution — never with an arbitrary pick of "ours" or "theirs", which
 * would silently discard one side's intent.
 */
export function threeWayMerge(
  base: PaletteSnapshot,
  ours: PaletteSnapshot,
  theirs: PaletteSnapshot
): MergeResult {
  const tokens = new Set([
    ...Object.keys(base),
    ...Object.keys(ours),
    ...Object.keys(theirs),
  ]);

  const snapshot: Record<string, string> = {};
  const conflicts: MergeConflict[] = [];

  for (const token of tokens) {
    const baseValue = base[token];
    const oursValue = ours[token];
    const theirsValue = theirs[token];

    const oursChanged = oursValue !== baseValue;
    const theirsChanged = theirsValue !== baseValue;

    if (!oursChanged && !theirsChanged) {
      if (baseValue !== undefined) snapshot[token] = baseValue;
      continue;
    }

    if (oursChanged && !theirsChanged) {
      if (oursValue !== undefined) snapshot[token] = oursValue;
      continue;
    }

    if (!oursChanged && theirsChanged) {
      if (theirsValue !== undefined) snapshot[token] = theirsValue;
      continue;
    }

    // Both changed. Identical resolution is not a conflict.
    if (oursValue === theirsValue) {
      if (oursValue !== undefined) snapshot[token] = oursValue;
      continue;
    }

    conflicts.push({
      token,
      base: baseValue ?? null,
      ours: oursValue ?? null,
      theirs: theirsValue ?? null,
    });
    if (baseValue !== undefined) snapshot[token] = baseValue;
  }

  return { snapshot, conflicts: conflicts.sort((a, b) => a.token.localeCompare(b.token)) };
}

/** True when a merge produced no conflicts and can be committed automatically. */
export function isCleanMerge(result: MergeResult): boolean {
  return result.conflicts.length === 0;
}
