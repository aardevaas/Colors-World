/**
 * The System — the single document this product edits.
 *
 * Everything a person builds here is one object: the colours they collected,
 * which colour plays which role, how type is set, and whether the whole thing
 * reads light or dark. Before this existed the app kept a colour tray in one
 * place, role overrides in a component's `useState`, and type settings in
 * another component's `useState`, which is why five capable tabs behaved like
 * five unrelated products — nothing they each knew about survived a navigation
 * or could be sent to anyone.
 *
 * Pure data. No React, no DOM, no URL knowledge. The codec (codec.ts) turns
 * this into a query string and back; the reducer (system-reducer.ts) is the
 * only thing that changes it.
 */

import type { Oklch } from '@/lib/color-engine';
import type { SemanticRole } from '@/lib/roles/semantic-roles';

/** A colour held in the System's palette. */
export interface SystemColor {
  readonly hex: string;
  readonly oklch: Oklch;
  /** Collection order is meaningful to people even though the role model
   *  deliberately ignores it — it is how the palette strip is laid out. */
  readonly addedAt: number;
}

/** Light or dark polarity for the whole System. */
export type SystemMode = 'dark' | 'light';

/**
 * How type is set. Deliberately excludes the locally-scanned font family:
 * a face installed on one machine is not installed on another, so putting it
 * in a shared System would hand someone a link that silently renders in a
 * different typeface than the one it promises.
 */
export interface TypeSettings {
  readonly presetId: string;
  readonly ratio: number;
  readonly baseRem: number;
  readonly lineHeight: number;
  readonly tracking: number;
  readonly weight: number;
}

export interface System {
  readonly palette: readonly SystemColor[];
  /** The colour scales are built from. Null when the palette is empty. */
  readonly anchorHex: string | null;
  /** Manual role assignments, by hex. Absent roles are derived. */
  readonly roleOverrides: Readonly<Partial<Record<SemanticRole, string>>>;
  readonly type: TypeSettings;
  readonly mode: SystemMode;
}
