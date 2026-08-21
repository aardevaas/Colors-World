'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { randomSeed } from '@/lib/spectrum/discovery-feed';
import {
  createInitialFeedState,
  libraryFeedReducer,
} from '@/lib/spectrum/library-feed-reducer';
import { findVibeMatches } from '@/lib/spectrum/vibe-match';
import { vibeSearchAction } from '@/app/actions/vibe-search';
import { fetchSemanticMatchesAction } from '@/app/actions/semantic-matches';
import type { GeneratedSwatch } from '@/lib/spectrum/generate-color';
import type { ColorRecord } from '@/lib/supabase/colors';
import { TabNav } from '@/components/nav/TabNav';
import { ImageSeed } from './ImageSeed';
import { LibraryGrid, LIBRARY_BATCH_SIZE } from './LibraryGrid';
import { GeneticsDrawer } from './GeneticsDrawer';
import styles from './library.module.css';

const INITIAL_BATCH = LIBRARY_BATCH_SIZE * 2;
const VIBE_RESULT_COUNT = 90;
/** Batches rapid-fire scroll-driven lookups into one request instead of one
 *  per settled scroll frame — the enrichment is a nice-to-have overlay, not
 *  something that needs to race the render. */
const SEMANTIC_LOOKUP_DEBOUNCE_MS = 220;

export function LibraryShell() {
  const [feedState, dispatch] = useReducer(
    libraryFeedReducer,
    undefined,
    () => createInitialFeedState(randomSeed(), INITIAL_BATCH)
  );

  const [queryInput, setQueryInput] = useState('');
  const [semanticMatches, setSemanticMatches] = useState<Map<number, ColorRecord>>(
    () => new Map()
  );
  const [selectedSwatch, setSelectedSwatch] = useState<{
    swatch: GeneratedSwatch;
    semanticMatch: ColorRecord | null;
  } | null>(null);

  // Every bucket index ever requested, matched or not — a miss doesn't need
  // asking again, since the arithmetic-engine/DB join it depends on doesn't
  // change during a session.
  const requestedIndicesRef = useRef<Set<number>>(new Set());
  const pendingLookupRef = useRef<Set<number>>(new Set());
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSemanticLookup = useCallback(() => {
    const pending = [...pendingLookupRef.current];
    pendingLookupRef.current.clear();
    if (pending.length === 0) return;

    fetchSemanticMatchesAction(pending)
      .then((entries) => {
        if (entries.length === 0) return;
        setSemanticMatches((prev) => {
          const next = new Map(prev);
          for (const [index, record] of entries) next.set(index, record);
          return next;
        });
      })
      .catch(() => {
        // Enrichment is best-effort — a failed lookup just means those cards
        // show as plain generated swatches instead of curated matches; it
        // must never break the grid itself.
      });
  }, []);

  const handleVisibleIndicesChange = useCallback(
    (indices: readonly number[]) => {
      let hasNew = false;
      for (const index of indices) {
        if (requestedIndicesRef.current.has(index)) continue;
        requestedIndicesRef.current.add(index);
        pendingLookupRef.current.add(index);
        hasNew = true;
      }
      if (!hasNew) return;

      if (lookupTimerRef.current !== null) clearTimeout(lookupTimerRef.current);
      lookupTimerRef.current = setTimeout(flushSemanticLookup, SEMANTIC_LOOKUP_DEBOUNCE_MS);
    },
    [flushSemanticLookup]
  );

  useEffect(() => {
    return () => {
      if (lookupTimerRef.current !== null) clearTimeout(lookupTimerRef.current);
    };
  }, []);

  const handleReshuffle = useCallback(() => {
    dispatch({ type: 'reshuffle', seed: randomSeed() });
    setQueryInput('');
  }, []);

  // Serendipity Shuffle: Spacebar reshuffles the whole feed, from anywhere on
  // the page — except while the user is actually typing (a search box, or
  // any other text input), where Space has to just type a space.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      handleReshuffle();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReshuffle]);

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = queryInput.trim();
    if (trimmed === '') {
      dispatch({ type: 'clearVibe' });
      return;
    }

    dispatch({ type: 'vibeSearchStart', query: trimmed });
    try {
      const target = await vibeSearchAction(trimmed);
      const matches = findVibeMatches(target, VIBE_RESULT_COUNT);
      if (matches.length === 0) {
        dispatch({ type: 'vibeSearchError' });
        return;
      }
      dispatch({ type: 'vibeSearchSuccess', swatches: matches, label: target.rationale });
    } catch {
      dispatch({ type: 'vibeSearchError' });
    }
  }

  return (
    <div className={styles.shell}>
      <TabNav current="library" />

      <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
        <input
          className={styles.searchInput}
          type="text"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="search by vibe — “ocean at dusk”, “cyberpunk Tokyo alley”, “matcha latte”…"
        />
        <button type="submit" className={styles.searchSubmit} disabled={feedState.vibeStatus === 'loading'}>
          {feedState.vibeStatus === 'loading' ? 'searching…' : 'search'}
        </button>
        <button
          type="button"
          className={styles.shuffleButton}
          onClick={handleReshuffle}
          title="Serendipity Shuffle (or press Space anywhere on the page)"
        >
          ⤾ shuffle
        </button>
        <ImageSeed />

        <p className={styles.resultMeta}>
          {feedState.mode === 'vibe' && feedState.vibeLabel !== null
            ? feedState.vibeLabel
            : feedState.mode === 'vibe' && feedState.vibeStatus === 'error'
              ? 'No close matches for that vibe — try different words, or shuffle for a fresh set.'
              : `Browsing the full 16.7M-color space, generated on demand — press space (or the shuffle button) for a new draw.`}
        </p>
      </form>

      <LibraryGrid
        mode={feedState.mode}
        seed={feedState.seed}
        loadedCount={feedState.loadedCount}
        vibeSwatches={feedState.vibeSwatches}
        semanticMatches={semanticMatches}
        onNeedMore={(amount) => dispatch({ type: 'loadMore', amount })}
        onVisibleIndicesChange={handleVisibleIndicesChange}
        onOpenDrawer={(swatch, semanticMatch) => setSelectedSwatch({ swatch, semanticMatch })}
        resetKey={feedState.seed}
      />

      {selectedSwatch !== null && (
        <GeneticsDrawer
          swatch={selectedSwatch.swatch}
          semanticMatch={selectedSwatch.semanticMatch}
          onClose={() => setSelectedSwatch(null)}
          onInspect={(swatch) =>
            setSelectedSwatch({ swatch, semanticMatch: semanticMatches.get(swatch.index) ?? null })
          }
        />
      )}
    </div>
  );
}
