/**
 * Ingests boltuix/color-pedia (HF, MIT licensed, ~100K rows) into the
 * `colors` table.
 *
 * Reads the dataset's parquet file directly rather than paginating through
 * HF's datasets-server rows API. That API was the first approach here and it
 * failed twice in production: a transient 502 at row 2100, then a 429 that
 * never cleared even after five escalating backoff rounds up to 20s each —
 * evidence of a rate-limit window tighter than a ~1000-request run can
 * practically retry around. A single file download has no such problem: one
 * request instead of a thousand, confirmed against a *separate*, far more
 * generous rate-limit bucket (3000 req/5min on the resolver endpoint,
 * checked live before committing to this rewrite).
 *
 * OKLCH is computed from the dataset's HEX column via this project's own
 * colour engine rather than trusted from the dataset's own Hue/Saturation/
 * Lightness columns — those are almost certainly HSL, and canonical storage
 * everywhere else in this app is OKLCH.
 *
 * Deliberately uses raw @supabase/supabase-js rather than importing
 * src/lib/supabase/colors.ts — that module is guarded by `server-only`,
 * which throws unconditionally outside Next's bundler. Only NewColorRow's
 * *type* is imported — erased at compile time, no runtime dependency on the
 * guarded module.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/ingest-colorpedia.ts --limit=200   (verify)
 *   npx tsx --env-file=.env.local scripts/ingest-colorpedia.ts              (full ~100K)
 *   npx tsx --env-file=.env.local scripts/ingest-colorpedia.ts --offset=13000  (resume)
 *
 * --offset is an exact row index to resume from — pass the row count already
 * in the `colors` table (verify with a COUNT query first).
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { asyncBufferFromFile, parquetReadObjects } from 'hyparquet';
import { parseColor } from '../src/lib/color-engine';
import type { NewColorRow } from '../src/lib/supabase/colors';

const PARQUET_URL =
  'https://huggingface.co/datasets/boltuix/color-pedia/resolve/refs%2Fconvert%2Fparquet/default/train/0000.parquet';
const LOCAL_CACHE_PATH = join(tmpdir(), 'prism-colorpedia', 'color-pedia-0000.parquet');

const INSERT_BATCH_SIZE = 500;
const MAX_INSERT_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 500;

function argValue(flag: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg?.split('=')[1];
}

const limitArg = argValue('limit');
const rowLimit = limitArg ? Number(limitArg) : undefined;
const startOffset = Number(argValue('offset') ?? '0');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✕ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Downloads the parquet file once and caches it locally — reruns during
 * development (verify with --limit, then the full run) reuse the same file
 * instead of re-downloading 14.8MB every time. */
async function ensureParquetFile(): Promise<string> {
  const alreadyCached = await stat(LOCAL_CACHE_PATH).then(
    () => true,
    () => false
  );
  if (alreadyCached) {
    console.log(`Using cached parquet file at ${LOCAL_CACHE_PATH}`);
    return LOCAL_CACHE_PATH;
  }

  console.log(`Downloading ${PARQUET_URL} …`);
  const response = await fetch(PARQUET_URL);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await mkdir(join(tmpdir(), 'prism-colorpedia'), { recursive: true });
  await writeFile(LOCAL_CACHE_PATH, bytes);
  console.log(`Downloaded ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
  return LOCAL_CACHE_PATH;
}

interface HfRow {
  readonly 'Color Name': string;
  readonly 'HEX Code': string;
  readonly Category: string | null;
  readonly Description: string | null;
  readonly Emotion: string | null;
  readonly Personality: string | null;
  readonly Mood: string | null;
  readonly Symbolism: string | null;
  readonly 'Use Case': string | null;
  readonly Keywords: string | null;
  readonly 'Contrast Level': string | null;
}

function toColorRow(raw: HfRow): NewColorRow | null {
  try {
    const oklch = parseColor(raw['HEX Code']);
    return {
      name: raw['Color Name'],
      hex: raw['HEX Code'].toLowerCase(),
      oklch_l: oklch.l,
      oklch_c: oklch.c,
      oklch_h: oklch.h,
      category: raw.Category,
      description: raw.Description,
      emotion: raw.Emotion,
      personality: raw.Personality,
      mood: raw.Mood,
      symbolism: raw.Symbolism,
      use_case: raw['Use Case'],
      keywords: raw.Keywords,
      contrast_level: raw['Contrast Level'],
      provenance: 'seed',
    };
  } catch {
    // Untrusted bulk data — an unparseable hex skips that one row rather
    // than aborting the whole ingestion run.
    return null;
  }
}

async function insertBatch(rows: NewColorRow[]): Promise<void> {
  if (rows.length === 0) return;

  let lastMessage = '';
  for (let attempt = 1; attempt <= MAX_INSERT_ATTEMPTS; attempt += 1) {
    const { error } = await supabase.from('colors').insert(rows);
    if (!error) return;
    lastMessage = error.message;
    if (attempt < MAX_INSERT_ATTEMPTS) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  throw new Error(`Insert failed after ${MAX_INSERT_ATTEMPTS} attempts: ${lastMessage}`);
}

async function main() {
  const path = await ensureParquetFile();
  const file = await asyncBufferFromFile(path);

  console.log('Parsing parquet file…');
  const allRows = (await parquetReadObjects({ file })) as unknown as HfRow[];
  console.log(`Parsed ${allRows.length} rows`);

  const end = rowLimit ? Math.min(startOffset + rowLimit, allRows.length) : allRows.length;
  const slice = allRows.slice(startOffset, end);

  if (slice.length === 0) {
    console.log(`Offset ${startOffset} is past the row count (${allRows.length}) — nothing to do.`);
    return;
  }

  console.log(
    `Ingesting rows ${startOffset}–${end} of ${allRows.length}` +
      (startOffset > 0 ? ' (resuming)' : '')
  );

  let buffer: NewColorRow[] = [];
  let ingested = startOffset;
  let skipped = 0;

  for (const raw of slice) {
    const colorRow = toColorRow(raw);
    if (colorRow === null) {
      skipped += 1;
      continue;
    }
    buffer.push(colorRow);

    if (buffer.length >= INSERT_BATCH_SIZE) {
      await insertBatch(buffer);
      ingested += buffer.length;
      buffer = [];
      console.log(`  ${ingested}/${end} ingested`);
    }
  }

  await insertBatch(buffer);
  ingested += buffer.length;

  console.log(`\nDone. ${ingested} total ingested this run, ${skipped} skipped (unparseable hex).`);
}

main().catch((error) => {
  console.error('✕', error instanceof Error ? error.message : error);
  process.exit(1);
});
