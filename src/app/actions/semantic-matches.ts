'use server';

import { getSemanticMatches, type ColorRecord } from '@/lib/supabase/colors';

/**
 * Thin server wrapper around getSemanticMatches for the Library grid's
 * semantic overlay — a generated swatch's own `index` (see generate-color.ts)
 * *is* the bucket-index space getSemanticMatches joins against, so the client
 * needs no translation step, just the raw indices of whatever it currently
 * has on screen.
 *
 * Returns entries rather than a Map: Server Action responses cross a
 * serialization boundary, and while Map/Set support has landed in React's
 * Flight protocol, returning a plain array of tuples sidesteps depending on
 * that entirely — the client reconstructs a Map in one line if it wants one.
 */
export async function fetchSemanticMatchesAction(
  bucketIndices: readonly number[]
): Promise<readonly (readonly [number, ColorRecord])[]> {
  const matches = await getSemanticMatches(bucketIndices);
  return [...matches.entries()];
}
