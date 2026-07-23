import type { VersionNode } from './types';

/**
 * Finds the merge base of two versions: the common ancestor closest to both.
 *
 * Implementation is two breadth-first searches over `parentIds` (each version
 * points backward in time toward its parents), recording distance-from-start
 * for every reachable ancestor, then picking the intersection point with the
 * smallest combined distance.
 *
 * Known limitation: with criss-cross history (two branches that each merged
 * the other), git computes a *virtual* merge base by merging the multiple
 * best candidates; this returns a single nearest one instead. That case does
 * not arise from this app's UI, which only ever creates one merge commit per
 * pair of branches, so the simpler algorithm is the correct amount of
 * complexity for what can actually happen — worth revisiting only if the UI
 * grows a way to construct criss-cross history.
 *
 * Returns `null` if the two versions share no ancestor (disjoint histories).
 */
export function findLowestCommonAncestor(
  versions: ReadonlyMap<string, VersionNode>,
  a: string,
  b: string
): string | null {
  const distancesA = distancesFromVersion(versions, a);
  const distancesB = distancesFromVersion(versions, b);

  let best: string | null = null;
  let bestTotalDistance = Number.POSITIVE_INFINITY;

  for (const [id, distanceA] of distancesA) {
    const distanceB = distancesB.get(id);
    if (distanceB === undefined) continue;
    const total = distanceA + distanceB;
    if (total < bestTotalDistance) {
      bestTotalDistance = total;
      best = id;
    }
  }

  return best;
}

/** BFS distance from `start` to every ancestor reachable via `parentIds`. */
function distancesFromVersion(
  versions: ReadonlyMap<string, VersionNode>,
  start: string
): Map<string, number> {
  const distances = new Map<string, number>();
  const queue: string[] = [start];
  distances.set(start, 0);

  let cursor = 0;
  while (cursor < queue.length) {
    const id = queue[cursor]!;
    cursor += 1;
    const distance = distances.get(id)!;

    const node = versions.get(id);
    if (node === undefined) continue;

    for (const parentId of node.parentIds) {
      if (distances.has(parentId)) continue;
      distances.set(parentId, distance + 1);
      queue.push(parentId);
    }
  }

  return distances;
}

/** True if `ancestor` can be reached by walking parents from `descendant`. */
export function isAncestor(
  versions: ReadonlyMap<string, VersionNode>,
  ancestor: string,
  descendant: string
): boolean {
  return distancesFromVersion(versions, descendant).has(ancestor);
}
