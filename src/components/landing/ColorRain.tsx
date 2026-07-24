'use client';

import { useEffect, useRef, useState } from 'react';
import { setupColorRainPhysics } from '@/lib/landing/setup-color-rain-physics';
import styles from './color-rain.module.css';

interface ColorRainProps {
  readonly swatchHexes: readonly string[];
}

export function ColorRain({ swatchHexes }: ColorRainProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (section === null || canvas === null) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    import('matter-js').then(({ default: matter }) => {
      if (cancelled) return;
      cleanup = setupColorRainPhysics(matter, section, canvas, swatchHexes);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion, swatchHexes]);

  return (
    <section ref={sectionRef} className={styles.rainSection}>
      <div className={styles.rainSticky}>
        {reducedMotion ? (
          <div className={styles.staticFallback} aria-hidden="true">
            {swatchHexes.map((hex, position) => (
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
