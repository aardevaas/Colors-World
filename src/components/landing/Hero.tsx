'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import type { GeneratedSwatch } from '@/lib/spectrum/generate-color';
import styles from './hero.module.css';

interface HeroProps {
  readonly marqueeSwatches: readonly GeneratedSwatch[];
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Hero({ marqueeSwatches }: HeroProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  // Cursor-reactive blob field — only ever touches `--mx`/`--my` custom
  // properties, which the blobs read inside a `transform`, so this never
  // triggers layout or paint, only compositing.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const field = fieldRef.current;
    if (field === null) return;

    let frame = 0;
    function handlePointerMove(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        field?.style.setProperty('--mx', String(event.clientX / window.innerWidth - 0.5));
        field?.style.setProperty('--my', String(event.clientY / window.innerHeight - 0.5));
      });
    }

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Magnetic CTA — nudges toward the cursor within its own bounds, snaps
  // back on leave. Transform-only, same compositing-safe reasoning.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const cta = ctaRef.current;
    if (cta === null) return;

    function handlePointerMove(event: PointerEvent) {
      if (cta === null) return;
      const rect = cta.getBoundingClientRect();
      const relX = event.clientX - (rect.left + rect.width / 2);
      const relY = event.clientY - (rect.top + rect.height / 2);
      cta.style.transform = `translate(${relX * 0.25}px, ${relY * 0.25}px)`;
    }
    function handlePointerLeave() {
      if (cta === null) return;
      cta.style.transform = 'translate(0, 0)';
    }

    cta.addEventListener('pointermove', handlePointerMove);
    cta.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      cta.removeEventListener('pointermove', handlePointerMove);
      cta.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  const loopedSwatches = [...marqueeSwatches, ...marqueeSwatches];

  return (
    <div className={styles.hero} ref={fieldRef}>
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.blobField} aria-hidden="true">
        <span className={`${styles.blob} ${styles.blobOne}`} />
        <span className={`${styles.blob} ${styles.blobTwo}`} />
        <span className={`${styles.blob} ${styles.blobThree}`} />
      </div>

      <header className={styles.nav}>
        <span className={styles.navWordmark}>Colors World</span>
        <a
          href="https://github.com/aardevaas/Colors-World"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.navLink}
        >
          GitHub
        </a>
      </header>

      <main className={styles.copy}>
        <p className={styles.eyebrow}>Open-source · Free forever</p>
        <h1 className={styles.headline}>
          Every colour.
          <br />
          All <span className={styles.gradientWord}>16.7 million</span> of them.
        </h1>
        <p className={styles.sub}>
          The free, open-source studio for colour, palettes, branding, and typography —
          built in the open, for everyone.
        </p>
        <a
          href="https://github.com/aardevaas"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.builtBy}
        >
          Built by: aardevaas
          <GitHubIcon className={styles.builtByIcon} />
        </a>
        <div className={styles.ctaRow}>
          <Link href="/studio" ref={ctaRef} className={styles.ctaPrimary}>
            Enter the Studio →
          </Link>
          <a
            href="https://github.com/aardevaas/Colors-World"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.ctaSecondary}
          >
            View on GitHub
          </a>
        </div>
      </main>

      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.marqueeTrack}>
          {loopedSwatches.map((swatch, position) => (
            <span
              key={`${swatch.index}-${position}`}
              className={styles.marqueeSwatch}
              style={{ background: swatch.hex }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
