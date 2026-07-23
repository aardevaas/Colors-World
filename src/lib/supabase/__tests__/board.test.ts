import { describe, expect, test } from 'vitest';
import {
  createBoardItem,
  deleteBoardItem,
  listBoardItems,
  updateBoardItemPosition,
  updateItemContent,
  updateNoteContent,
} from '../board';
import { createFakeSupabaseClient } from './fake-client';

const PROJECT_ID = 'project-1';

describe('createBoardItem', () => {
  test('creates a note with sensible defaults', async () => {
    const client = createFakeSupabaseClient();
    const item = await createBoardItem(
      { projectId: PROJECT_ID, itemType: 'note', content: { text: 'hello' }, x: 10, y: 20 },
      client
    );

    expect(item.itemType).toBe('note');
    expect(item.refId).toBeNull();
    expect(item.content).toEqual({ text: 'hello' });
    expect(item.x).toBe(10);
    expect(item.y).toBe(20);
    expect(item.width).toBe(240);
    expect(item.height).toBe(180);
    expect(item.rotation).toBe(0);
  });

  test('creates a palette item pointing at a real palette', async () => {
    const client = createFakeSupabaseClient();
    const item = await createBoardItem(
      { projectId: PROJECT_ID, itemType: 'palette', refId: 'palette-1', x: 0, y: 0 },
      client
    );

    expect(item.itemType).toBe('palette');
    expect(item.refId).toBe('palette-1');
  });
});

describe('listBoardItems', () => {
  test('only returns items for the given project', async () => {
    const client = createFakeSupabaseClient();
    await createBoardItem({ projectId: PROJECT_ID, itemType: 'note', x: 0, y: 0 }, client);
    await createBoardItem({ projectId: 'other-project', itemType: 'note', x: 0, y: 0 }, client);

    const items = await listBoardItems(PROJECT_ID, client);
    expect(items).toHaveLength(1);
    expect(items[0]?.projectId).toBe(PROJECT_ID);
  });
});

describe('updateBoardItemPosition', () => {
  test('moves an item to a new x/y', async () => {
    const client = createFakeSupabaseClient();
    const item = await createBoardItem(
      { projectId: PROJECT_ID, itemType: 'note', x: 0, y: 0 },
      client
    );

    const moved = await updateBoardItemPosition(item.id, { x: 50, y: 75 }, client);
    expect(moved.x).toBe(50);
    expect(moved.y).toBe(75);
  });
});

describe('updateNoteContent', () => {
  test('replaces the note text', async () => {
    const client = createFakeSupabaseClient();
    const item = await createBoardItem(
      { projectId: PROJECT_ID, itemType: 'note', content: { text: 'draft' }, x: 0, y: 0 },
      client
    );

    const updated = await updateNoteContent(item.id, 'final text', client);
    expect(updated.content).toEqual({ text: 'final text' });
  });
});

describe('updateItemContent', () => {
  test('replaces a gradient item content wholesale', async () => {
    const client = createFakeSupabaseClient();
    const item = await createBoardItem(
      {
        projectId: PROJECT_ID,
        itemType: 'gradient',
        content: { colors: ['#ff0000', '#0000ff'] },
        x: 0,
        y: 0,
      },
      client
    );

    const updated = await updateItemContent(item.id, { colors: ['#00ff00', '#ffff00'] }, client);
    expect(updated.content).toEqual({ colors: ['#00ff00', '#ffff00'] });
    expect(updated.itemType).toBe('gradient');
  });
});

describe('deleteBoardItem', () => {
  test('removes the item from the board', async () => {
    const client = createFakeSupabaseClient();
    const item = await createBoardItem(
      { projectId: PROJECT_ID, itemType: 'note', x: 0, y: 0 },
      client
    );

    await deleteBoardItem(item.id, client);
    expect(await listBoardItems(PROJECT_ID, client)).toHaveLength(0);
  });
});
