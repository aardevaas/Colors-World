// One-off connectivity check. Run with:
//   node --env-file=.env.local scripts/verify-supabase.mjs
//
// Confirms the service-role credentials work and that schema.sql was applied,
// without ever printing the key itself.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('✕ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const tables = ['palettes', 'palette_versions', 'palette_branches'];
let allOk = true;

for (const table of tables) {
  const { error, count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error(`✕ ${table}: ${error.message}`);
    allOk = false;
  } else {
    console.log(`✓ ${table}: reachable, ${count ?? 0} row(s)`);
  }
}

if (!allOk) {
  console.error('\nSchema check failed — re-run supabase/schema.sql in the SQL Editor.');
  process.exit(1);
}

console.log('\nAll three tables reachable. Connection verified.');
