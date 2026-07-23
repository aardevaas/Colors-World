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
 * An empty query returns the most recently added colours rather than nothing,
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

export interface SpectrumRow {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
  readonly oklch: Oklch;
  readonly spectrumIndex: number;
}

interface SpectrumRowRaw {
  readonly id: string;
  readonly name: string;
  readonly hex: string;
  readonly oklch_l: number;
  readonly oklch_c: number;
  readonly oklch_h: number;
  readonly spectrum_index: number;
}

function mapSpectrumRow(row: SpectrumRowRaw): SpectrumRow {
  return {
    id: row.id,
    name: row.name,
    hex: row.hex,
    oklch: { l: row.oklch_l, c: row.oklch_c, h: row.oklch_h },
    spectrumIndex: row.spectrum_index,
  };
}

/**
 * A contiguous slice of the full 100K-colour spectrum by absolute position —
 * `spectrum_index` is a global ordering, so `[startIndex, startIndex+count)`
 * only lines up with what should be on screen when nothing is excluded. This
 * is what lets a scrollbar jump anywhere instantly: no filter, no cursor, just
 * "give me rows 40,000 through 40,049."
 */
export async function getSpectrumWindow(
  startIndex: number,
  count: number,
  client?: SupabaseClient
): Promise<SpectrumRow[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('colors')
    .select('id, name, hex, oklch_l, oklch_c, oklch_h, spectrum_index')
    .gte('spectrum_index', startIndex)
    .lt('spectrum_index', startIndex + count)
    .order('spectrum_index', { ascending: true })
    .returns<SpectrumRowRaw[]>();

  if (error) throw new Error(`Failed to fetch spectrum window: ${error.message}`);
  return data.map(mapSpectrumRow);
}

export interface SpectrumFilters {
  /** OKLCH lightness, 0–1. */
  readonly minLightness?: number;
  readonly maxLightness?: number;
  readonly minChroma?: number;
  readonly maxChroma?: number;
  /** OKLCH hue, 0–360. Callers handle any wraparound by issuing two ranges. */
  readonly minHue?: number;
  readonly maxHue?: number;
}

/**
 * Forward-only keyset page through the spectrum with filters applied.
 *
 * Excluding rows breaks the "absolute position" guarantee `getSpectrumWindow`
 * relies on — a filtered view has gaps, so "position 40,000" has no fixed
 * meaning once some rows are gone. Keyset pagination (`spectrum_index >
 * afterIndex`) stays correct and index-backed regardless of how much gets
 * filtered out; the trade is that a filtered scrollbar can only track how much
 * has loaded, not jump to an arbitrary global position. Pass `afterIndex:
 * undefined` for the first page.
 */
export async function getSpectrumPage(
  afterIndex: number | undefined,
  count: number,
  filters: SpectrumFilters,
  client?: SupabaseClient
): Promise<SpectrumRow[]> {
  const supabase = client ?? getSupabaseClient();
  let builder = supabase
    .from('colors')
    .select('id, name, hex, oklch_l, oklch_c, oklch_h, spectrum_index');

  if (afterIndex !== undefined) builder = builder.gt('spectrum_index', afterIndex);
  if (filters.minLightness !== undefined) builder = builder.gte('oklch_l', filters.minLightness);
  if (filters.maxLightness !== undefined) builder = builder.lte('oklch_l', filters.maxLightness);
  if (filters.minChroma !== undefined) builder = builder.gte('oklch_c', filters.minChroma);
  if (filters.maxChroma !== undefined) builder = builder.lte('oklch_c', filters.maxChroma);
  if (filters.minHue !== undefined) builder = builder.gte('oklch_h', filters.minHue);
  if (filters.maxHue !== undefined) builder = builder.lte('oklch_h', filters.maxHue);

  const { data, error } = await builder
    .order('spectrum_index', { ascending: true })
    .limit(count)
    .returns<SpectrumRowRaw[]>();

  if (error) throw new Error(`Failed to fetch spectrum page: ${error.message}`);
  return data.map(mapSpectrumRow);
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
