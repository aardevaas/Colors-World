'use client';

import { useEffect } from 'react';
import { SYSTEM_STORAGE_KEY } from '@/lib/system/storage';

/**
 * Puts a stored System into the URL, once, when someone lands here without one.
 *
 * The Book renders on the server from `searchParams`, which is what keeps the
 * registry and the font catalogue out of the browser. Every link inside the
 * product already carries the System, so this does nothing on a normal
 * navigation.
 *
 * It exists for the bookmark. `SystemProvider` keeps the URL in step using
 * `history.replaceState`, which deliberately does not re-run a server render —
 * so a direct arrival at a bare `/brand` would render an empty guideline while
 * the person's actual System sat in localStorage two feet away.
 *
 * `window.location.replace`, not `router.replace`. Measured: the router changed
 * the address and left the document alone — the guideline still said "13 of 98
 * specified" with an empty Colour section, because Next does not refetch a
 * server component for a query change on the route it is already on. A full
 * navigation is heavier, and it is the only one that actually produces the
 * page. This runs on a bookmark arrival and nowhere else, so the cost is paid
 * approximately never.
 *
 * Runs at most once: after the replace the URL has a query, so the guard fails
 * on the next pass and there is no loop.
 */
export function SystemUrlBridge() {
  useEffect(() => {
    if (window.location.search !== '') return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(SYSTEM_STORAGE_KEY);
    } catch {
      // Storage unavailable — the empty guideline is then the honest render.
      return;
    }
    if (stored === null || stored === '') return;
    window.location.replace(`${window.location.pathname}?${stored}`);
  }, []);

  return null;
}
