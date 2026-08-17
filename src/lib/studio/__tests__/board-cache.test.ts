import { afterEach, describe, expect, it } from 'vitest';
import { readCachedBoard, writeCachedBoard } from '../board-cache';
import type { BoardCard } from '@/components/studio-wall/StudioWallBoard';

function note(id: string, text: string): BoardCard {
  return { id, x: 0, y: 0, width: 200, height: 150, rotation: 0, zIndex: 0, kind: 'note', text };
}

/**
 * Minimal in-memory stand-in for the browser's IndexedDB, covering only the
 * request/transaction shape board-cache.ts actually calls (open + upgrade,
 * a single object store keyed by projectId, get/put). Not a real dependency
 * — scoped to this test file, installed and torn down per test so the
 * "IndexedDB unavailable" tests see the real absence of the global.
 */
function installFakeIndexedDb(): void {
  const backingStore = new Map<string, unknown>();

  const fakeDb = {
    createObjectStore: () => undefined,
    transaction: (_storeName: string, _mode: string) => {
      const tx: {
        oncomplete: (() => void) | null;
        onerror: (() => void) | null;
        objectStore: () => unknown;
      } = { oncomplete: null, onerror: null, objectStore: () => store };
      const store = {
        get: (key: string) => {
          const request: { result: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
            result: undefined,
            onsuccess: null,
            onerror: null,
          };
          queueMicrotask(() => {
            request.result = backingStore.get(key);
            request.onsuccess?.();
          });
          return request;
        },
        put: (value: { projectId: string }) => {
          backingStore.set(value.projectId, value);
          const request: { onsuccess: (() => void) | null; onerror: (() => void) | null } = {
            onsuccess: null,
            onerror: null,
          };
          queueMicrotask(() => request.onsuccess?.());
          return request;
        },
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    },
  };

  (globalThis as { indexedDB?: unknown }).indexedDB = {
    open: (_name: string, _version: number) => {
      const request: {
        result: unknown;
        onupgradeneeded: (() => void) | null;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
      } = { result: fakeDb, onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}

function uninstallFakeIndexedDb(): void {
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
}

afterEach(() => {
  uninstallFakeIndexedDb();
});

describe('board-cache — IndexedDB unavailable (the vitest node environment has no global by default)', () => {
  it('readCachedBoard resolves to null instead of throwing', async () => {
    expect(typeof indexedDB).toBe('undefined');
    await expect(readCachedBoard('project-1')).resolves.toBeNull();
  });

  it('writeCachedBoard resolves without throwing', async () => {
    await expect(writeCachedBoard('project-1', [note('a', 'hello')])).resolves.toBeUndefined();
  });
});

describe('board-cache — IndexedDB blocked mid-call (e.g. Safari private mode throwing synchronously)', () => {
  it('degrades to null/void instead of rejecting when open() throws', async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = {
      open: () => {
        throw new Error('IndexedDB is disabled in private browsing');
      },
    };
    await expect(readCachedBoard('project-1')).resolves.toBeNull();
    await expect(writeCachedBoard('project-1', [note('a', 'hello')])).resolves.toBeUndefined();
  });
});

describe('board-cache — happy path with a working IndexedDB', () => {
  it('round-trips exactly what was written', async () => {
    installFakeIndexedDb();
    const cards = [note('a', 'first'), note('b', 'second')];
    await writeCachedBoard('project-1', cards);
    const read = await readCachedBoard('project-1');
    expect(read).toEqual(cards);
  });

  it('returns null for a project that was never cached', async () => {
    installFakeIndexedDb();
    await writeCachedBoard('project-1', [note('a', 'first')]);
    const read = await readCachedBoard('project-2');
    expect(read).toBeNull();
  });

  it('overwrites rather than merges on a second write for the same project', async () => {
    installFakeIndexedDb();
    await writeCachedBoard('project-1', [note('a', 'first')]);
    await writeCachedBoard('project-1', [note('b', 'second')]);
    const read = await readCachedBoard('project-1');
    expect(read).toEqual([note('b', 'second')]);
  });

  it('keeps separate projects independent', async () => {
    installFakeIndexedDb();
    await writeCachedBoard('project-1', [note('a', 'first')]);
    await writeCachedBoard('project-2', [note('b', 'second')]);
    expect(await readCachedBoard('project-1')).toEqual([note('a', 'first')]);
    expect(await readCachedBoard('project-2')).toEqual([note('b', 'second')]);
  });
});
