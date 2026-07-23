import type { MergeConflict } from './types';

export function formatConflictReport(conflicts: readonly MergeConflict[]): string {
  if (conflicts.length === 0) {
    return 'No conflicts.';
  }

  const blocks: string[] = [];
  for (const conflict of conflicts) {
    const base = conflict.base ?? '<deleted>';
    const ours = conflict.ours ?? '<deleted>';
    const theirs = conflict.theirs ?? '<deleted>';

    blocks.push(`✕ ${conflict.token}\n  base    ${base}\n  ours    ${ours}\n  theirs  ${theirs}`);
  }

  return `${blocks.join('\n\n')}\n\n${conflicts.length} conflict(s) require resolution.`;
}
