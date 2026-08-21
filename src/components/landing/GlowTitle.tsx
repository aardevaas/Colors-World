'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './glow-title.module.css';

/**
 * The headline, lit letter by letter as the pointer approaches.
 *
 * Every glyph is its own element carrying a `--glow` value, so the light falls
 * off across the word rather than switching the whole line on at once — the
 * nearest letter is brightest and its neighbours catch progressively less.
 *
 * Written from a rAF loop straight into CSS custom properties. There is one
 * property write per letter per frame and no React render at all: putting this
 * through state would re-render the headline sixty times a second to change a
 * shadow.
 *
 * Letters are measured once and re-measured on resize rather than every frame —
 * `getBoundingClientRect` per glyph per frame is a layout read in a loop, which
 * is the classic way to make a smooth effect janky.
 */

interface GlowTitleProps {
  /** Plain text is split per letter. Elements are rendered as-is, so an accent
   *  span can still be styled differently. */
  readonly children: ReactNode;
  readonly className?: string;
}

/** Pixels beyond which a letter is unlit. */
const REACH = 260;
/** Baseline glow with the pointer nowhere near, so the title always shimmers. */
const RESTING = 0.16;

export function GlowTitle({ children, className }: GlowTitleProps) {
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const letters = [...root.querySelectorAll<HTMLElement>('[data-glyph]')];
    if (letters.length === 0) return;

    let centres: { x: number; y: number }[] = [];
    const measure = () => {
      centres = letters.map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    };
    measure();

    const pointer = { x: -9999, y: -9999 };
    const handleMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('resize', measure);
    const onScroll = () => measure();
    window.addEventListener('scroll', onScroll, { passive: true });

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      for (let i = 0; i < letters.length; i += 1) {
        const c = centres[i];
        if (c === undefined) continue;
        const distance = Math.hypot(pointer.x - c.x, pointer.y - c.y);
        // Squared falloff: linear spreads the light too evenly and the whole
        // line lifts together instead of one letter leading.
        const near = Math.max(0, 1 - distance / REACH);
        const glow = RESTING + (1 - RESTING) * near * near;
        letters[i]!.style.setProperty('--glow', glow.toFixed(3));
      }
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <span ref={rootRef} className={className}>
      {splitGlyphs(children)}
    </span>
  );
}

/**
 * Splits text nodes into per-glyph spans, leaving elements alone.
 *
 * Spaces stay as plain text: wrapping them would stop the line breaking at word
 * boundaries, and a headline that cannot wrap is worse than one that does not
 * glow.
 */
function splitGlyphs(node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    return node.split(/(\s+)/).map((chunk, chunkIndex) => {
      if (/^\s+$/.test(chunk)) return chunk;
      return (
        <span className={styles.word} key={`w${chunkIndex}-${chunk}`}>
          {[...chunk].map((glyph, i) => (
            <span
              className={styles.glyph}
              data-glyph=""
              key={`${chunkIndex}-${i}-${glyph}`}
            >
              {glyph}
            </span>
          ))}
        </span>
      );
    });
  }
  if (Array.isArray(node)) return node.map(splitGlyphs);
  return node;
}

export default GlowTitle;
