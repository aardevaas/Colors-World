import type { GeneratedScale } from '@/lib/color-engine';
import { sanitiseScaleName } from '@/lib/exporters/tokens';
import type { PaletteSnapshot } from './types';

/**
 * Flattens a set of generated scales into a `PaletteSnapshot` — one token per
 * step, named the same way the CSS/Tailwind exporters name their custom
 * properties (`${scaleName}-${step}`), so a snapshot, an export, and a diff
 * all agree on what a "token" is called.
 *
 * Uses each step's hex, not its `oklch()` css string, so two snapshots can be
 * compared with plain string equality in the merge algorithm rather than
 * needing to parse and re-normalise colour strings just to test for sameness.
 */
export function snapshotFromScales(
  scales: readonly GeneratedScale[]
): PaletteSnapshot {
  const snapshot: Record<string, string> = {};

  for (const scale of scales) {
    const name = sanitiseScaleName(scale.name);
    for (const step of scale.steps) {
      snapshot[`${name}-${step.step}`] = step.hex;
    }
  }

  return snapshot;
}
