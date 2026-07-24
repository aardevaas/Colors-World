import Link from 'next/link';
import styles from './feature-cards.module.css';

/**
 * Phase 5 — the five flagship tabs, per the locked brief (§8). Rendered only
 * once the globe has actually been exploded (see LandingExperience) — never
 * unconditionally after the globe section, so it can't appear laid over an
 * intact, unexploded globe.
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

function FeatureCardPanel({ card, href }: { card: FeatureCard; href: string }) {
  return (
    <Link
      href={href}
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
        {library !== undefined && <FeatureCardPanel card={library} href={libraryHref} />}
        {rest.map((card) => (
          <FeatureCardPanel key={card.route} card={card} href={card.route} />
        ))}
      </div>
    </section>
  );
}
