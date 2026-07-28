'use client';

import { useState } from 'react';
import type { GeneratedScale } from '@/lib/color-engine';
import { toCssCustomProperties, toTailwindTheme, toFigmaTokens } from '@/lib/exporters/tokens';
import { toShadcnTheme } from '@/lib/exporters/shadcn';
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
];

const COPIED_FEEDBACK_MS = 1500;

export function ExportVault({ scales, primaryIndex, format, onFormatChange }: ExportVaultProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const shadcnResult = format === 'shadcn' ? toShadcnTheme(scales, { primaryIndex }) : null;

  const code =
    scales.length === 0
      ? ''
      : format === 'css'
        ? toCssCustomProperties(scales)
        : format === 'tailwind'
          ? toTailwindTheme(scales)
          : format === 'shadcn'
            ? (shadcnResult?.css ?? '')
            : toFigmaTokens(scales);

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

          <pre className={styles.vaultCode}>
            {code === '' ? '/* collect a colour to generate export code */' : code}
          </pre>

          <button
            type="button"
            className={styles.vaultCopy}
            onClick={() => void handleCopy()}
            disabled={code === ''}
          >
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      )}
    </div>
  );
}
