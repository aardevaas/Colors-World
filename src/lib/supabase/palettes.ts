import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaletteSnapshot } from '@/lib/versioning';
import { getSupabaseClient } from './client';

export interface PaletteRecord {
  readonly id: string;
  readonly name: string;
  readonly projectId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaletteVersionRecord {
  readonly id: string;
  readonly paletteId: string;
  readonly parentIds: readonly string[];
  readonly message: string | null;
  readonly snapshot: PaletteSnapshot;
  readonly createdAt: string;
}

export interface PaletteBranchRecord {
  readonly id: string;
  readonly paletteId: string;
  readonly name: string;
  readonly headVersionId: string;
  readonly createdAt: string;
}

// Raw snake_case shapes as Postgrest returns them — kept private so the rest
// of the app only ever sees the camelCase domain records above.
interface PaletteRow {
  readonly id: string;
  readonly name: string;
  readonly project_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface PaletteVersionRow {
  readonly id: string;
  readonly palette_id: string;
  readonly parent_ids: readonly string[];
  readonly message: string | null;
  readonly snapshot: PaletteSnapshot;
  readonly created_at: string;
}

interface PaletteBranchRow {
  readonly id: string;
  readonly palette_id: string;
  readonly name: string;
  readonly head_version_id: string;
  readonly created_at: string;
}

function mapPaletteRow(row: PaletteRow): PaletteRecord {
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVersionRow(row: PaletteVersionRow): PaletteVersionRecord {
  return {
    id: row.id,
    paletteId: row.palette_id,
    parentIds: row.parent_ids,
    message: row.message,
    snapshot: row.snapshot,
    createdAt: row.created_at,
  };
}

function mapBranchRow(row: PaletteBranchRow): PaletteBranchRecord {
  return {
    id: row.id,
    paletteId: row.palette_id,
    name: row.name,
    headVersionId: row.head_version_id,
    createdAt: row.created_at,
  };
}

/**
 * Every function below takes `client` as an optional last parameter, defaulted
 * lazily (evaluated per call, not at module load) to `getSupabaseClient()`.
 * That laziness matters: importing this module must not throw just because
 * credentials aren't configured yet, and tests inject a fake client here
 * instead of touching a real database.
 */

export async function createPalette(
  name: string,
  client?: SupabaseClient,
  projectId?: string
): Promise<PaletteRecord> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palettes')
    .insert(projectId === undefined ? { name } : { name, project_id: projectId })
    .select()
    .single<PaletteRow>();

  if (error) throw new Error(`Failed to create palette: ${error.message}`);
  return mapPaletteRow(data);
}

export async function getPalette(
  id: string,
  client?: SupabaseClient
): Promise<PaletteRecord | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palettes')
    .select()
    .eq('id', id)
    .maybeSingle<PaletteRow>();

  if (error) throw new Error(`Failed to get palette: ${error.message}`);
  return data ? mapPaletteRow(data) : null;
}

export async function getPaletteByName(
  name: string,
  client?: SupabaseClient
): Promise<PaletteRecord | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palettes')
    .select()
    .eq('name', name)
    .maybeSingle<PaletteRow>();

  if (error) throw new Error(`Failed to get palette by name: ${error.message}`);
  return data ? mapPaletteRow(data) : null;
}

export async function listPalettes(client?: SupabaseClient): Promise<PaletteRecord[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palettes')
    .select()
    .order('created_at', { ascending: false })
    .returns<PaletteRow[]>();

  if (error) throw new Error(`Failed to list palettes: ${error.message}`);
  return data.map(mapPaletteRow);
}

export async function createVersion(
  input: {
    paletteId: string;
    parentIds: readonly string[];
    snapshot: PaletteSnapshot;
    message?: string;
  },
  client?: SupabaseClient
): Promise<PaletteVersionRecord> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palette_versions')
    .insert({
      palette_id: input.paletteId,
      parent_ids: input.parentIds,
      snapshot: input.snapshot,
      message: input.message ?? null,
    })
    .select()
    .single<PaletteVersionRow>();

  if (error) throw new Error(`Failed to create version: ${error.message}`);
  return mapVersionRow(data);
}

export async function getVersion(
  id: string,
  client?: SupabaseClient
): Promise<PaletteVersionRecord | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palette_versions')
    .select()
    .eq('id', id)
    .maybeSingle<PaletteVersionRow>();

  if (error) throw new Error(`Failed to get version: ${error.message}`);
  return data ? mapVersionRow(data) : null;
}

export async function listVersions(
  paletteId: string,
  client?: SupabaseClient
): Promise<PaletteVersionRecord[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palette_versions')
    .select()
    .eq('palette_id', paletteId)
    .order('created_at', { ascending: true })
    .returns<PaletteVersionRow[]>();

  if (error) throw new Error(`Failed to list versions: ${error.message}`);
  return data.map(mapVersionRow);
}

export async function createBranch(
  input: { paletteId: string; name: string; headVersionId: string },
  client?: SupabaseClient
): Promise<PaletteBranchRecord> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palette_branches')
    .insert({
      palette_id: input.paletteId,
      name: input.name,
      head_version_id: input.headVersionId,
    })
    .select()
    .single<PaletteBranchRow>();

  if (error) throw new Error(`Failed to create branch: ${error.message}`);
  return mapBranchRow(data);
}

export async function getBranch(
  paletteId: string,
  name: string,
  client?: SupabaseClient
): Promise<PaletteBranchRecord | null> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palette_branches')
    .select()
    .eq('palette_id', paletteId)
    .eq('name', name)
    .maybeSingle<PaletteBranchRow>();

  if (error) throw new Error(`Failed to get branch: ${error.message}`);
  return data ? mapBranchRow(data) : null;
}

export async function listBranches(
  paletteId: string,
  client?: SupabaseClient
): Promise<PaletteBranchRecord[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palette_branches')
    .select()
    .eq('palette_id', paletteId)
    .returns<PaletteBranchRow[]>();

  if (error) throw new Error(`Failed to list branches: ${error.message}`);
  return data.map(mapBranchRow);
}

export async function updateBranchHead(
  branchId: string,
  headVersionId: string,
  client?: SupabaseClient
): Promise<PaletteBranchRecord> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('palette_branches')
    .update({ head_version_id: headVersionId })
    .eq('id', branchId)
    .select()
    .single<PaletteBranchRow>();

  if (error) throw new Error(`Failed to update branch head: ${error.message}`);
  return mapBranchRow(data);
}
