import Link from 'next/link';
import styles from './feature-cards.module.css';

/**
 * Phase 5 — the five flagship tabs, per the locked brief (§8). A plain
 * Server Component: no interactivity here beyond ordinary links, so it adds
 * nothing to the client bundle. Deliberately rendered as a normal-flow
 * sibling *after* the pinned globe section rather than nested inside it —
 * see landing.module.css's `.pinned` comment for why that's what lets the
 * drifting stardust keep showing through behind these cards as they scroll.
 *
 * Three of the five target routes (/builder, /visualizer, /typography)
 * don't exist yet — that's a separate, already-tracked app-side route
 * migration (brief §8), not something this component works around. Those
 * cards will 404 until that migration lands.
 */

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

function FeatureCardPanel({ card }: { card: FeatureCard }) {
  return (
    <Link
      href={card.route}
      className={card.featured ? `${styles.card} ${styles.cardFeatured}` : styles.card}
    >
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
    </Link>
  );
}

export function FeatureCards() {
  const [library, ...rest] = FEATURE_CARDS;

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
        {library !== undefined && <FeatureCardPanel card={library} />}
        {rest.map((card) => (
          <FeatureCardPanel key={card.route} card={card} />
        ))}
      </div>
    </section>
  );
}
