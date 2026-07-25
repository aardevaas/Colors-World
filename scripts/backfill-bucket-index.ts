/**
 * One-off migration: computes `bucket_index` (see supabase/schema.sql, "The
 * Library" section) for every existing `colors` row and writes it back.
 *
 * A plain per-row UPDATE, not a bulk upsert — this table has several other
 * NOT NULL columns with no default (name, hex, oklch_l/c/h), and Postgres
 * still validates an upsert's INSERT-path column list against those even
 * when the row already exists and the statement actually takes the
 * ON CONFLICT DO UPDATE branch. A partial-column upsert would fail outright;
 * a plain UPDATE only ever touches the one column this script owns.
 *
 * Reuses this project's own oklchToBucketIndex (src/lib/spectrum/bucket-index.ts)
 * rather than reimplementing the bucket math here — that function's inverse
 * of indexToOklch is exactly what has to stay in sync with the forward
 * formula, and it already is, in one place, with tests.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/backfill-bucket-index.ts            (full run)
 *   npx tsx --env-file=.env.local scripts/backfill-bucket-index.ts --limit=200  (verify first)
 */
import { createClient } from '@supabase/supabase-js';
import { oklchToBucketIndex } from '../src/lib/spectrum/bucket-index';

const PAGE_SIZE = 1000;
/** Concurrent in-flight UPDATE requests — fast enough for ~100K rows to
 *  finish in minutes rather than hours, conservative enough not to trip
 *  Supabase's connection-pool limits on the free tier. */
const UPDATE_CONCURRENCY = 25;

function argValue(flag: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${flag}=`));
  return arg?.split('=')[1];
}

const limitArg = argValue('limit');
const rowLimit = limitArg ? Number(limitArg) : undefined;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✕ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

interface ColorIdAndOklch {
  readonly id: string;
  readonly oklch_l: number;
  readonly oklch_c: number;
  readonly oklch_h: number;
}

/** Runs `updates` with at most `UPDATE_CONCURRENCY` in flight at once,
 *  rather than either fully sequential (slow) or fully parallel (risks
 *  exhausting the connection pool on a large page). */
async function runWithConcurrencyLimit(
  updates: readonly (() => Promise<void>)[]
): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < updates.length) {
      const index = cursor;
      cursor += 1;
      await updates[index]!();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(UPDATE_CONCURRENCY, updates.length) }, worker)
  );
}

async function main(): Promise<void> {
  let processed = 0;
  let page = 0;

  for (;;) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('colors')
      .select('id, oklch_l, oklch_c, oklch_h')
      .order('id', { ascending: true })
      .range(from, to)
      .returns<ColorIdAndOklch[]>();

    if (error) throw new Error(`Failed to read page ${page}: ${error.message}`);
    if (data.length === 0) break;

    const rows = rowLimit ? data.slice(0, Math.max(0, rowLimit - processed)) : data;

    const updates = rows.map((row) => async () => {
      const bucketIndex = oklchToBucketIndex({
        l: row.oklch_l,
        c: row.oklch_c,
        h: row.oklch_h,
      });
      const { error: updateError } = await supabase
        .from('colors')
        .update({ bucket_index: bucketIndex })
        .eq('id', row.id);
      if (updateError) {
        throw new Error(`Failed to update ${row.id}: ${updateError.message}`);
      }
    });

    await runWithConcurrencyLimit(updates);
    processed += rows.length;
    console.log(`+ page ${page}: backfilled ${rows.length} rows (${processed} total)`);

    if (rowLimit && processed >= rowLimit) break;
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }

  console.log(`✓ Done. Backfilled bucket_index on ${processed} rows.`);
}

main().catch((error: unknown) => {
  console.error('✕', error instanceof Error ? error.message : error);
  process.exit(1);
});
