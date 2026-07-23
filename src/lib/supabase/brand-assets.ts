import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

export type BrandAssetKind = 'logo' | 'mark' | 'other';

export interface BrandAssetRecord {
  readonly id: string;
  readonly projectId: string;
  readonly groupId: string;
  readonly name: string;
  readonly kind: BrandAssetKind;
  readonly version: number;
  readonly storagePath: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

interface BrandAssetRow {
  readonly id: string;
  readonly project_id: string;
  readonly group_id: string;
  readonly name: string;
  readonly kind: BrandAssetKind;
  readonly version: number;
  readonly storage_path: string;
  readonly created_by: string;
  readonly created_at: string;
}

function mapRow(row: BrandAssetRow): BrandAssetRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    groupId: row.group_id,
    name: row.name,
    kind: row.kind,
    version: row.version,
    storagePath: row.storage_path,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listBrandAssets(
  projectId: string,
  client?: SupabaseClient
): Promise<BrandAssetRecord[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('brand_assets')
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .returns<BrandAssetRow[]>();

  if (error) throw new Error(`Failed to list brand assets: ${error.message}`);
  return data.map(mapRow);
}

export interface CreateBrandAssetInput {
  readonly projectId: string;
  readonly name: string;
  readonly kind: BrandAssetKind;
  readonly storagePath: string;
  readonly createdBy: string;
  /** Omit for a brand-new asset; pass an existing groupId to add the next version to it. */
  readonly groupId?: string;
}

export async function createBrandAsset(
  input: CreateBrandAssetInput,
  client?: SupabaseClient
): Promise<BrandAssetRecord> {
  const supabase = client ?? getSupabaseClient();

  let version = 1;
  if (input.groupId !== undefined) {
    const { data: existing, error: existingError } = await supabase
      .from('brand_assets')
      .select('version')
      .eq('group_id', input.groupId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle<{ version: number }>();
    if (existingError) {
      throw new Error(`Failed to look up existing asset versions: ${existingError.message}`);
    }
    version = existing === null ? 1 : existing.version + 1;
  }

  const { data, error } = await supabase
    .from('brand_assets')
    .insert({
      project_id: input.projectId,
      // Generated here rather than left to the column default, so a
      // brand-new asset's group id is known immediately without a round trip.
      group_id: input.groupId ?? randomUUID(),
      name: input.name,
      kind: input.kind,
      version,
      storage_path: input.storagePath,
      created_by: input.createdBy,
    })
    .select()
    .single<BrandAssetRow>();

  if (error) throw new Error(`Failed to create brand asset: ${error.message}`);
  return mapRow(data);
}

export async function deleteBrandAsset(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? getSupabaseClient();
  const { error } = await supabase.from('brand_assets').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete brand asset: ${error.message}`);
}
