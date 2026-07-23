'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_FILTER_SELECTION,
  hasActiveFilters,
  matchesFilters,
  resolveSpectrumFilters,
  type SpectrumFilterSelection,
} from '@/lib/spectrum/filters';
import { hueFamilyName } from '@/lib/spectrum/hue-family';
import {
  TOTAL_SPECTRUM_SIZE,
  indexToSwatch,
  type GeneratedSwatch,
} from '@/lib/spectrum/generate-color';
import { FilterBar } from './FilterBar';
import { SwatchCell } from './SwatchCell';
import { SpectrumDetail } from './SpectrumDetail';
import { CollectTray } from './CollectTray';
import styles from './spectrum.module.css';

const CELL_SIZE = 56;
const BUFFER_ROWS = 4;
const COLLECTED_STORAGE_KEY = 'colorsworld.spectrum.collected';

/**
 * At 16.7M items, `totalRows * CELL_SIZE` is tens of millions of pixels —
 * past Chromium's/Firefox's ~33.5M px max element height, past which layout
 * silently breaks (the whole scroll area renders blank). The fix: the
 * scrollable track is capped at this constant regardless of how many rows
 * actually exist, and scroll position is read back as a *fraction* of the
 * track rather than a literal pixel-to-row mapping. A pixel of scroll then
 * represents many rows at this scale — expected and correct: nobody scrolls
 * pixel-by-pixel through 16.7 million colours, the scrollbar is a coarse
 * "jump to this general area" control, same as it would be in any file
 * browser or photo library at this size.
 */
const MAX_TRACK_PX = 6_000_000;

/**
 * Every colour here is generated on demand (see generate-color.ts) — there is
 * no database behind this browser at all. A filtered scan is a plain forward
 * loop over the 16.7M-colour index space rather than a network round trip,
 * so this cap exists only to bound a pathological filter combination
 * (one matching almost nothing), not for performance — arithmetic this cheap
 * scans millions of candidates in milliseconds either way.
 */
const MAX_FILTER_SCAN_PER_STEP = 2_000_000;

interface VisibleRange {
  readonly startRow: number;
  readonly endRow: number;
  readonly startPos: number;
  readonly endPosExclusive: number;
  /** Computed alongside the scroll fraction that produced them — never
   * re-derived from startRow/endRow at render time, which is what caused
   * the content to drift out from under the viewport (two different
   * "row count" bases producing two different fractions). */
  readonly topSpacer: number;
  readonly bottomSpacer: number;
}

const EMPTY_VISIBLE_RANGE: VisibleRange = {
  startRow: 0,
  endRow: 0,
  startPos: 0,
  endPosExclusive: 0,
  topSpacer: 0,
  bottomSpacer: 0,
};

export function SpectrumBrowser() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(0);
  // Tracked separately from `columns` so a height-only layout settle (e.g.
  // fonts loading, the sticky header appearing) still triggers a recompute —
  // depending on `columns` alone missed this, since column count is
  // width-derived and can stay unchanged while clientHeight was still 0 at
  // the moment of the very first measurement.
  const [containerHeight, setContainerHeight] = useState(0);
  // `.cell` is `aspect-ratio: 1`, so its real rendered size is whatever a
  // grid `1fr` track works out to (containerWidth / columns) — not
  // necessarily CELL_SIZE, which only decides how many columns fit. Row
  // math must use this real value or spacers drift out of sync with what's
  // actually on screen.
  const [rowHeight, setRowHeight] = useState(CELL_SIZE);

  const [filterSelection, setFilterSelection] =
    useState<SpectrumFilterSelection>(DEFAULT_FILTER_SELECTION);
  const filtered = hasActiveFilters(filterSelection);
  const filters = useMemo(() => resolveSpectrumFilters(filterSelection), [filterSelection]);
  const filtersKey = JSON.stringify(filters);

  // Filtered mode: matches found so far, plus where the forward scan left
  // off. Filtering breaks "position === global index" (there are gaps), so
  // this can only grow forward, not jump to an arbitrary point — same
  // trade-off as before, just computed instead of fetched.
  const [filteredSwatches, setFilteredSwatches] = useState<GeneratedSwatch[]>([]);
  const scanCursorRef = useRef(0);
  const [filteredExhausted, setFilteredExhausted] = useState(false);

  const [visibleRange, setVisibleRange] = useState<VisibleRange>(EMPTY_VISIBLE_RANGE);

  const [collected, setCollected] = useState<Map<string, GeneratedSwatch>>(() => new Map());
  const [selected, setSelected] = useState<GeneratedSwatch | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  // Collected colours persist across visits — everything else here is
  // re-derivable from its index and deliberately isn't stored.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLECTED_STORAGE_KEY);
      if (raw === null) return;
      const items = JSON.parse(raw) as GeneratedSwatch[];
      setCollected(new Map(items.map((item) => [item.hex, item])));
    } catch {
      // Corrupt or inaccessible storage — start with an empty tray rather
      // than breaking the whole page over a persistence nicety.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COLLECTED_STORAGE_KEY,
        JSON.stringify([...collected.values()])
      );
    } catch {
      // Storage full or unavailable — the tray still works for this
      // session, it just won't survive a reload.
    }
  }, [collected]);

  function toggleCollect(swatch: GeneratedSwatch) {
    setCollected((prev) => {
      const next = new Map(prev);
      if (next.has(swatch.hex)) next.delete(swatch.hex);
      else next.set(swatch.hex, swatch);
      return next;
    });
  }

  // Measure how many CELL_SIZE columns actually fit — the virtualization math
  // (which row a scroll position corresponds to) depends on this being exact,
  // not an approximation of what CSS grid's auto-fill will decide to do.
  useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;

    function applyMeasurement(width: number, height: number) {
      const nextColumns = Math.max(1, Math.floor(width / CELL_SIZE));
      setColumns(nextColumns);
      setContainerHeight(height);
      setRowHeight(width / nextColumns);
    }

    // ResizeObserver is spec'd to report asynchronously — there's a real
    // window right after mount where a fast interaction (e.g. picking a
    // filter before the first callback fires) would otherwise see columns
    // still at its initial 0. Measuring synchronously here closes that gap;
    // the observer below only needs to catch genuine later resizes.
    applyMeasurement(el.clientWidth, el.clientHeight);

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      applyMeasurement(rect?.width ?? el.clientWidth, rect?.height ?? el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Filters changed — the filtered result set starts over from nothing.
  useEffect(() => {
    setFilteredSwatches([]);
    scanCursorRef.current = 0;
    setFilteredExhausted(false);
  }, [filtersKey]);

  useEffect(() => {
    updateVisibleRange();
    // Re-run whenever the things that change what "visible" needs depend on:
    // column count, real container height/row height, filter mode, or new
    // matches arriving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, containerHeight, rowHeight, filtered, filteredSwatches.length]);

  function scanForward(desiredCount: number) {
    if (filteredExhausted || filteredSwatches.length >= desiredCount) return;

    const matches: GeneratedSwatch[] = [];
    let cursor = scanCursorRef.current;
    let scanned = 0;
    while (
      filteredSwatches.length + matches.length < desiredCount &&
      cursor < TOTAL_SPECTRUM_SIZE &&
      scanned < MAX_FILTER_SCAN_PER_STEP
    ) {
      const swatch = indexToSwatch(cursor);
      if (matchesFilters(swatch.oklch, filters)) matches.push(swatch);
      cursor += 1;
      scanned += 1;
    }

    scanCursorRef.current = cursor;
    if (cursor >= TOTAL_SPECTRUM_SIZE) setFilteredExhausted(true);
    if (matches.length > 0) setFilteredSwatches((prev) => [...prev, ...matches]);
  }

  function updateVisibleRange() {
    const el = containerRef.current;
    if (el === null || columns === 0) return;

    const ceiling = filtered ? filteredSwatches.length : TOTAL_SPECTRUM_SIZE;
    const totalRows = Math.ceil(ceiling / columns);
    const visibleRowCount = Math.ceil(el.clientHeight / rowHeight) + 1;
    const maxFirstRow = Math.max(0, totalRows - visibleRowCount);

    // Real row height only applies within one screenful. Beyond that, WHICH
    // colours to render is a fraction of the (capped) track, not a
    // pixel-exact row index — see MAX_TRACK_PX above for why a literal
    // per-row mapping breaks at this scale. This only picks content; it
    // never feeds the spacer math below, which uses the real scrollTop
    // directly so the rendered rows always land exactly under the viewport
    // regardless of how approximate the row/content mapping is.
    const trackHeight = Math.min(MAX_TRACK_PX, totalRows * rowHeight);
    const scrollableTrack = Math.max(1, trackHeight - el.clientHeight);
    const fraction =
      trackHeight <= el.clientHeight ? 0 : Math.min(1, el.scrollTop / scrollableTrack);

    const firstRow = Math.min(maxFirstRow, Math.round(fraction * maxFirstRow));
    const startRow = Math.max(0, firstRow - BUFFER_ROWS);
    const endRow = firstRow + visibleRowCount + BUFFER_ROWS;

    const startPos = startRow * columns;
    const endPosExclusive = Math.max(startPos, Math.min(ceiling, endRow * columns));

    // Buffered rows render just above the viewport's current top edge (not
    // exactly at it), so a small further scroll finds them already there.
    const renderedContentHeight = (endRow - startRow) * rowHeight;
    const maxTopSpacer = Math.max(0, trackHeight - renderedContentHeight);
    const topSpacer = Math.max(0, Math.min(el.scrollTop - BUFFER_ROWS * rowHeight, maxTopSpacer));
    const bottomSpacer = Math.max(0, trackHeight - topSpacer - renderedContentHeight);

    setVisibleRange({ startRow, endRow, startPos, endPosExclusive, topSpacer, bottomSpacer });

    if (filtered) scanForward(endRow * columns);
  }

  const rafPending = useRef(false);
  function handleScroll() {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      updateVisibleRange();
    });
  }

  const ceiling = filtered ? filteredSwatches.length : TOTAL_SPECTRUM_SIZE;
  const { topSpacer, bottomSpacer } = visibleRange;

  const visibleItems: GeneratedSwatch[] = [];
  for (let pos = visibleRange.startPos; pos < visibleRange.endPosExclusive; pos += 1) {
    const swatch = filtered ? filteredSwatches[pos] : indexToSwatch(pos);
    if (swatch !== undefined) visibleItems.push(swatch);
  }

  const topSwatch = filtered ? filteredSwatches[visibleRange.startPos] : visibleItems[0];
  // Filtered mode doesn't know the true match count up front — only how many
  // matches the scan has found so far — so the total gets a "+" until
  // exhausted rather than quietly implying a precise count it doesn't have.
  const totalLabel =
    filtered && !filteredExhausted ? `${ceiling.toLocaleString()}+` : ceiling.toLocaleString();
  const stickyLabel = topSwatch
    ? `${hueFamilyName(topSwatch.oklch.h)} — ${(filtered
        ? visibleRange.startPos
        : topSwatch.index
      ).toLocaleString()} of ${totalLabel}`
    : '';

  return (
    <div className={styles.browser}>
      <FilterBar
        selection={filterSelection}
        onChange={setFilterSelection}
        collectedCount={collected.size}
        onOpenTray={() => setTrayOpen(true)}
      />

      {stickyLabel !== '' && <div className={styles.stickyHeader}>{stickyLabel}</div>}

      <div ref={containerRef} className={styles.scrollArea} onScroll={handleScroll}>
        <div style={{ height: topSpacer }} />
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, 1fr)` }}
        >
          {visibleItems.map((swatch) => (
            <SwatchCell
              key={swatch.index}
              swatch={swatch}
              collected={collected.has(swatch.hex)}
              onSelect={setSelected}
              onToggleCollect={toggleCollect}
            />
          ))}
        </div>
        <div style={{ height: bottomSpacer }} />
        {filtered && !filteredExhausted && filteredSwatches.length > 0 && (
          <p className={styles.loadingMore}>loading more…</p>
        )}
      </div>

      {selected !== null && (
        <SpectrumDetail
          swatch={selected}
          collected={collected.has(selected.hex)}
          onToggleCollect={toggleCollect}
          onClose={() => setSelected(null)}
        />
      )}

      {trayOpen && (
        <CollectTray
          swatches={[...collected.values()]}
          onRemove={toggleCollect}
          onClose={() => setTrayOpen(false)}
        />
      )}
    </div>
  );
}
