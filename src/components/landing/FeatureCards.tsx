'use client';

import { useEffect, useRef } from 'react';
import type { RoomColor } from '@/lib/landing/room-palette';
import { PaintedCard } from './PaintedCard';
import styles from './feature-cards.module.css';

/**
 * Phase 5 — the five flagship tabs, per the locked brief (§8). Rendered only
 * once the globe has actually been exploded (see LandingExperience) — never
 * unconditionally after the globe section, so it can't appear laid over an
 * intact, unexploded globe.
 *
 * Styled as holographic ticket stubs (per the "Card - Data.mp4" reference)
 * with the ticket-specific motifs reskinned to mean something for a colour
 * tool rather than carried over literally: the barcode becomes the route
 * path, the QR code becomes a mini palette swatch. No tear-to-open gesture —
 * per the brief, the whole card stays one unambiguous click-through link.
 *
 * Three of the five target routes (/builder, /visualizer, /typography)
 * don't exist yet — that's a separate, already-tracked app-side route
 * migration (brief §8), not something this component works around. Those
 * cards will 404 until that migration lands.
 */

interface FeatureCardsProps {
  /** The generated six. Each card is painted in its own room's colour, so the
   *  rain that lands on it and the panel it becomes are the same paint. */
  readonly rooms: readonly RoomColor[];
}

interface FeatureCard {
  readonly tab: string;
  readonly route: string;
  readonly subtitle: string;
  readonly highlights: readonly string[];
  readonly featured?: boolean;
}

const FEATURE_CARDS: readonly FeatureCard[] = [
  {
    tab: 'Library',
    route: '/library',
    subtitle: 'All 16.7 million, computed rather than stored',
    highlights: [
      'The whole sRGB space, generated on demand rather than pulled from a list of curated palettes.',
      'Drop in a photograph and the colours in it become a working system, not a swatch card.',
      'Search by vibe, or press space and keep drawing until something stops you.',
    ],
    featured: true,
  },
  {
    tab: 'Compose',
    route: '/compose',
    subtitle: 'One colour in, a whole system out',
    highlights: [
      'Harmonies reconciled against the gamut, so a triad comes back even in weight instead of clipped — reachable chroma varies almost threefold across the wheel, and the wheel here is drawn to show it.',
      'State the contrast you need — text on a panel, a visible panel edge — and the palette is solved to meet it rather than rolled until it happens to.',
      'Lock what you like, roll the rest.',
    ],
  },
  {
    tab: 'Scales',
    route: '/scales',
    subtitle: 'Every colour, deepened into a ramp',
    highlights: [
      'Lightness, chroma and hue-torsion curves you drag, with sRGB, Display P3 and Rec2020 marked on every single step.',
      'The same ramp shown as three displays actually render it, so you can see what a cheaper monitor does to work made on a good one.',
      'Exports to CSS variables, Tailwind and shadcn themes.',
    ],
  },
  {
    tab: 'Visualizer',
    route: '/visualizer',
    subtitle: 'Proof, on interfaces rather than swatches',
    highlights: [
      'Real dashboards, product cards and mobile screens wearing your system, audited live.',
      'Every role pair checked against the standard that actually applies to it — including text on a button, which is where palettes usually fail quietly.',
      'Four kinds of colour blindness, reported as which two of your colours just became one rather than as a filter to squint through.',
    ],
  },
  {
    tab: 'Typography',
    route: '/typography',
    subtitle: 'Because contrast is a property of type, not just colour',
    highlights: [
      'The Legibility Solver: your colour pair plotted against every size and weight, with the boundary drawn.',
      'A failing pair stops being a red number and becomes a position, with the ways out shown — larger, heavier, or a different colour.',
      'Local fonts read straight off your machine, with nothing leaving it.',
    ],
  },
  {
    tab: 'Studio',
    route: '/studio',
    subtitle: 'Where it becomes something you hand over',
    highlights: [
      'An infinite canvas for arranging the system into something a client or an engineer can read.',
      'Images, gradients, type, links and notes, snapped and arranged.',
      'Exports as a watermarked image you can send.',
    ],
  },
];

export function FeatureCards({ rooms }: FeatureCardsProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  /*
   * Both classes are applied together, at the moment a card is about to paint.
   *
   * The earlier version put every card into the unpainted state on mount and
   * waited for the observer to release it. That is one missed callback away
   * from a permanently blank card — and a blank card is a far worse outcome
   * than a card that simply appears without ceremony. Applying the hidden state
   * only when the reveal is already committed makes that impossible: no
   * callback means no hidden state, and the card renders as normal.
   */
  useEffect(() => {
    const grid = gridRef.current;
    if (grid === null) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const card = entry.target as HTMLElement;
          observer.unobserve(card);

          card.classList.add('willPaint');
          // Read back a layout value to flush the unpainted state before the
          // animating class lands; without it the browser coalesces both into
          // one style change and there is nothing to animate from.
          void card.offsetWidth;
          card.classList.add('isPainting');
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
    );

    for (const card of grid.children) observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <p className={styles.eyebrow}>The rooms</p>
        {/* Counted from the manifest rather than written down: this said
            "Five tools" for a while after a sixth room shipped. */}
        <h2 className={styles.heading}>
          {FEATURE_CARDS.length} rooms. One system running through all of them.
        </h2>
        <p className={styles.lead}>
          Everything that used to be a dozen scattered utilities, consolidated into five
          flagship tabs — all reading from the same 16.7M-colour engine.
        </p>
      </header>

      <div className={styles.grid} ref={gridRef}>
        {FEATURE_CARDS.map((card, i) => (
          <PaintedCard
            key={card.route}
            href={card.route}
            index={i}
            hex={rooms[i % Math.max(1, rooms.length)]?.hex ?? '#7c5cff'}
            room={card.tab}
            route={card.route}
            subtitle={card.subtitle}
            highlights={card.highlights}
            featured={card.featured}
          />
        ))}
      </div>
    </section>
  );
}
