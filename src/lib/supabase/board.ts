import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

export type BoardItemType =
  | 'palette'
  | 'note'
  | 'gradient'
  | 'image'
  | 'color'
  | 'link'
  | 'type-pairing';

/** Single private bucket for every project's reference photos/logos — see supabase/storage.sql. */
export const BOARD_ASSETS_BUCKET = 'board-assets';

export interface BoardItemRecord {
  readonly id: string;
  readonly projectId: string;
  readonly itemType: BoardItemType;
  /** Points at a palette row when itemType is 'palette'; null for a 'note'. */
  readonly refId: string | null;
  /** Freeform payload — currently just `{ text }` for notes. */
  readonly content: Record<string, unknown> | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly zIndex: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface BoardItemRow {
  readonly id: string;
  readonly project_id: string;
  readonly item_type: BoardItemType;
  readonly ref_id: string | null;
  readonly content: Record<string, unknown> | null;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly z_index: number;
  readonly created_at: string;
  readonly updated_at: string;
}

function mapBoardItemRow(row: BoardItemRow): BoardItemRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    itemType: row.item_type,
    refId: row.ref_id,
    content: row.content,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    zIndex: row.z_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBoardItems(
  projectId: string,
  client?: SupabaseClient
): Promise<BoardItemRecord[]> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('board_items')
    .select()
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })
    .returns<BoardItemRow[]>();

  if (error) throw new Error(`Failed to list board items: ${error.message}`);
  return data.map(mapBoardItemRow);
}

export interface CreateBoardItemInput {
  readonly projectId: string;
  readonly itemType: BoardItemType;
  readonly refId?: string;
  readonly content?: Record<string, unknown>;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly rotation?: number;
  readonly zIndex?: number;
}

export async function createBoardItem(
  input: CreateBoardItemInput,
  client?: SupabaseClient
): Promise<BoardItemRecord> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('board_items')
    .insert({
      project_id: input.projectId,
      item_type: input.itemType,
      ref_id: input.refId ?? null,
      content: input.content ?? null,
      x: input.x,
      y: input.y,
      width: input.width ?? 240,
      height: input.height ?? 180,
      rotation: input.rotation ?? 0,
      z_index: input.zIndex ?? 0,
    })
    .select()
    .single<BoardItemRow>();

  if (error) throw new Error(`Failed to create board item: ${error.message}`);
  return mapBoardItemRow(data);
}

export async function updateBoardItemPosition(
  id: string,
  position: { x: number; y: number; zIndex?: number },
  client?: SupabaseClient
): Promise<BoardItemRecord> {
  const supabase = client ?? getSupabaseClient();
  const update: Record<string, unknown> = { x: position.x, y: position.y };
  if (position.zIndex !== undefined) update.z_index = position.zIndex;

  const { data, error } = await supabase
    .from('board_items')
    .update(update)
    .eq('id', id)
    .select()
    .single<BoardItemRow>();

  if (error) throw new Error(`Failed to update board item position: ${error.message}`);
  return mapBoardItemRow(data);
}

export async function updateNoteContent(
  id: string,
  text: string,
  client?: SupabaseClient
): Promise<BoardItemRecord> {
  return updateItemContent(id, { text }, client);
}

/** Generic content replace, shared by gradient and image items (note keeps its own typed wrapper above). */
export async function updateItemContent(
  id: string,
  content: Record<string, unknown>,
  client?: SupabaseClient
): Promise<BoardItemRecord> {
  const supabase = client ?? getSupabaseClient();
  const { data, error } = await supabase
    .from('board_items')
    .update({ content })
    .eq('id', id)
    .select()
    .single<BoardItemRow>();

  if (error) throw new Error(`Failed to update board item content: ${error.message}`);
  return mapBoardItemRow(data);
}

export async function deleteBoardItem(id: string, client?: SupabaseClient): Promise<void> {
  const supabase = client ?? getSupabaseClient();
  const { error } = await supabase.from('board_items').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete board item: ${error.message}`);
}

const BOARD_COLUMNS = 4;
const BOARD_COLUMN_SPACING = 260;
const BOARD_ROW_SPACING = 220;
const BOARD_MARGIN = 40;

/**
 * Where a newly-created item lands before anyone's dragged it — a loose
 * grid stagger (by insertion order) plus a small deterministic rotation, so
 * a fresh board doesn't look like everything landed in one pile at (0, 0)
 * but two people opening the same project never see items jump around from
 * a random seed either.
 */
export function nextBoardPosition(existingItemCount: number): {
  x: number;
  y: number;
  rotation: number;
} {
  const column = existingItemCount % BOARD_COLUMNS;
  const row = Math.floor(existingItemCount / BOARD_COLUMNS);
  return {
    x: BOARD_MARGIN + column * BOARD_COLUMN_SPACING,
    y: BOARD_MARGIN + row * BOARD_ROW_SPACING,
    rotation: ((existingItemCount * 37) % 7) - 3,
  };
}
