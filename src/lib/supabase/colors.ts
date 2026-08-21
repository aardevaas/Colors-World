import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Oklch } from '@/lib/color-engine';
import { getSupabaseClient } from './client';

export type Provenance = 'seed' | 'curated' | 'user' | 'measured';

export interface ColorRecord {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
  readonly oklch: Oklch;
  readonly category: string | null;
  readonly description: string | null;
  readonly emotion: string | null;
  readonly personality: string | null;
  readonly mood: string | null;
  readonly symbolism: string | null;
  readonly useCase: string | null;
  readonly keywords: string | null;
  readonly contrastLevel: string | null;
  readonly provenance: Provenance;
  readonly createdAt: string;
}

/** Shape of a row ready for bulk insert — snake_case, matching the ingestion script's output directly. */
export interface NewColorRow {
  readonly name: string;
  readonly hex: string;
  readonly oklch_l: number;
  readonly oklch_c: number;
  readonly oklch_h: number;
  readonly category: string | null;
  readonly description: string | null;
  readonly emotion: string | null;
  readonly personality: string | null;
  readonly mood: string | null;
  readonly symbolism: string | null;
  readonly use_case: string | null;
  readonly keywords: string | null;
  readonly contrast_level: string | null;
  readonly provenance?: Provenance;
}

interface ColorRow {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
  readonly oklch_l: number;
  readonly oklch_c: number;
  readonly oklch_h: number;
  readonly category: string | null;
  readonly description: string | null;
  readonly emotion: string | null;
  readonly personality: string | null;
  readonly mood: string | null;
  readonly symbolism: string | null;
  readonly use_case: string | null;
  readonly keywords: string | null;
  readonly contrast_level: string | null;
  readonly provenance: Provenance;
  readonly created_at: string;
}

function mapColorRow(row: ColorRow): ColorRecord {
  return {
    id: row.id,
    name: row.name,
    hex: row.hex,
    oklch: { l: row.oklch_l, c: row.oklch_c, h: row.oklch_h },
    category: row.category,
    description: row.description,
    emotion: row.emotion,
    personality: row.personality,
    mood: row.mood,
    symbolism: row.symbolism,
    useCase: row.use_case,
    keywords: row.keywords,
    contrastLevel: row.contrast_level,
    provenance: row.provenance,
    createdAt: row.created_at,
  };
}

const DEFAULT_SEARCH_LIMIT = 60;

/**
 * Full-text search across name, category, description, and every tag column
 * — the `search_vector` generated column in `supabase/schema.sql` already
 * concatenates all of them, so this is one index lookup, not N column scans.
 * An empty query returns the most recently added colors rather than nothing,
 * so the library page has something to show before the user types.
 */
export async function searchColors(
  query: string,
  limit: number = DEFAULT_SEARCH_LIMIT,
  client?: SupabaseClient
): Promise<ColorRecord[]> {
  const supabase = client ?? getSupabaseClient();
  const trimmed = query.trim();

  const builder =
    trimmed === ''
      ? supabase.from('colors').select().order('created_at', { ascending: false })
      : supabase
          .from('colors')
          .select()
          .textSearch('search_vector', trimmed, { type: 'websearch', config: 'english' });

  const { data, error } = await builder.limit(limit).returns<ColorRow[]>();

  if (error) throw new Error(`Failed to search colors: ${error.message}`);
  return data.map(mapColorRow);
}

export async function getColor(
  id: string,
  client?: SupabaseClient
): Promise<ColorRecord | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('colors')
    .select()
    .eq('id', id)
    .maybeSingle<ColorRow>();

  if (error) throw new Error(`Failed to get color: ${error.message}`);
  return data ? mapColorRow(data) : null;
}

export async function countColors(client?: SupabaseClient): Promise<number> {
  const supabase = client ?? getSupabaseClient();
  const { count, error } = await supabase
    .from('colors')
    .select('id', { count: 'exact', head: true });

  if (error) throw new Error(`Failed to count colors: ${error.message}`);
  return count ?? 0;
}

interface SemanticMatchRow extends ColorRow {
  readonly bucket_index: number | null;
}

/**
 * The Library's semantic overlay: given the bucket indices of the colors
 * currently on screen (see src/lib/spectrum/bucket-index.ts), finds any
 * curated `colors` rows that landed in those same buckets — one indexed
 * query for a whole visible batch, not one query per card.
 *
 * Most requested buckets will have no match at all — 256^3 buckets vs.
 * ~100K seed rows means an exact hit is the exception, not the rule. That's
 * expected: this enriches a generated swatch when a nearby curated color
 * exists, it never promises one does. When more than one curated row shares
 * a bucket, the first one returned wins — picking a specific "best" tie
 * would need a real ranking signal (verified provenance over seed, maybe),
 * which doesn't exist yet; any deterministic pick is enough for an
 * enrichment, not a guarantee.
 */
export async function getSemanticMatches(
  bucketIndices: readonly number[],
  client?: SupabaseClient
): Promise<Map<number, ColorRecord>> {
  if (bucketIndices.length === 0) return new Map();

  const supabase = client ?? getSupabaseClient();
  const unique = [...new Set(bucketIndices)];
  const { data, error } = await supabase
    .from('colors')
    .select()
    .in('bucket_index', unique)
    .returns<SemanticMatchRow[]>();

  if (error) throw new Error(`Failed to fetch semantic matches: ${error.message}`);

  const matches = new Map<number, ColorRecord>();
  for (const row of data) {
    if (row.bucket_index === null || matches.has(row.bucket_index)) continue;
    matches.set(row.bucket_index, mapColorRow(row));
  }
  return matches;
}

/**
 * Inserts a batch of rows in one request. Ingestion is the only caller —
 * everything else in the app treats the library as read-only, which is why
 * this is the one function here that takes pre-shaped snake_case rows
 * instead of a domain object.
 */
export async function insertColorsBatch(
  rows: readonly NewColorRow[],
  client?: SupabaseClient
): Promise<number> {
  if (rows.length === 0) return 0;

  const supabase = client ?? getSupabaseClient();
  const { error, count } = await supabase
    .from('colors')
    .insert(rows as unknown as Record<string, unknown>[], { count: 'exact' });

  if (error) throw new Error(`Failed to insert color batch: ${error.message}`);
  return count ?? rows.length;
}
