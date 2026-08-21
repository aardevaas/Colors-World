/**
 * Version-control primitives for palettes.
 *
 * The unit of history is a `PaletteSnapshot`: a flat map from token name
 * (e.g. "brand-5", matching the exporters' `${scaleName}-${step}` convention)
 * to a CSS color string. Flat and string-keyed rather than a nested scale
 * structure deliberately — it is the same shape the CSS/Tailwind/Figma
 * exporters already emit, so a snapshot round-trips through those formats for
 * free, and diffing/merging never has to reason about nested scale identity.
 */
export type PaletteSnapshot = Readonly<Record<string, string>>;

/**
 * One commit in a palette's history. `parentIds` is an array, not a single
 * value, because that is what makes this a DAG rather than a list — a version
 * with two or more parents is a merge commit.
 */
export interface VersionNode {
  readonly id: string;
  readonly parentIds: readonly string[];
}

export type ChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

/** One token's perceptual delta between two snapshots. */
export interface TokenDelta {
  readonly token: string;
  readonly kind: ChangeKind;
  readonly before: string | null;
  readonly after: string | null;
  /** Present only when `kind === 'changed'`. */
  readonly deltaL?: number;
  readonly deltaC?: number;
  /** Signed shortest-path hue delta in degrees, (-180, 180]. */
  readonly deltaH?: number;
  /** Euclidean distance in OKLab — the single-number "how different" magnitude. */
  readonly deltaEOk?: number;
}

/**
 * A token both branches changed, to different values, relative to their common
 * ancestor. `ours`/`theirs` are `null` when that side deleted the token instead
 * of changing it — a modify/delete conflict, in git's terms.
 */
export interface MergeConflict {
  readonly token: string;
  readonly base: string | null;
  readonly ours: string | null;
  readonly theirs: string | null;
}

export interface MergeResult {
  readonly snapshot: PaletteSnapshot;
  readonly conflicts: readonly MergeConflict[];
}
