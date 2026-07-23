// One-off migration: pin the palettes that existed before the Studio Wall did.
// Run with: node --env-file=.env.local scripts/backfill-board-items.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const BOARD_COLUMNS = 4;
const BOARD_COLUMN_SPACING = 260;
const BOARD_ROW_SPACING = 220;
const BOARD_MARGIN = 40;

function nextBoardPosition(existingItemCount) {
  const column = existingItemCount % BOARD_COLUMNS;
  const row = Math.floor(existingItemCount / BOARD_COLUMNS);
  return {
    x: BOARD_MARGIN + column * BOARD_COLUMN_SPACING,
    y: BOARD_MARGIN + row * BOARD_ROW_SPACING,
    rotation: ((existingItemCount * 37) % 7) - 3,
  };
}

const { data: palettes, error: palettesError } = await supabase
  .from('palettes')
  .select('id, name, project_id')
  .order('created_at', { ascending: true });
if (palettesError) throw palettesError;

for (const palette of palettes) {
  const { count, error: countError } = await supabase
    .from('board_items')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', palette.project_id);
  if (countError) throw countError;

  const { data: existingPin } = await supabase
    .from('board_items')
    .select('id')
    .eq('ref_id', palette.id)
    .eq('item_type', 'palette')
    .maybeSingle();
  if (existingPin) {
    console.log(`- ${palette.name}: already pinned, skipping`);
    continue;
  }

  const position = nextBoardPosition(count ?? 0);
  const { error: insertError } = await supabase.from('board_items').insert({
    project_id: palette.project_id,
    item_type: 'palette',
    ref_id: palette.id,
    x: position.x,
    y: position.y,
    rotation: position.rotation,
    z_index: count ?? 0,
  });
  if (insertError) throw insertError;
  console.log(`+ ${palette.name}: pinned at (${position.x}, ${position.y})`);
}

console.log('\nDone.');
