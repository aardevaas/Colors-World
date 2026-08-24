'use client';

import { useState } from 'react';
import {
  paletteFilename,
  toPaletteExport,
  type ExportableColor,
  type PaletteExportFormat,
} from '@/lib/exporters/palette';
import styles from './palette-composer.module.css';

interface PaletteExportProps {
  readonly palette: readonly ExportableColor[];
}

const FORMATS: readonly { readonly value: PaletteExportFormat; readonly label: string }[] = [
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'All notations' },
  { value: 'text', label: 'Hex list' },
];

const COPIED_FEEDBACK_MS = 1500;

/** Matches the export vault in /scales; a palette needs less, not different. */
const MIME: Readonly<Record<PaletteExportFormat, string>> = {
  css: 'text/css;charset=utf-8',
  json: 'application/json;charset=utf-8',
  text: 'text/plain;charset=utf-8',
};

/**
 * A way out of Compose that is not "Apply to System".
 *
 * The room could generate a palette and audit it and then offered exactly one
 * exit, which made it a waypoint rather than a destination. Someone who wanted
 * a palette and nothing else had to carry it forward into two more rooms to get
 * it out — or read the hexes off the screen.
 *
 * "All notations" is the one worth understanding: it writes each colour in hex,
 * RGB, HSL, OKLCH and CMYK, because that is what a brand guideline states
 * against a swatch and it is the conversion people otherwise do by hand and get
 * slightly wrong.
 */
export function PaletteExport({ palette }: PaletteExportProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<PaletteExportFormat>('css');
  const [copied, setCopied] = useState(false);

  if (palette.length === 0) return null;

  const code = toPaletteExport(palette, format);

  function handleDownload() {
    const blob = new Blob([code], { type: MIME[format] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = paletteFilename(format);
    link.click();
    // Revoking immediately can cancel the download in some browsers; a frame
    // is enough for the click to have been handled.
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard denied or unavailable — the button simply does not confirm,
      // rather than claiming a copy that did not happen.
    }
  }

  return (
    <div className={styles.exportBlock} data-open={open}>
      <button
        type="button"
        className={styles.exportToggle}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {open ? 'Close export' : 'Export palette'}
      </button>

      {open && (
        <div className={styles.exportBody}>
          <div className={styles.exportTabs} role="tablist" aria-label="Export format">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                className={styles.exportTab}
                data-active={format === f.value}
                aria-selected={format === f.value}
                onClick={() => setFormat(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <pre className={styles.exportCode} tabIndex={0} aria-label={`${format} export`}>
            {code}
          </pre>

          <div className={styles.exportActions}>
            <button type="button" className={styles.exportAction} onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className={styles.exportAction} onClick={handleDownload}>
              Download {paletteFilename(format)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
