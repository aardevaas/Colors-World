/**
 * Seeds one real palette into Supabase, replacing Merge Lab's scripted
 * in-memory demo with actual persisted history: a base version, two branches
 * that diverge from it, one genuine conflict (brand-5), one clean divergent
 * change (accent-5) — the exact scenario already proven in
 * src/lib/versioning's integration tests and src/lib/supabase's
 * merge-workflow tests, now written for real.
 *
 * Safe to re-run: deletes any prior "Demo Palette" first (cascade deletes its
 * versions and branches), then recreates it from scratch.
 *
 * Run with: npx tsx --env-file=.env.local scripts/seed-demo-palette.ts
 */
import { createClient } from '@supabase/supabase-js';
import { generateScale } from '../src/lib/color-engine';
import { snapshotFromScales } from '../src/lib/versioning';

const PALETTE_NAME = 'Demo Palette';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✕ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { error: deleteError } = await supabase
    .from('palettes')
    .delete()
    .eq('name', PALETTE_NAME);
  if (deleteError) throw new Error(`Failed clearing prior seed: ${deleteError.message}`);
  console.log('✓ cleared any previous "Demo Palette"');

  const baseSnapshot = snapshotFromScales([
    generateScale({ name: 'brand', anchors: [{ step: 5, color: '#3b82f6' }] }),
    generateScale({ name: 'accent', anchors: [{ step: 5, color: '#ef4444' }] }),
  ]);

  const { data: palette, error: paletteError } = await supabase
    .from('palettes')
    .insert({ name: PALETTE_NAME })
    .select()
    .single();
  if (paletteError) throw new Error(`Failed to create palette: ${paletteError.message}`);
  console.log(`✓ created palette ${palette.id}`);

  const { data: base, error: baseError } = await supabase
    .from('palette_versions')
    .insert({
      palette_id: palette.id,
      parent_ids: [],
      snapshot: baseSnapshot,
      message: 'Initial palette',
    })
    .select()
    .single();
  if (baseError) throw new Error(`Failed to create base version: ${baseError.message}`);
  console.log(`✓ created base version ${base.id}`);

  const oursSnapshot = { ...baseSnapshot, 'brand-5': '#2563eb' };
  const theirsSnapshot = { ...baseSnapshot, 'brand-5': '#1d4ed8', 'accent-5': '#f97316' };

  const { data: oursHead, error: oursError } = await supabase
    .from('palette_versions')
    .insert({
      palette_id: palette.id,
      parent_ids: [base.id],
      snapshot: oursSnapshot,
      message: 'Nudge brand warmer',
    })
    .select()
    .single();
  if (oursError) throw new Error(`Failed to create ours version: ${oursError.message}`);

  const { data: theirsHead, error: theirsError } = await supabase
    .from('palette_versions')
    .insert({
      palette_id: palette.id,
      parent_ids: [base.id],
      snapshot: theirsSnapshot,
      message: 'Retune brand + accent',
    })
    .select()
    .single();
  if (theirsError) throw new Error(`Failed to create theirs version: ${theirsError.message}`);
  console.log(`✓ created diverging versions ${oursHead.id} (ours) and ${theirsHead.id} (theirs)`);

  const { error: oursBranchError } = await supabase
    .from('palette_branches')
    .insert({ palette_id: palette.id, name: 'ours', head_version_id: oursHead.id });
  if (oursBranchError) throw new Error(`Failed to create "ours" branch: ${oursBranchError.message}`);

  const { error: theirsBranchError } = await supabase
    .from('palette_branches')
    .insert({ palette_id: palette.id, name: 'theirs', head_version_id: theirsHead.id });
  if (theirsBranchError)
    throw new Error(`Failed to create "theirs" branch: ${theirsBranchError.message}`);
  console.log('✓ created "ours" and "theirs" branches');

  console.log(`\nSeeded. Palette id: ${palette.id}`);
}

main().catch((error) => {
  console.error('✕', error.message);
  process.exit(1);
});
