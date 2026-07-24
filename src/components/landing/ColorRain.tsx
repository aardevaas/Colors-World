'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildRainBlockSeeds } from '@/lib/landing/color-rain-variants';
import { setupColorRain } from '@/lib/landing/setup-color-rain';
import styles from './color-rain.module.css';

interface ColorRainProps {
  readonly marqueeHueSteps: readonly number[];
}

export function ColorRain({ marqueeHueSteps }: ColorRainProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  // Reduced motion skips the simulation entirely — a plain static grid
  // still shows every hue's shade family, just without the fall/assembly.
  const fallbackHexes = useMemo(
    () => (reducedMotion ? buildRainBlockSeeds(marqueeHueSteps).map((seed) => seed.swatch.hex) : []),
    [reducedMotion, marqueeHueSteps]
  );

  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (section === null || canvas === null) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    import('matter-js').then(({ default: matter }) => {
      if (cancelled) return;
      cleanup = setupColorRain(matter, section, canvas, marqueeHueSteps);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion, marqueeHueSteps]);

  return (
    <section ref={sectionRef} className={styles.rainSection}>
      <div className={styles.rainSticky}>
        {reducedMotion ? (
          <div className={styles.staticFallback} aria-hidden="true">
            {fallbackHexes.map((hex, position) => (
              <span
                key={`${hex}-${position}`}
                className={styles.staticBlock}
                style={{ background: hex }}
              />
            ))}
          </div>
        ) : (
          <canvas ref={canvasRef} className={styles.rainCanvas} aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
