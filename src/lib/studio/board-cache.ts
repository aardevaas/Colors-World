/**
 * Local IndexedDB cache for a project's Studio board — cache, not truth.
 * Postgres (via board.ts) remains the source of truth; this only lets a
 * returning visitor's cards paint instantly from the last-seen state before
 * the server fetch resolves and reconciles (server wins conflicts).
 *
 * Every entry point degrades to a silent no-op when IndexedDB is missing
 * (SSR, where the global doesn't exist at all) or blocked (Safari private
 * mode, where `open` can throw or fire onerror) — this cache is an optional
 * speed boost, never a dependency the board can fail without.
 */

import type { BoardCard } from '@/components/studio-wall/StudioWallBoard';

const DB_NAME = 'studio-board-cache';
const DB_VERSION = 1;
const STORE_NAME = 'boards';

interface CachedBoard {
  readonly projectId: string;
  readonly cards: readonly BoardCard[];
  readonly cachedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function readCachedBoard(projectId: string): Promise<readonly BoardCard[] | null> {
  const db = await openDb();
  if (db === null) return null;
  return new Promise((resolve) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(projectId);
    request.onsuccess = () => resolve((request.result as CachedBoard | undefined)?.cards ?? null);
    request.onerror = () => resolve(null);
  });
}

export async function writeCachedBoard(projectId: string, cards: readonly BoardCard[]): Promise<void> {
  const db = await openDb();
  if (db === null) return;
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const record: CachedBoard = { projectId, cards, cachedAt: Date.now() };
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}
