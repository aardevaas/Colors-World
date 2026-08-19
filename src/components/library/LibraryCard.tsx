'use client';

import { useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import type { GeneratedSwatch } from '@/lib/spectrum/generate-color';
import { FAMILY_STEPS, familyStepSwatch, type FamilyAxis } from '@/lib/spectrum/swatch-family';
import { useSystem } from '@/lib/system/system-context';
import { setSwatchDragPayload } from '@/lib/system/drag-payload';
import { pinColorAction } from '@/app/actions';
import type { ColorRecord } from '@/lib/supabase/colors';
import styles from './library.module.css';

interface LibraryCardProps {
  readonly swatch: GeneratedSwatch;
  readonly semanticMatch: ColorRecord | null;
  readonly onOpenDrawer: (swatch: GeneratedSwatch, semanticMatch: ColorRecord | null) => void;
}

/** Destinations for the cross-tab teleport overlay (spec §7). Only Studio
 *  exists as a real route today — the other three are honestly disabled
 *  rather than linking somewhere that 404s. */
interface TeleportTarget {
  readonly label: string;
  readonly href: string | null;
  readonly disabledReason?: string;
}

const TELEPORT_TARGETS: readonly TeleportTarget[] = [
  { label: 'Send to Scale Lab', href: null, disabledReason: 'Scale Lab (/builder) is not built yet' },
  { label: 'Pin to Canvas', href: '/studio' },
  { label: 'Test on UI', href: null, disabledReason: '/visualizer is not built yet' },
  { label: 'Typography', href: null, disabledReason: '/typography is not built yet' },
];

export function LibraryCard({ swatch, semanticMatch, onOpenDrawer }: LibraryCardProps) {
  const { addColor } = useSystem();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [previewAxis, setPreviewAxis] = useState<FamilyAxis>('lightness');
  const [previewStep, setPreviewStep] = useState<number | null>(null);
  const [teleportOpen, setTeleportOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const displayed =
    previewStep === null ? swatch : familyStepSwatch(swatch.index, previewAxis, previewStep);

  function handlePointerMove(event: MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    // CSS-only shimmer: a radial highlight positioned via custom properties
    // the stylesheet reads, not a per-card WebGL context — browsers cap
    // simultaneous WebGL contexts at roughly 8–16 per page, far below what a
    // virtualized grid renders at once (see discovery-feed.ts's module intro
    // for the sibling constraint this mirrors on the height axis).
    el.style.setProperty('--shimmer-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--shimmer-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    setTeleportOpen(true);
  }

  function handleDock() {
    addColor(displayed.hex, displayed.oklch);
  }

  async function handlePinToStudio() {
    setTeleportOpen(false);
    setPinned(true);
    setPinError(null);
    try {
      await pinColorAction(displayed.hex);
    } catch (error) {
      setPinError(error instanceof Error ? error.message : String(error));
    } finally {
      window.setTimeout(() => setPinned(false), 1600);
    }
  }

  return (
    <div
      ref={cardRef}
      className={styles.card}
      style={{ ['--card-color' as string]: displayed.hex }}
      onMouseMove={handlePointerMove}
      onContextMenu={handleContextMenu}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDrawer(displayed, semanticMatch)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDrawer(displayed, semanticMatch);
        }
        if (event.key === 'Escape') setTeleportOpen(false);
      }}
      draggable
      onDragStart={(event) =>
        setSwatchDragPayload(event, { hex: displayed.hex, oklch: displayed.oklch })
      }
      aria-label={
        semanticMatch ? `${semanticMatch.name}, ${displayed.hex}` : `Generated colour ${displayed.hex}`
      }
    >
      <div className={styles.cardSwatchLarge} style={{ background: displayed.hex }}>
        <div className={styles.shimmer} aria-hidden="true" />
        {semanticMatch !== null && (
          <span className={styles.semanticBadge} title="Matched to a curated Color-Pedia entry">
            {semanticMatch.name}
          </span>
        )}
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.cardHex}>{displayed.hex.toUpperCase()}</span>

        <div className={styles.familyStepper} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={styles.familyAxisToggle}
            onClick={() => setPreviewAxis((axis) => (axis === 'lightness' ? 'chroma' : 'lightness'))}
            title="Switch the stepper between lightness and chroma"
            aria-label={`Currently stepping through ${previewAxis}. Click to switch axis.`}
          >
            {previewAxis === 'lightness' ? 'L' : 'C'}
          </button>
          <div className={styles.familyTicks} role="group" aria-label={`${previewAxis} steps`}>
            {Array.from({ length: FAMILY_STEPS }, (_, i) => i + 1).map((step) => (
              <button
                key={step}
                type="button"
                className={styles.familyTick}
                data-active={previewStep === step}
                onClick={() => setPreviewStep((current) => (current === step ? null : step))}
                aria-label={`${previewAxis} step ${step} of ${FAMILY_STEPS}`}
                aria-pressed={previewStep === step}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.hoverActions} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.hoverActionButton}
          onClick={handleDock}
          aria-label={`Add ${displayed.hex} to dock`}
          title="Add to Harmonic Dock"
        >
          + Dock
        </button>
        <button
          type="button"
          className={styles.hoverActionButton}
          onClick={handlePinToStudio}
          disabled={pinned}
          aria-label={`Pin ${displayed.hex} to Studio canvas`}
          title={pinError ?? 'Pin to Canvas (/studio)'}
          data-error={pinError !== null}
        >
          {pinError !== null ? 'Pin failed' : pinned ? 'Pinned ✓' : 'Pin'}
        </button>
        <button
          type="button"
          className={styles.hoverActionButton}
          onClick={() => setTeleportOpen(true)}
          aria-label="Open teleport menu"
          title="Send this colour elsewhere"
        >
          ⋯
        </button>
      </div>

      {teleportOpen && (
        <div
          className={styles.teleportOverlay}
          onClick={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Teleport this colour"
        >
          {TELEPORT_TARGETS.map((target) =>
            target.href === null ? (
              <span
                key={target.label}
                className={styles.teleportOption}
                data-disabled="true"
                title={target.disabledReason}
              >
                {target.label}
              </span>
            ) : (
              <Link
                key={target.label}
                href={target.href}
                className={styles.teleportOption}
                onClick={handlePinToStudio}
              >
                {target.label}
              </Link>
            )
          )}
          <button
            type="button"
            className={styles.teleportClose}
            onClick={() => setTeleportOpen(false)}
            aria-label="Close teleport menu"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
