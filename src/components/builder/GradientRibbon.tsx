'use client';

import { useRef, useState, type MouseEvent } from 'react';
import type { GeneratedScale } from '@/lib/color-engine';
import { useDock } from '@/lib/dock/dock-context';
import styles from './builder.module.css';

interface GradientRibbonProps {
  readonly scale: GeneratedScale;
}

/**
 * A continuous OKLCH gradient built from the scale's own generated stops —
 * `linear-gradient(in oklch to right, …)` interpolates *in* OKLCH space
 * between them (not sRGB), so scrubbing between two steps samples genuine
 * intermediate OKLCH shades rather than an RGB-lerp that would drift hue.
 */
export function GradientRibbon({ scale }: GradientRibbonProps) {
  const { addToDock } = useDock();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hoverFraction, setHoverFraction] = useState<number | null>(null);

  const gradientCss = `linear-gradient(in oklch to right, ${scale.steps
    .map((step) => step.css)
    .join(', ')})`;

  function fractionFromClientX(clientX: number): number {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  function stepAtFraction(fraction: number): GeneratedScale['steps'][number] {
    const index = Math.round(fraction * (scale.steps.length - 1));
    return scale.steps[index]!;
  }

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    setHoverFraction(fractionFromClientX(event.clientX));
  }

  function handleSample(fraction: number) {
    const step = stepAtFraction(fraction);
    addToDock(step.hex, step.oklch);
  }

  const hoverStep = hoverFraction !== null ? stepAtFraction(hoverFraction) : null;

  return (
    <div className={styles.ribbonWrap}>
      <div
        ref={trackRef}
        className={styles.ribbonTrack}
        style={{ background: gradientCss }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverFraction(null)}
        onClick={(event) => handleSample(fractionFromClientX(event.clientX))}
        role="slider"
        tabIndex={0}
        aria-label={`Sample a micro-shade from ${scale.name} into the Harmonic Dock`}
        aria-valuemin={0}
        aria-valuemax={scale.steps.length - 1}
        aria-valuenow={hoverStep?.step ?? 0}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          handleSample(hoverFraction ?? 0.5);
        }}
      >
        {hoverFraction !== null && (
          <span
            className={styles.ribbonCursor}
            style={{ left: `${hoverFraction * 100}%`, background: hoverStep!.hex }}
          />
        )}
      </div>
      <p className={styles.ribbonHint}>
        {hoverStep !== null
          ? `click to add ${hoverStep.hex.toUpperCase()} to the dock`
          : 'scrub to sample a micro-shade'}
      </p>
    </div>
  );
}
