// Live integration smoke test — proves Postgres actually returns parent_ids
// as a real array and snapshot as a parsed object, not strings, which the
// versioning module's DAG/diff/merge logic depends on. Cleans up after itself.
//
// Run with: node --env-file=.env.local scripts/smoke-test-repository.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let failed = false;
function check(label, condition) {
  console.log(`${condition ? '✓' : '✕'} ${label}`);
  if (!condition) failed = true;
}

const { data: palette, error: paletteError } = await supabase
  .from('palettes')
  .insert({ name: '__smoke_test__' })
  .select()
  .single();
if (paletteError) {
  console.error('✕ created palette —', JSON.stringify(paletteError, null, 2));
  process.exit(1);
}
check('created palette', palette !== null);

const { data: versionA, error: versionAError } = await supabase
  .from('palette_versions')
  .insert({ palette_id: palette.id, parent_ids: [], snapshot: { 'x-0': '#112233' } })
  .select()
  .single();
check('created root version', !versionAError && versionA !== null);
check('parent_ids round-trips as a real array', Array.isArray(versionA.parent_ids));
check('snapshot round-trips as a parsed object, not a string', typeof versionA.snapshot === 'object');
check('snapshot content is correct', versionA.snapshot['x-0'] === '#112233');

const { data: versionB } = await supabase
  .from('palette_versions')
  .insert({ palette_id: palette.id, parent_ids: [versionA.id], snapshot: { 'x-0': '#334455' } })
  .select()
  .single();

const { data: merge, error: mergeError } = await supabase
  .from('palette_versions')
  .insert({
    palette_id: palette.id,
    parent_ids: [versionA.id, versionB.id],
    snapshot: { 'x-0': '#556677' },
    message: 'smoke test merge commit',
  })
  .select()
  .single();
check('created a two-parent merge commit', !mergeError && merge !== null);
check('merge commit has both parents', merge.parent_ids.length === 2);

const { data: branch, error: branchError } = await supabase
  .from('palette_branches')
  .insert({ palette_id: palette.id, name: 'main', head_version_id: merge.id })
  .select()
  .single();
check('created branch pointing at the merge', !branchError && branch?.head_version_id === merge.id);

// Cleanup — cascade delete on palettes takes versions and branches with it.
const { error: cleanupError } = await supabase.from('palettes').delete().eq('id', palette.id);
check('cleaned up test rows (cascade delete)', !cleanupError);

if (failed) {
  console.error('\nSmoke test FAILED — see ✕ above.');
  process.exit(1);
}
console.log('\nAll assumptions confirmed against the live database.');
