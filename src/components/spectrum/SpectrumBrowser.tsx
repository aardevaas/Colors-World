'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpectrumRow } from '@/lib/supabase/colors';
import {
  DEFAULT_FILTER_SELECTION,
  hasActiveFilters,
  resolveSpectrumFilters,
  type SpectrumFilterSelection,
} from '@/lib/spectrum/filters';
import { hueFamilyName } from '@/lib/spectrum/hue-family';
import { fetchSpectrumPage, fetchSpectrumWindow } from '@/app/spectrum/actions';
import { FilterBar } from './FilterBar';
import { SwatchCell } from './SwatchCell';
import { SpectrumDetail } from './SpectrumDetail';
import { CollectTray } from './CollectTray';
import styles from './spectrum.module.css';

interface SpectrumBrowserProps {
  readonly total: number;
  readonly initialRows: readonly SpectrumRow[];
}

const CELL_SIZE = 56;
const BUFFER_ROWS = 4;
const FILTERED_PAGE_SIZE = 300;
const COLLECTED_STORAGE_KEY = 'prism.spectrum.collected';

interface VisibleRange {
  readonly startRow: number;
  readonly endRow: number;
  readonly startPos: number;
  readonly endPosExclusive: number;
}

export function SpectrumBrowser({ total, initialRows }: SpectrumBrowserProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columns, setColumns] = useState(0);

  const [filterSelection, setFilterSelection] =
    useState<SpectrumFilterSelection>(DEFAULT_FILTER_SELECTION);
  const filtered = hasActiveFilters(filterSelection);
  const filters = useMemo(() => resolveSpectrumFilters(filterSelection), [filterSelection]);
  const filtersKey = JSON.stringify(filters);

  // Unfiltered mode: a sparse, position-keyed cache over the whole 100K rows —
  // position === spectrum_index, which is what makes an arbitrary scrollbar
  // jump resolvable with one windowed fetch instead of a scan.
  const [loaded, setLoaded] = useState<Map<number, SpectrumRow>>(
    () => new Map(initialRows.map((row) => [row.spectrumIndex, row]))
  );

  // Filtered mode: a plain append-only list, paged forward with a cursor —
  // filtering breaks the "position === spectrum_index" guarantee, so this
  // can only grow by scrolling further, not jump to an arbitrary point.
  const [filteredItems, setFilteredItems] = useState<SpectrumRow[]>([]);
  const [filteredExhausted, setFilteredExhausted] = useState(false);
  const fetchingRef = useRef(false);

  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    startRow: 0,
    endRow: 0,
    startPos: 0,
    endPosExclusive: 0,
  });

  const [collected, setCollected] = useState<Map<string, SpectrumRow>>(() => new Map());
  const [selected, setSelected] = useState<SpectrumRow | null>(null);
  const [trayOpen, setTrayOpen] = useState(false);

  // Collected colours persist across visits — everything else here is
  // re-derivable from the database and deliberately isn't.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLECTED_STORAGE_KEY);
      if (raw === null) return;
      const rows = JSON.parse(raw) as SpectrumRow[];
      setCollected(new Map(rows.map((row) => [row.id, row])));
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

  function toggleCollect(row: SpectrumRow) {
    setCollected((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  }

  // Measure how many CELL_SIZE columns actually fit — the virtualization math
  // (which row a scroll position corresponds to) depends on this being exact,
  // not an approximation of what CSS grid's auto-fill will decide to do.
  useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      setColumns(Math.max(1, Math.floor(width / CELL_SIZE)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Filters changed — the filtered result set starts over from nothing.
  useEffect(() => {
    setFilteredItems([]);
    setFilteredExhausted(false);
  }, [filtersKey]);

  useEffect(() => {
    updateVisibleRange();
    // Re-run whenever the things that change what "visible" fetches are
    // needed depend on: column count, filter mode, or new data arriving.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, filtered, filteredItems.length, total]);

  function updateVisibleRange() {
    const el = containerRef.current;
    if (el === null || columns === 0) return;

    const firstRow = Math.floor(el.scrollTop / CELL_SIZE);
    const visibleRowCount = Math.ceil(el.clientHeight / CELL_SIZE) + 1;
    const startRow = Math.max(0, firstRow - BUFFER_ROWS);
    const endRow = firstRow + visibleRowCount + BUFFER_ROWS;

    const startPos = startRow * columns;
    const ceiling = filtered ? filteredItems.length : total;
    const endPosExclusive = Math.max(startPos, Math.min(ceiling, endRow * columns));

    setVisibleRange({ startRow, endRow, startPos, endPosExclusive });

    if (filtered) {
      void ensureFilteredLoaded(endRow * columns);
    } else {
      void ensureWindowLoaded(startPos, Math.min(total, endRow * columns));
    }
  }

  async function ensureWindowLoaded(start: number, endExclusive: number) {
    if (endExclusive <= start) return;
    let hasGap = false;
    for (let i = start; i < endExclusive; i += 1) {
      if (!loaded.has(i)) {
        hasGap = true;
        break;
      }
    }
    if (!hasGap || fetchingRef.current) return;

    fetchingRef.current = true;
    try {
      const rows = await fetchSpectrumWindow(start, endExclusive - start);
      setLoaded((prev) => {
        const next = new Map(prev);
        for (const row of rows) next.set(row.spectrumIndex, row);
        return next;
      });
    } finally {
      fetchingRef.current = false;
    }
  }

  async function ensureFilteredLoaded(desiredCount: number) {
    if (filteredExhausted || fetchingRef.current) return;
    if (filteredItems.length >= desiredCount) return;

    fetchingRef.current = true;
    try {
      const afterIndex = filteredItems.at(-1)?.spectrumIndex;
      const page = await fetchSpectrumPage(afterIndex, FILTERED_PAGE_SIZE, filters);
      setFilteredItems((prev) => [...prev, ...page]);
      if (page.length < FILTERED_PAGE_SIZE) setFilteredExhausted(true);
    } finally {
      fetchingRef.current = false;
    }
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

  const ceiling = filtered ? filteredItems.length : total;
  const totalRows = columns > 0 ? Math.ceil(ceiling / columns) : 0;
  const topSpacer = visibleRange.startRow * CELL_SIZE;
  const bottomSpacer = Math.max(0, (totalRows - visibleRange.endRow) * CELL_SIZE);

  const visibleItems: SpectrumRow[] = [];
  for (let pos = visibleRange.startPos; pos < visibleRange.endPosExclusive; pos += 1) {
    const row = filtered ? filteredItems[pos] : loaded.get(pos);
    if (row !== undefined) visibleItems.push(row);
  }

  const topRow = filtered ? filteredItems[visibleRange.startPos] : loaded.get(visibleRange.startPos);
  // Filtered mode doesn't know the true match count up front — only how many
  // pages it has fetched so far — so the total gets a "+" until exhausted
  // rather than quietly implying a precise count it doesn't have.
  const totalLabel =
    filtered && !filteredExhausted ? `${ceiling.toLocaleString()}+` : ceiling.toLocaleString();
  const stickyLabel = topRow
    ? `${hueFamilyName(topRow.oklch.h)} — ${(filtered
        ? visibleRange.startPos
        : topRow.spectrumIndex
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
          {visibleItems.map((row) => (
            <SwatchCell
              key={row.id}
              row={row}
              collected={collected.has(row.id)}
              onSelect={setSelected}
              onToggleCollect={toggleCollect}
            />
          ))}
        </div>
        <div style={{ height: bottomSpacer }} />
        {filtered && !filteredExhausted && filteredItems.length > 0 && (
          <p className={styles.loadingMore}>loading more…</p>
        )}
      </div>

      {selected !== null && (
        <SpectrumDetail
          row={selected}
          collected={collected.has(selected.id)}
          onToggleCollect={toggleCollect}
          onClose={() => setSelected(null)}
        />
      )}

      {trayOpen && (
        <CollectTray
          rows={[...collected.values()]}
          onRemove={toggleCollect}
          onClose={() => setTrayOpen(false)}
        />
      )}
    </div>
  );
}
