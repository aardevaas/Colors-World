'use client';

import Link from 'next/link';
import { routeBarcodeGradient } from '@/lib/landing/barcode-pattern';
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
  /** The colour picked on the globe, if any — carried into the Library
   *  card's link specifically, so choosing to enter Library still opens on
   *  the colour that was searched for rather than losing it. */
  readonly pickedColorHex?: string;
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

/** Spread deterministically per card index — purely decorative, standing in
 *  for the reference's QR code as "this tool touches the whole spectrum,"
 *  not a real data visualization. */
function SwatchStrip({ seed }: { seed: number }) {
  const swatches = Array.from({ length: 6 }, (_, i) => (60 * i + seed * 47) % 360);
  return (
    <div className={styles.swatchGrid} aria-hidden="true">
      {swatches.map((hue, i) => (
        // eslint-disable-next-line react/no-array-index-key -- fixed-length decorative strip, never reordered/inserted/removed
        <span key={i} className={styles.swatch} style={{ background: `oklch(72% 0.19 ${hue})` }} />
      ))}
    </div>
  );
}

function handlePointerMove(event: React.PointerEvent<HTMLAnchorElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 100;
  const my = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.setProperty('--mx', `${mx}%`);
  event.currentTarget.style.setProperty('--my', `${my}%`);
}

function handlePointerLeave(event: React.PointerEvent<HTMLAnchorElement>) {
  event.currentTarget.style.setProperty('--mx', '50%');
  event.currentTarget.style.setProperty('--my', '50%');
}

function FeatureCardPanel({
  card,
  href,
  index,
}: {
  card: FeatureCard;
  href: string;
  index: number;
}) {
  return (
    <Link
      href={href}
      className={card.featured ? `${styles.card} ${styles.cardFeatured}` : styles.card}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* Pointer-reactive holographic sheen — position tracked via CSS custom
          properties written directly on pointermove (not React state), same
          reasoning as the hero's scroll-driven fade: this fires far too
          often to route through a re-render. */}
      <span className={styles.foil} aria-hidden="true" />

      <div className={styles.stub} aria-hidden="true">
        <span className={styles.stubIndex}>0{index + 1}</span>
        <span className={styles.stubTab}>{card.tab}</span>
      </div>

      <div className={styles.body}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>{card.tab}</h3>
          <span className={styles.cardRoute}>{card.route}</span>
        </div>
        <p className={styles.cardSubtitle}>{card.subtitle}</p>
        <ul className={styles.cardHighlights}>
          {card.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>

        <div className={styles.ticketFooter}>
          <span
            className={styles.barcode}
            style={{ backgroundImage: routeBarcodeGradient(card.route) }}
            aria-hidden="true"
          />
          <SwatchStrip seed={index} />
        </div>
      </div>
    </Link>
  );
}

export function FeatureCards({ pickedColorHex }: FeatureCardsProps) {
  const [library, ...rest] = FEATURE_CARDS;
  const libraryHref =
    library !== undefined && pickedColorHex !== undefined
      ? `${library.route}?color=${pickedColorHex.replace('#', '')}`
      : (library?.route ?? '/library');

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

      <div className={styles.grid}>
        {library !== undefined && (
          <FeatureCardPanel card={library} href={libraryHref} index={0} />
        )}
        {rest.map((card, i) => (
          <FeatureCardPanel key={card.route} card={card} href={card.route} index={i + 1} />
        ))}
      </div>
    </section>
  );
}
