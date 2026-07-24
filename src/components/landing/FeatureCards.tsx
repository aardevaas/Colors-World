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
    subtitle: 'Infinite Color Discovery & Exploration',
    highlights: [
      'Replaces raw spectrum lists with a dynamic, endless discovery grid (Coolors-inspired).',
      'Search and filter all 16.7M colors by hues, shades, tones, meanings, and variations.',
      'Instant color info, variations, and accessibility breakdowns.',
    ],
    featured: true,
  },
  {
    tab: 'Palette Builder & Scale Lab',
    route: '/builder',
    subtitle: 'Algorithmic Color Scales & Export Engine',
    highlights: [
      '100% customizable palette generator and anchor-based color scale engine (Chroma, Step, and Hue Torsion controls).',
      'Real-time gamut testing (sRGB, Display P3, Rec2020) & color vision deficiency simulations (protanopia, deuteranopia, tritanopia, achromatopsia).',
      'Saved palette manager with 1-click Tailwind CSS, CSS Variables, and Figma code exports.',
    ],
  },
  {
    tab: 'Studio',
    route: '/studio',
    subtitle: 'The Infinite Spatial Design Canvas',
    highlights: [
      'Miro-like infinite spatial workspace for unlimited visual moodboarding.',
      'Drag-and-drop colors, pin custom palettes, and arrange layout elements freely.',
      'Integrated brand asset vault: upload logos, marks, and reference images directly onto your board.',
    ],
  },
  {
    tab: 'Visualizer & UI Lab',
    route: '/visualizer',
    subtitle: 'Real-Time UI Testing & Image Extraction',
    highlights: [
      'Palette visualizer: preview color palettes on real app UI components in real-time.',
      'Image color picker: extract precise hex codes and dominant palettes from uploaded images.',
      'Tailwind CSS live theme previewer & WCAG contrast accessibility checker.',
    ],
  },
  {
    tab: 'Typography Studio',
    route: '/typography',
    subtitle: 'Type Pairing & Contrast Accessibility Engine',
    highlights: [
      'Dynamic font pairing tool and typographic hierarchy visualizer.',
      'Real-time text-over-color WCAG contrast scoring and legibility testing.',
      'Dark and light mode font scaling for web and mobile UI.',
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
        <p className={styles.eyebrow}>The toolkit</p>
        <h2 className={styles.heading}>Five tools. One color system.</h2>
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
