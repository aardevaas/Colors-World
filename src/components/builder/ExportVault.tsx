'use client';

import { useState } from 'react';
import type { GeneratedScale } from '@/lib/color-engine';
import { toCssCustomProperties, toTailwindTheme, toFigmaTokens } from '@/lib/exporters/tokens';
import { toShadcnTheme } from '@/lib/exporters/shadcn';
import { systemFilename, toSystemReadme } from '@/lib/exporters/system-readme';
import { useSystem } from '@/lib/system/system-context';
import type { ExportFormat } from '@/lib/builder/builder-reducer';
import styles from './builder.module.css';

interface ExportVaultProps {
  readonly scales: readonly GeneratedScale[];
  readonly primaryIndex: number;
  readonly format: ExportFormat;
  readonly onFormatChange: (format: ExportFormat) => void;
}

const FORMATS: readonly { readonly value: ExportFormat; readonly label: string }[] = [
  { value: 'css', label: 'CSS Variables' },
  { value: 'tailwind', label: 'Tailwind v4' },
  { value: 'shadcn', label: 'shadcn/ui' },
  { value: 'figma', label: 'Figma / W3C JSON' },
  { value: 'document', label: 'System document' },
];

const COPIED_FEEDBACK_MS = 1500;

export function ExportVault({ scales, primaryIndex, format, onFormatChange }: ExportVaultProps) {
  const { system, roles, shareUrl } = useSystem();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shadcnResult = format === 'shadcn' ? toShadcnTheme(scales, { primaryIndex }) : null;

  // The document is the only format that describes the system rather than
  // restating it: which color took which role, what every required pair
  // measures, where the type stops being legible, what a narrower display
  // does to the ramps. Tokens tell the next person what the colors are; this
  // tells them why, which is the part that otherwise lives in one head.
  const code =
    scales.length === 0
      ? ''
      : format === 'css'
        ? toCssCustomProperties(scales)
        : format === 'tailwind'
          ? toTailwindTheme(scales)
          : format === 'shadcn'
            ? (shadcnResult?.css ?? '')
            : format === 'document'
              ? toSystemReadme({ system, roles, scales, shareUrl: shareUrl() })
              : toFigmaTokens(scales);

  function handleDownload() {
    const blob = new Blob([code], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = systemFilename(system);
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
      // Clipboard access denied or unavailable — button simply doesn't
      // confirm rather than falsely claiming the copy succeeded.
    }
  }

  return (
    <div className={styles.vault} data-open={open}>
      <button
        type="button"
        className={styles.vaultToggle}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        {open ? 'Close export vault' : 'Export'}
      </button>

      {open && (
        <div className={styles.vaultBody}>
          <div className={styles.vaultTabs} role="tablist" aria-label="Export format">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                className={styles.vaultTab}
                data-active={format === f.value}
                aria-selected={format === f.value}
                onClick={() => onFormatChange(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {shadcnResult !== null && shadcnResult.unfilled.length > 0 && (
            <div className={styles.vaultDisclosure} role="note">
              <p className={styles.vaultDisclosureTitle}>Not filled:</p>
              <ul>
                {shadcnResult.unfilled.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {format === 'document' && code !== '' && (
            <p className={styles.vaultDocNote}>
              Everything the other formats say, plus why: which color took which role,
              what every required pair measures, where type stops being legible, and what
              a narrower display does to the ramps.
            </p>
          )}

          <pre className={styles.vaultCode} data-tall={format === 'document'}>
            {code === '' ? '/* collect a color to generate export code */' : code}
          </pre>

          <div className={styles.vaultActions}>
            <button
              type="button"
              className={styles.vaultCopy}
              onClick={() => void handleCopy()}
              disabled={code === ''}
            >
              {copied ? 'copied' : 'copy'}
            </button>
            {/* Downloading only for the document: the token formats are meant
                to be pasted into a file that already exists, while this one is
                the file -- something to commit beside them and read in a pull
                request. */}
            {format === 'document' && (
              <button
                type="button"
                className={styles.vaultCopy}
                onClick={handleDownload}
                disabled={code === ''}
              >
                download .md
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
