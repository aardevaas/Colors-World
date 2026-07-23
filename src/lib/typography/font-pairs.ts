export interface FontPair {
  readonly id: string;
  readonly label: string;
  readonly headingFamily: string;
  readonly headingWeight: number;
  readonly bodyFamily: string;
  readonly bodyWeight: number;
}

/**
 * A curated shortlist rather than an open Google Fonts search — pairing
 * fonts well is a taste problem, and ten deliberate combinations beat a
 * search box that lets you build something discordant just as easily as
 * something good. Each is a real, common editorial pairing pattern (serif
 * display + humanist sans, geometric + humanist, etc.).
 */
export const FONT_PAIRS: readonly FontPair[] = [
  {
    id: 'playfair-source-sans',
    label: 'Playfair Display / Source Sans 3',
    headingFamily: 'Playfair Display',
    headingWeight: 700,
    bodyFamily: 'Source Sans 3',
    bodyWeight: 400,
  },
  {
    id: 'space-grotesk-inter',
    label: 'Space Grotesk / Inter',
    headingFamily: 'Space Grotesk',
    headingWeight: 600,
    bodyFamily: 'Inter',
    bodyWeight: 400,
  },
  {
    id: 'fraunces-work-sans',
    label: 'Fraunces / Work Sans',
    headingFamily: 'Fraunces',
    headingWeight: 600,
    bodyFamily: 'Work Sans',
    bodyWeight: 400,
  },
  {
    id: 'archivo-black-archivo',
    label: 'Archivo Black / Archivo',
    headingFamily: 'Archivo Black',
    headingWeight: 400,
    bodyFamily: 'Archivo',
    bodyWeight: 400,
  },
  {
    id: 'libre-caslon-karla',
    label: 'Libre Caslon Text / Karla',
    headingFamily: 'Libre Caslon Text',
    headingWeight: 700,
    bodyFamily: 'Karla',
    bodyWeight: 400,
  },
  {
    id: 'unbounded-manrope',
    label: 'Unbounded / Manrope',
    headingFamily: 'Unbounded',
    headingWeight: 600,
    bodyFamily: 'Manrope',
    bodyWeight: 400,
  },
  {
    id: 'dm-serif-dm-sans',
    label: 'DM Serif Display / DM Sans',
    headingFamily: 'DM Serif Display',
    headingWeight: 400,
    bodyFamily: 'DM Sans',
    bodyWeight: 400,
  },
  {
    id: 'bebas-neue-nunito-sans',
    label: 'Bebas Neue / Nunito Sans',
    headingFamily: 'Bebas Neue',
    headingWeight: 400,
    bodyFamily: 'Nunito Sans',
    bodyWeight: 400,
  },
];

export const DEFAULT_FONT_PAIR_ID: string = FONT_PAIRS[0]!.id;

export function findFontPair(id: string): FontPair {
  return FONT_PAIRS.find((pair) => pair.id === id) ?? FONT_PAIRS[0]!;
}

/** The Google Fonts CSS2 URL for a pair — one request covers both families. */
export function fontPairStylesheetUrl(pair: FontPair): string {
  const families = [
    `family=${encodeURIComponent(pair.headingFamily)}:wght@${pair.headingWeight}`,
    `family=${encodeURIComponent(pair.bodyFamily)}:wght@${pair.bodyWeight}`,
  ];
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}
