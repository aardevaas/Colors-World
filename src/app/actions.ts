'use server';

import { randomUUID } from 'node:crypto';
import {
  BOARD_ASSETS_BUCKET,
  createBoardItem,
  deleteBoardItem,
  listBoardItems,
  nextBoardPosition,
  updateBoardItemPosition,
  updateBoardItemSize,
  updateItemContent,
  updateNoteContent,
  type BoardItemRecord,
} from '@/lib/supabase/board';
import { initializePalette } from '@/lib/supabase/branch-workflow';
import { fetchPageTitle } from '@/lib/links/fetch-title';
import { DEFAULT_FONT_PAIR_ID } from '@/lib/typography/font-pairs';
import {
  createShareLink,
  getActiveShareLink,
  revokeShareLink,
  type ShareLinkRecord,
} from '@/lib/supabase/sharing';
import { requireProject } from '@/lib/supabase/require-project';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';

/** What an unauthenticated visitor is told when they try to edit the board. */
const STUDIO_SIGN_IN = 'You must be signed in to edit the Studio Wall.';

async function requireUserId(): Promise<{
  userId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    throw new Error(STUDIO_SIGN_IN);
  }
  return { userId: user.id, supabase };
}

export async function createNoteAction(): Promise<BoardItemRecord> {
  const { projectId, supabase } = await requireProject(STUDIO_SIGN_IN);
  const existingItems = await listBoardItems(projectId, supabase);

  return createBoardItem(
    {
      projectId,
      itemType: 'note',
      content: { text: '' },
      ...nextBoardPosition(existingItems.length),
    },
    supabase
  );
}

/** Pins a single Spectrum swatch to the Studio Wall — "individual colors, dragged from the Spectrum tray." */
export async function pinColorAction(hex: string, name?: string): Promise<BoardItemRecord> {
  const { projectId, supabase } = await requireProject(STUDIO_SIGN_IN);
  const existingItems = await listBoardItems(projectId, supabase);

  return createBoardItem(
    {
      projectId,
      itemType: 'color',
      content: { hex, name: name ?? null },
      width: 200,
      height: 260,
      ...nextBoardPosition(existingItems.length),
    },
    supabase
  );
}

export async function createGradientAction(colors: string[]): Promise<BoardItemRecord> {
  const { projectId, supabase } = await requireProject(STUDIO_SIGN_IN);
  const existingItems = await listBoardItems(projectId, supabase);

  return createBoardItem(
    {
      projectId,
      itemType: 'gradient',
      content: { colors },
      width: 320,
      height: 140,
      ...nextBoardPosition(existingItems.length),
    },
    supabase
  );
}

export async function moveItemAction(
  id: string,
  x: number,
  y: number,
  zIndex: number,
  rotation?: number
): Promise<void> {
  const { supabase } = await requireUserId();
  await updateBoardItemPosition(id, { x, y, zIndex, rotation }, supabase);
}

export async function resizeItemAction(id: string, width: number, height: number): Promise<void> {
  const { supabase } = await requireUserId();
  await updateBoardItemSize(id, { width, height }, supabase);
}

export async function updateNoteAction(id: string, text: string): Promise<void> {
  const { supabase } = await requireUserId();
  await updateNoteContent(id, text, supabase);
}

export async function updateGradientAction(id: string, colors: string[]): Promise<void> {
  const { supabase } = await requireUserId();
  await updateItemContent(id, { colors }, supabase);
}

export async function deleteItemAction(id: string): Promise<void> {
  const { supabase } = await requireUserId();
  await deleteBoardItem(id, supabase);
}

export async function createTypePairingAction(): Promise<BoardItemRecord> {
  const { projectId, supabase } = await requireProject(STUDIO_SIGN_IN);
  const existingItems = await listBoardItems(projectId, supabase);

  return createBoardItem(
    {
      projectId,
      itemType: 'type-pairing',
      content: { pairId: DEFAULT_FONT_PAIR_ID },
      width: 280,
      height: 220,
      ...nextBoardPosition(existingItems.length),
    },
    supabase
  );
}

export async function updateTypePairingAction(id: string, pairId: string): Promise<void> {
  const { supabase } = await requireUserId();
  await updateItemContent(id, { pairId }, supabase);
}

/** Pins a URL to the Studio Wall, fetching a page title for the preview card on a best-effort basis. */
export async function createLinkAction(rawUrl: string): Promise<BoardItemRecord> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('That link needs a full URL, e.g. https://example.com');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http:// and https:// links can be pinned.');
  }

  const { projectId, supabase } = await requireProject(STUDIO_SIGN_IN);
  const existingItems = await listBoardItems(projectId, supabase);
  const title = await fetchPageTitle(url.toString());

  return createBoardItem(
    {
      projectId,
      itemType: 'link',
      content: { url: url.toString(), title: title ?? url.hostname },
      width: 240,
      height: 100,
      ...nextBoardPosition(existingItems.length),
    },
    supabase
  );
}

/** Get-or-create semantics — a "Share" button always shows one live link, not a new one every click. */
export async function getOrCreateShareLinkAction(): Promise<ShareLinkRecord> {
  const { userId, projectId, supabase } = await requireProject(STUDIO_SIGN_IN);

  const existing = await getActiveShareLink(projectId, supabase);
  if (existing !== null) return existing;

  return createShareLink(projectId, userId, supabase);
}

export async function revokeShareLinkAction(id: string): Promise<void> {
  const { supabase } = await requireUserId();
  await revokeShareLink(id, supabase);
}

export interface CreateImageResult {
  readonly imageItem: BoardItemRecord;
  readonly paletteItem: BoardItemRecord | null;
  readonly paletteName: string | null;
}

/**
 * Uploads a dropped image and, when the caller already sampled dominant
 * colors client-side, pins a second card: a real palette created from them.
 * "Drop a photo → its palette extracts instantly" is two board items from
 * one action, not a separate follow-up step.
 */
export async function createImageAction(formData: FormData): Promise<CreateImageResult> {
  const { projectId, supabase } = await requireProject(STUDIO_SIGN_IN);

  const file = formData.get('file');
  if (!(file instanceof File)) {
    throw new Error('No image file was provided.');
  }

  const colorsRaw = formData.get('colors');
  const colors: string[] = typeof colorsRaw === 'string' ? JSON.parse(colorsRaw) : [];

  const path = `${projectId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BOARD_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const existingItems = await listBoardItems(projectId, supabase);
  const imageItem = await createBoardItem(
    {
      projectId,
      itemType: 'image',
      // colors travel with the image itself (not just the companion palette
      // below) so the extracted-color pins overlaid on the image card
      // survive a reload, not just the session that uploaded it.
      content: { path, colors },
      width: 220,
      height: 220,
      ...nextBoardPosition(existingItems.length),
    },
    supabase
  );

  let paletteItem: BoardItemRecord | null = null;
  let paletteName: string | null = null;
  if (colors.length >= 2) {
    const snapshot: Record<string, string> = {};
    colors.forEach((hex, index) => {
      snapshot[`color-${index + 1}`] = hex;
    });

    const name = `From ${file.name}`;
    const { palette: paletteRecord } = await initializePalette(
      name,
      snapshot,
      { message: 'Extracted from a dropped image', projectId },
      supabase
    );

    const itemsAfterImage = await listBoardItems(projectId, supabase);
    paletteItem = await createBoardItem(
      {
        projectId,
        itemType: 'palette',
        refId: paletteRecord.id,
        ...nextBoardPosition(itemsAfterImage.length),
      },
      supabase
    );
    paletteName = name;
  }

  return { imageItem, paletteItem, paletteName };
}
