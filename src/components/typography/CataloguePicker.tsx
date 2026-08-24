'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './typography.module.css';

/** One family, as `/api/fonts` returns it. The room never sees the catalogue. */
export interface CatalogueFont {
  readonly id: string;
  readonly family: string;
  readonly category: string;
  readonly weights: readonly number[];
  readonly variable: boolean;
  readonly licence: { readonly name: string; readonly id: string } | null;
  readonly stack: string | null;
}

export type FontRole = 'display' | 'body' | 'mono';

interface CataloguePickerProps {
  readonly role: FontRole;
  /** The slug currently chosen for this role, if any. */
  readonly chosen: string | undefined;
  readonly onPick: (font: CatalogueFont) => void;
  readonly onClear: () => void;
  readonly onClose: () => void;
}

const CATEGORIES = [
  { value: '', label: 'Any' },
  { value: 'sans-serif', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
  { value: 'display', label: 'Display' },
  { value: 'monospace', label: 'Mono' },
  { value: 'handwriting', label: 'Script' },
] as const;

/** Long enough that a search is a search, short enough not to feel laggy. */
const DEBOUNCE_MS = 200;

/**
 * Browse the open catalogue — 2,096 families, searched on the server.
 *
 * The room used to offer four hardcoded pairings. The catalogue behind this is
 * ~385KB, which is more than the whole page, so it is never shipped: this
 * component asks `/api/fonts` and renders what it gets back, stylesheet URL and
 * licence included. That keeps the browser's job to "show me these twenty" no
 * matter how large the catalogue grows.
 *
 * Every result is set in the face it names — a list of font names all in one
 * typeface is a list, not a specimen — but the whole page costs ONE stylesheet
 * request at the regular cut, not one per family.
 */
export function CataloguePicker({ role, chosen, onPick, onClear, onClose }: CataloguePickerProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(role === 'mono' ? 'monospace' : '');
  const [variableOnly, setVariableOnly] = useState(false);
  const [fonts, setFonts] = useState<readonly CatalogueFont[]>([]);
  /** One stylesheet for the whole result set — see the note on the <link>. */
  const [stylesheet, setStylesheet] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setFailed(false);
      const params = new URLSearchParams({ limit: '40' });
      if (query.trim() !== '') params.set('q', query.trim());
      if (category !== '') params.set('category', category);
      if (variableOnly) params.set('variable', '1');
      try {
        const response = await fetch(`/api/fonts?${params.toString()}`, { signal });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as {
          families: readonly CatalogueFont[];
          stylesheet: string | null;
          catalogue: { size: number };
        };
        setFonts(body.families);
        setStylesheet(body.stylesheet);
        setTotal(body.catalogue.size);
      } catch (error: unknown) {
        // An aborted request is the NEXT keystroke arriving, not a failure.
        if ((error as { name?: string }).name === 'AbortError') return;
        setFailed(true);
        setFonts([]);
        setStylesheet(null);
      } finally {
        setLoading(false);
      }
    },
    [query, category, variableOnly]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  return (
    <section className={styles.picker} aria-label={`Choose a ${role} typeface`}>
      {/*
        ONE stylesheet for every family below, at the regular cut. Loading each
        result's own face meant forty requests per keystroke — a search box that
        attacks its own font host. The URL is built server-side from the
        committed catalogue, so nothing here is user-controlled.
      */}
      {stylesheet !== null && <link rel="stylesheet" href={stylesheet} />}
      <header className={styles.pickerHead}>
        <div className={styles.pickerTitleRow}>
          <h2 className={styles.pickerTitle}>
            {role} typeface
            {total !== null && <span className={styles.pickerCount}>{total} families</span>}
          </h2>
          <div className={styles.pickerHeadActions}>
            {chosen !== undefined && (
              <button type="button" className={styles.pill} onClick={onClear}>
                Reset to preset
              </button>
            )}
            <button type="button" className={styles.pill} onClick={onClose}>
              Done
            </button>
          </div>
        </div>

        <div className={styles.pickerControls}>
          <input
            ref={searchRef}
            type="search"
            className={styles.pickerSearch}
            placeholder="Search families"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search font families"
          />
          <div className={styles.pillRow} role="group" aria-label="Category">
            {CATEGORIES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className={
                  category === entry.value ? `${styles.pill} ${styles.pillActive}` : styles.pill
                }
                aria-pressed={category === entry.value}
                onClick={() => setCategory(entry.value)}
              >
                {entry.label}
              </button>
            ))}
            <button
              type="button"
              className={variableOnly ? `${styles.pill} ${styles.pillActive}` : styles.pill}
              aria-pressed={variableOnly}
              onClick={() => setVariableOnly((prev) => !prev)}
              title="Families carrying their weights on a continuous axis"
            >
              Variable
            </button>
          </div>
        </div>
      </header>

      {failed && (
        <p className={styles.pickerNote} role="status">
          The catalogue did not answer. It is served from this site, so a retry usually works —
          the four presets above keep working either way.
        </p>
      )}

      {!failed && !loading && fonts.length === 0 && (
        <p className={styles.pickerNote} role="status">
          Nothing matches “{query}”. Try a shorter search, or clear the category.
        </p>
      )}

      <ul className={styles.pickerList} aria-busy={loading}>
        {fonts.map((font) => (
          <li key={font.id}>
            <button
              type="button"
              className={
                font.id === chosen ? `${styles.pickerItem} ${styles.pickerItemOn}` : styles.pickerItem
              }
              aria-pressed={font.id === chosen}
              onClick={() => onPick(font)}
            >
              <span
                className={styles.pickerSpecimen}
                style={{ fontFamily: font.stack ?? 'inherit' }}
              >
                {font.family}
              </span>
              <span className={styles.pickerMeta}>
                {font.category}
                {' · '}
                {font.variable
                  ? `${font.weights[0]}–${font.weights[font.weights.length - 1]} axis`
                  : `${font.weights.length} weight${font.weights.length === 1 ? '' : 's'}`}
                {font.licence !== null && ` · ${font.licence.id}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
