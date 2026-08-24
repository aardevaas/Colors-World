'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { GeneratedSwatch } from '@/lib/spectrum/generate-color';
import { FAMILY_STEPS, familyStepSwatch, type FamilyAxis } from '@/lib/spectrum/swatch-family';
import type { TabId } from '@/lib/nav/tabs';
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

/**
 * Where a colour can be sent, and how it gets there.
 *
 * Three of these were disabled with "not built yet" against rooms that have
 * been built and sitting in the navigation for some time — the list was written
 * before they shipped and never revisited. So the one place in the product
 * where you say "take this colour over there" answered "no" to most of the
 * building, while the room in question was one line up on the screen.
 *
 * Ordered to match the nav, because that is the order the visitor has already
 * learned the building in.
 *
 * `via` is the part that matters: a destination is not a link, it is a HANDOVER,
 * and the two kinds of room receive a colour differently. Most read the
 * Harmonic Dock, so the colour is docked and travels with you. The studio wall
 * keeps real records, so it is written first and the move waits for it to land.
 */
interface TeleportTarget {
  readonly room: TabId;
  readonly label: string;
  readonly href: string;
  readonly via: 'dock' | 'wall';
}

const TELEPORT_TARGETS: readonly TeleportTarget[] = [
  { room: 'compose', label: 'Build a system from it', href: '/compose', via: 'dock' },
  { room: 'scales', label: 'Deepen it into a ramp', href: '/scales', via: 'dock' },
  { room: 'visualizer', label: 'Try it on real UI', href: '/visualizer', via: 'dock' },
  { room: 'typography', label: 'Set type against it', href: '/typography', via: 'dock' },
];

export function LibraryCard({ swatch, semanticMatch, onOpenDrawer }: LibraryCardProps) {
  const { addColor } = useSystem();
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [previewAxis, setPreviewAxis] = useState<FamilyAxis>('lightness');
  const [previewStep, setPreviewStep] = useState<number | null>(null);
  /*
   * The colours the stepper actually steps through.
   *
   * They were drawn as ten identical grey dashes, which is a control that looks
   * like a loading skeleton — nobody presses a placeholder, so the whole family
   * feature sat there unfound. Painting each tick with the colour it leads to
   * turns the row into a small readable ramp of this very swatch, which on a
   * page about colour is the obvious thing for it to be.
   */
  const ramp = useMemo(
    () =>
      Array.from({ length: FAMILY_STEPS }, (_, i) =>
        familyStepSwatch(swatch.index, previewAxis, i + 1).hex
      ),
    [swatch.index, previewAxis]
  );

  /** Arrow keys move along the ramp; Home and End jump to its ends. */
  const handleTickKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const current = previewStep ?? 1;
    let next: number | null = null;
    if (event.key in moves) next = current + (moves[event.key] ?? 0);
    else if (event.key === 'Home') next = 1;
    else if (event.key === 'End') next = FAMILY_STEPS;
    if (next === null) return;
    event.preventDefault();
    const clamped = Math.max(1, Math.min(FAMILY_STEPS, next));
    setPreviewStep(clamped);
    const group = event.currentTarget;
    (group.children[clamped - 1] as HTMLElement | undefined)?.focus();
  };

  const [teleportOpen, setTeleportOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  /*
   * The move happens a frame after the handover, and that is deliberate.
   *
   * The System writes itself into the address bar — that is how a palette
   * travels by link. Docking a colour therefore schedules a `replaceState` for
   * the CURRENT path, and pushing a route in the same interaction loses: the
   * navigation is still in flight when that effect runs, so the URL is rewritten
   * back to `/library?c=…` and the visitor never leaves the room. It looked for
   * all the world like a dead button, while the colour it sent had in fact
   * arrived.
   *
   * A frame is long enough for the System's own effect to have written, and
   * short enough that nobody sees it.
   */
  useEffect(() => {
    if (pendingHref === null) return;
    const frame = requestAnimationFrame(() => {
      setPendingHref(null);
      router.push(pendingHref);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingHref, router]);
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

  /**
   * Hand this colour to another room, then go there.
   *
   * The order is the whole point. Docking is synchronous, so the colour is
   * already waiting by the time the next room mounts. The wall is a server
   * record, so the navigation waits for it — a `Link` fired the write and left
   * at the same moment, which is a race the colour can lose.
   */
  async function handleTeleport(target: TeleportTarget) {
    setTeleportOpen(false);
    if (target.via === 'dock') {
      addColor(displayed.hex, displayed.oklch);
      setPendingHref(target.href);
      return;
    }
    setPinned(true);
    setPinError(null);
    try {
      await pinColorAction(displayed.hex);
      setPendingHref(target.href);
    } catch (error) {
      setPinError(error instanceof Error ? error.message : String(error));
    } finally {
      window.setTimeout(() => setPinned(false), 1600);
    }
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
        semanticMatch ? `${semanticMatch.name}, ${displayed.hex}` : `Generated color ${displayed.hex}`
      }
    >
      <div className={styles.cardSwatchLarge} style={{ background: displayed.hex }}>
        <div className={styles.shimmer} aria-hidden="true" />
        {semanticMatch !== null && (
          <span className={styles.semanticBadge} title="Matched to a curated Color-Pedia entry">
            {semanticMatch.name}
          </span>
        )}

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
            title="Send this color elsewhere"
          >
            ⋯
          </button>
        </div>
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
          {/*
            One tab stop for the whole ramp, not ten.
            Every tick was separately focusable, and with ten of them on each of
            forty-odd cards the library came to six hundred stops — a keyboard
            user reaching the second row of colours after a hundred presses of
            Tab. This is the roving-tabindex pattern: the group is one stop and
            the arrow keys move within it, which is how a set of related
            controls is meant to behave anyway.
          */}
          <div
            className={styles.familyTicks}
            role="group"
            aria-label={`${previewAxis} steps`}
            onKeyDown={handleTickKeys}
          >
            {Array.from({ length: FAMILY_STEPS }, (_, i) => i + 1).map((step) => (
              <button
                key={step}
                type="button"
                className={styles.familyTick}
                data-active={previewStep === step}
                // The focused tick, or the first one when none is chosen yet.
                tabIndex={step === (previewStep ?? 1) ? 0 : -1}
                style={{ '--tick-color': ramp[step - 1] } as React.CSSProperties}
                onClick={() => setPreviewStep((current) => (current === step ? null : step))}
                aria-label={`${previewAxis} step ${step} of ${FAMILY_STEPS}, ${ramp[step - 1]}`}
                aria-pressed={previewStep === step}
              />
            ))}
          </div>
        </div>
      </div>


      {teleportOpen && (
        <div
          className={styles.teleportOverlay}
          onClick={(e) => e.stopPropagation()}
          role="menu"
          aria-label="Teleport this color"
        >
          {/*
            Buttons, not links.

            Each of these HANDS THE COLOUR OVER and then moves — a side effect,
            which is what a button is for. As links they also fired the write and
            navigated in the same instant, so the colour could arrive after the
            room that was meant to receive it.
          */}
          {TELEPORT_TARGETS.map((target) => (
            <button
              key={target.room}
              type="button"
              role="menuitem"
              className={styles.teleportOption}
              onClick={() => handleTeleport(target)}
            >
              {target.label}
              {/* The room's own name, so the option maps to the tab above it. */}
              <span className={styles.teleportRoom}>{target.room}</span>
            </button>
          ))}
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
