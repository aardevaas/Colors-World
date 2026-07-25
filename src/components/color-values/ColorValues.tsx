'use client';

import { useEffect, useRef, useState } from 'react';
import {
  auditGamutWarning,
  formatCmyk,
  formatHex,
  formatHsl,
  formatOklchCss,
  formatRgb,
  toCmyk,
  type Oklch,
} from '@/lib/color-engine';
import styles from './color-values.module.css';

interface ColorValuesProps {
  readonly oklch: Oklch;
}

/**
 * Every colour, everywhere, in every space a downstream workflow actually
 * needs — HEX for handoff, RGB for legacy CSS, OKLCH for the modern wide-gamut
 * case, CMYK for print — each one copyable with a single click. Warnings sit
 * underneath rather than blocking anything: this is quiet infrastructure, not
 * a compliance gate.
 */
export function ColorValues({ oklch }: ColorValuesProps) {
  const gamutWarning = auditGamutWarning(oklch, 'srgb');
  const printWarning = auditGamutWarning(oklch, 'print');

  return (
    <div className={styles.values}>
      <CopyRow label="hex" value={formatHex(oklch).toUpperCase()} />
      <CopyRow label="rgb" value={formatRgb(oklch)} />
      <CopyRow label="oklch" value={formatOklchCss(oklch)} />
      <CopyRow label="hsl" value={formatHsl(oklch)} />
      <CopyRow label="cmyk" value={formatCmyk(toCmyk(oklch))} />

      {gamutWarning.clamped && (
        <p className={styles.warning}>
          ⚠ out of gamut — hex moved ΔE {gamutWarning.deltaEOk.toFixed(3)}
        </p>
      )}
      {printWarning.clamped && (
        <p className={styles.warning}>
          ⚠ dulls in print — {formatCmyk(toCmyk(printWarning.mapped))}
        </p>
      )}
    </div>
  );
}

interface CopyRowProps {
  readonly label: string;
  readonly value: string;
}

const COPIED_FEEDBACK_MS = 1500;

function CopyRow({ label, value }: CopyRowProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard access denied or unavailable — the row simply stays in its
      // default state rather than falsely claiming the copy succeeded.
    }
  }

  return (
    <button
      type="button"
      className={styles.row}
      onClick={() => void handleCopy()}
      aria-label={`Copy ${label} value ${value}`}
    >
      <span className={styles.rowHead}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowStatus}>{copied ? 'copied' : 'copy'}</span>
      </span>
      <span className={styles.rowValue}>{value}</span>
    </button>
  );
}
