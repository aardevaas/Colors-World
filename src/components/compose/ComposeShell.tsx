'use client';

import type { ReactNode } from 'react';
import { TabNav } from '@/components/nav/TabNav';
import { SystemLink } from '@/components/system/SystemLink';
import { useSystem } from '@/lib/system/system-context';
import { PaletteComposer } from './PaletteComposer';
import styles from './compose-shell.module.css';

/**
 * The Compose room.
 *
 * Split out of the Builder because the two are different altitudes of work
 * rather than two halves of one task: Compose operates on the palette as a
 * *set* — the relationships between colors — and the Builder operates on one
 * color at a time, deepening it into a ramp. Exploring and refining are also
 * different modes, and putting a roll button next to a curve handle asks a
 * person to be in both at once.
 *
 * The hand-off at the bottom points at the Visualizer rather than at Scales,
 * which is the honest sequence: what you want immediately after rolling a
 * palette is to see it carry an interface, not to start dragging curves. Curve
 * work comes later, once the palette has stopped moving.
 */

interface ComposeShellProps {
  readonly accountSlot?: ReactNode;
}

export function ComposeShell({ accountSlot }: ComposeShellProps) {
  const { system } = useSystem();
  const hasPalette = system.palette.length > 0;

  return (
    <div className={styles.shell}>
      <TabNav current="compose">{accountSlot}</TabNav>

      <header className={styles.intro}>
        <h2 className={styles.title}>Start from one color, get a whole system.</h2>
        <p className={styles.lede}>
          A harmony is three vivid mid-tones — lovely as a swatch strip, unusable as an
          interface. What comes out of here is a ground to sit on, a panel above it, text
          that reads on both, and a brand color with an accent.
        </p>
      </header>

      <PaletteComposer />

      <footer className={styles.handoff}>
        {hasPalette ? (
          <>
            <p className={styles.handoffCopy}>
              Applied. The palette is in your System now, so every other room already has
              it — including this link.
            </p>
            <div className={styles.handoffLinks}>
              <SystemLink href="/visualizer" className={styles.primaryHandoff}>
                See it carry an interface
              </SystemLink>
              <SystemLink href="/scales" className={styles.secondaryHandoff}>
                Deepen each color into a scale
              </SystemLink>
              <SystemLink href="/typography" className={styles.secondaryHandoff}>
                Set type in it
              </SystemLink>
            </div>
          </>
        ) : (
          <p className={styles.handoffCopy}>
            Nothing applied yet. Roll a palette above, or start from a color you already
            like in{' '}
            <SystemLink href="/library" className={styles.inlineLink}>
              Library
            </SystemLink>
            .
          </p>
        )}
      </footer>
    </div>
  );
}
