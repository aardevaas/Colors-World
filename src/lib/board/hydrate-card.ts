import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BOARD_ASSETS_BUCKET, type listBoardItems } from '@/lib/supabase/board';
import { getPalette } from '@/lib/supabase/palettes';
import { getBranchSnapshot } from '@/lib/supabase/branch-workflow';
import { DEFAULT_FONT_PAIR_ID } from '@/lib/typography/font-pairs';
import type { BoardCard } from '@/components/studio-wall/StudioWallBoard';

const IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Turns one board_items row into a renderable BoardCard, resolving whatever
 * it points at (a palette's live snapshot, a signed image URL). Shared by
 * the authenticated Studio Wall and the public read-only share page — both
 * render the same cards, just with different write permissions above this.
 */
export async function hydrateBoardCard(
  item: Awaited<ReturnType<typeof listBoardItems>>[number],
  supabase: SupabaseClient
): Promise<BoardCard> {
  const base = {
    id: item.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation,
    zIndex: item.zIndex,
  };

  if (item.itemType === 'note') {
    const text = typeof item.content?.text === 'string' ? item.content.text : '';
    return { ...base, kind: 'note', text };
  }

  if (item.itemType === 'gradient') {
    const colors = Array.isArray(item.content?.colors)
      ? (item.content.colors as unknown[]).filter((c): c is string => typeof c === 'string')
      : [];
    return {
      ...base,
      kind: 'gradient',
      colors: colors.length >= 2 ? colors : ['#7c5cff', '#ffb454'],
    };
  }

  if (item.itemType === 'type-pairing') {
    const pairId =
      typeof item.content?.pairId === 'string' ? item.content.pairId : DEFAULT_FONT_PAIR_ID;
    return { ...base, kind: 'type-pairing', pairId };
  }

  if (item.itemType === 'link') {
    const url = typeof item.content?.url === 'string' ? item.content.url : null;
    if (url === null) {
      return { ...base, kind: 'note', text: '⚠ link is missing its URL' };
    }
    const title = typeof item.content?.title === 'string' ? item.content.title : url;
    return { ...base, kind: 'link', url, title };
  }

  if (item.itemType === 'color') {
    const hex = typeof item.content?.hex === 'string' ? item.content.hex : '#888888';
    const name = typeof item.content?.name === 'string' ? item.content.name : null;
    return { ...base, kind: 'color', hex, name };
  }

  if (item.itemType === 'image') {
    const path = typeof item.content?.path === 'string' ? item.content.path : null;
    if (path === null) {
      return { ...base, kind: 'note', text: '⚠ image reference is missing' };
    }
    const colors = Array.isArray(item.content?.colors)
      ? (item.content.colors as unknown[]).filter((c): c is string => typeof c === 'string')
      : [];
    const { data: signed } = await supabase.storage
      .from(BOARD_ASSETS_BUCKET)
      .createSignedUrl(path, IMAGE_SIGNED_URL_TTL_SECONDS);
    return { ...base, kind: 'image', path, url: signed?.signedUrl ?? null, colors };
  }

  // item.itemType === 'palette' — refId is only ever null for the other item types.
  const paletteId = item.refId as string;
  const [palette, branch] = await Promise.all([
    getPalette(paletteId, supabase),
    getBranchSnapshot(paletteId, 'main', supabase),
  ]);

  // The palette this card pointed at was deleted independently of the board
  // — render it as a stub rather than crashing the whole wall over one dead card.
  if (palette === null || branch === null) {
    return { ...base, kind: 'note', text: '⚠ palette no longer exists' };
  }

  return {
    ...base,
    kind: 'palette',
    paletteId: palette.id,
    name: palette.name,
    swatches: Object.values(branch.snapshot),
  };
}
