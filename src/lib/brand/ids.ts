/**
 * Every component the brand book can contain, as a closed set of ids.
 *
 * This module exists on its own, imported by both the contract types and the
 * registry itself, so that `requires: ComponentId[]` is checked by the compiler.
 * The readiness graph is only "declared, not implied" if a typo in an edge is a
 * build failure rather than a node that silently never unlocks.
 *
 * ## Where these ids came from
 *
 * Two vocabularies had to be reconciled. `docs/BRAND-BOOK-SPEC.md` Part 5
 * describes components in prose ("Minimum sizing"); `docs/research/
 * brand-book-sample.json` records what was observed in 25 real brand books
 * using dotted ids (`logo.min-size`). The research vocabulary wins, because it
 * is the one with evidence attached — a component's provenance is a lookup
 * into the sample, and that lookup has to key on something the sample knows.
 *
 * Three corrections were made while reconciling, all of them measured:
 *
 * 1. **Part 5's table holds 66 rows, not the 65 its own footer claims**, and
 *    the state tally is Have 7 / Part 10 / New 49, not Have 9 / Part 13 /
 *    New 43. Counted programmatically, no duplicates.
 * 2. **Thirteen ids the research observed had no row in Part 5 at all** —
 *    including `gov.contact` at 8 of 25 (as common as approvals) and
 *    `gov.metrics`, which Part 12 argues at length as the Distinctive Asset
 *    Grid and is the whole governance-whitespace claim. They are placed here.
 * 3. **`gov.usage-rights` and `gov.approvals` were one row and are two ids.**
 *    The research distinguishes them (8 books each, different books), and with
 *    collaboration in scope an approval is a workflow with state, not a
 *    paragraph about who may use the mark.
 *
 * 66 + 13 + 1 = **80 components.**
 *
 * ## Revised 2026-08-24 — the grain was wrong
 *
 * The 25-book study recorded which *sections* a guideline contains, never what
 * a section *states*. `colour.palette` scored identically for a manual giving
 * one hex and one giving hex, RGB, CMYK, Pantone, tint steps, a proportion
 * rule, approved pairings and a misuse list. The product's whole value is that
 * depth, so §3 and §4 were re-cut against
 * `docs/research/INTERNAL-GUIDELINE-GRAIN.md`.
 *
 * §3 colour: 8 → **15**. §4 typography: 6 → **18**. `colour.dataviz` moved in from §6 (it is a colour
 * concern, not a web one). The other 51 components are untouched and dormant.
 *
 * ## The prefix is a namespace, not a section
 *
 * `voice.grammar` and `voice.microcopy` live in §7 Editorial, not §1, because
 * that is where the taxonomy puts them — grammar rules are a different craft
 * from a tone-of-voice matrix even though both are about words. Do not derive
 * a section from an id prefix; `SECTION_OF` is the only authority.
 */

/** The nine sections of the book, in the order they are presented. */
export const SECTIONS = {
  1: 'Brand strategy & narrative',
  2: 'Logo system & architecture',
  3: 'Colour architecture',
  4: 'Typography system',
  5: 'Imagery, graphics & motion',
  6: 'Web / UX / product design system',
  7: 'Editorial & marketing',
  8: 'Physical collateral',
  9: 'Governance & infrastructure',
} as const;

export type SectionId = keyof typeof SECTIONS;

/**
 * What each section is called IN THE PRODUCT.
 *
 * `SECTIONS` above holds the taxonomy's own names, which are precise and
 * bookish — "Imagery, graphics & motion". Nobody reading a guideline needs
 * that, and nobody needs "§5" either: the numbers do real work in the code and
 * none at all on the page. So the rail says Colour, Typography, Applications,
 * and the taxonomy keeps its own vocabulary where it belongs.
 */
export const SECTION_LABELS: Readonly<Record<SectionId, string>> = {
  1: 'Strategy',
  2: 'Logo',
  3: 'Colour',
  4: 'Typography',
  5: 'Imagery',
  6: 'Product',
  7: 'Editorial',
  8: 'Collateral',
  9: 'Governance',
};

/**
 * The complete component list. Order within a section is presentation order in
 * the book; order between sections follows `SECTIONS`.
 */
export const COMPONENT_IDS = [
  // §1 Brand strategy & narrative
  'brand.mission-vision',
  'brand.values',
  'brand.archetype',
  'brand.positioning',
  'brand.story',
  'brand.naming',
  'brand.tagline',
  'brand.boilerplate',
  'voice.tone',
  'voice.vocabulary',

  // §2 Logo system & architecture
  'logo.primary',
  'logo.variants',
  'logo.architecture',
  'logo.cobranding',
  'logo.construction',
  'logo.clear-space',
  'logo.min-size',
  'logo.placement-backgrounds',
  'logo.misuse',

  // §3 Colour architecture — revised 2026-08-24 to internal-guideline grain
  'colour.palette',
  'colour.tiers',
  'colour.values',
  'colour.print',
  'colour.tints',
  'colour.proportions',
  'colour.order',
  'colour.surfaces',
  'colour.state',
  'colour.themes',
  'colour.contrast-pairs',
  'colour.dataviz',
  'colour.gradients',
  'colour.misuse',
  'colour.exceptions',

  // §4 Typography system — revised 2026-08-24 to internal-guideline grain.
  // Ordered as a manual reads: what the faces are, where they come from, what
  // you may do with them, the scale, the ladder, per-role spacing, then the
  // rules that only bite in a specific channel.
  'type.families',
  'type.sources',
  'type.licensing',
  'type.fallbacks',
  'type.weights',
  'type.metrics',
  'type.hierarchy',
  'type.lineheight',
  'type.tracking',
  'type.measure',
  'type.paragraph-spacing',
  'type.casing',
  'type.alignment',
  'type.formatting',
  'type.minimums',
  'type.channels',
  'type.text-spacing',
  'type.misuse',

  // §5 Imagery, graphics & motion
  'imagery.photography',
  'imagery.grading',
  'imagery.cropping',
  'imagery.illustration',
  'imagery.graphic-device',
  'imagery.texture',
  'imagery.iconography',
  'imagery.icon-states',
  'imagery.pictograms',
  'imagery.dataviz',
  'motion.easing',
  'motion.logo',
  'motion.video',
  'sound.sonic',

  // §6 Web / UX / product design system
  'web.grid',
  'web.breakpoints',
  'web.components',
  'web.navigation',
  'web.elevation',
  'web.accessibility',

  // §7 Editorial & marketing
  'voice.grammar',
  'voice.microcopy',
  'marketing.application-examples',
  'marketing.social',
  'marketing.email',
  'marketing.decks',
  'marketing.advertising',

  // §8 Physical collateral
  'collateral.stationery',
  'collateral.packaging',
  'collateral.swag',
  'collateral.signage',
  'collateral.vehicles',
  'collateral.uniforms',
  'collateral.product-design',

  // §9 Governance & infrastructure
  'gov.taxonomy',
  'gov.file-formats',
  'gov.dam',
  'gov.legal-ip',
  'gov.usage-rights',
  'gov.approvals',
  'gov.suppliers',
  'gov.contact',
  'gov.forms',
  'gov.launch',
  'gov.version-changelog',
  'gov.metrics',
] as const;

export type ComponentId = (typeof COMPONENT_IDS)[number];

/**
 * Which section each component belongs to.
 *
 * Written out rather than derived from the array's grouping, because the
 * grouping is a comment and comments do not fail a build. A component that
 * moves section has to be moved in two places on purpose.
 */
export const SECTION_OF: Readonly<Record<ComponentId, SectionId>> = {
  'brand.mission-vision': 1,
  'brand.values': 1,
  'brand.archetype': 1,
  'brand.positioning': 1,
  'brand.story': 1,
  'brand.naming': 1,
  'brand.tagline': 1,
  'brand.boilerplate': 1,
  'voice.tone': 1,
  'voice.vocabulary': 1,

  'logo.primary': 2,
  'logo.variants': 2,
  'logo.architecture': 2,
  'logo.cobranding': 2,
  'logo.construction': 2,
  'logo.clear-space': 2,
  'logo.min-size': 2,
  'logo.placement-backgrounds': 2,
  'logo.misuse': 2,

  'colour.palette': 3,
  'colour.tiers': 3,
  'colour.values': 3,
  'colour.print': 3,
  'colour.tints': 3,
  'colour.proportions': 3,
  'colour.order': 3,
  'colour.surfaces': 3,
  'colour.state': 3,
  'colour.themes': 3,
  'colour.contrast-pairs': 3,
  'colour.dataviz': 3,
  'colour.gradients': 3,
  'colour.misuse': 3,
  'colour.exceptions': 3,

  'type.families': 4,
  'type.sources': 4,
  'type.licensing': 4,
  'type.fallbacks': 4,
  'type.weights': 4,
  'type.metrics': 4,
  'type.hierarchy': 4,
  'type.lineheight': 4,
  'type.tracking': 4,
  'type.measure': 4,
  'type.paragraph-spacing': 4,
  'type.casing': 4,
  'type.alignment': 4,
  'type.formatting': 4,
  'type.minimums': 4,
  'type.channels': 4,
  'type.text-spacing': 4,
  'type.misuse': 4,

  'imagery.photography': 5,
  'imagery.grading': 5,
  'imagery.cropping': 5,
  'imagery.illustration': 5,
  'imagery.graphic-device': 5,
  'imagery.texture': 5,
  'imagery.iconography': 5,
  'imagery.icon-states': 5,
  'imagery.pictograms': 5,
  'imagery.dataviz': 5,
  'motion.easing': 5,
  'motion.logo': 5,
  'motion.video': 5,
  'sound.sonic': 5,

  'web.grid': 6,
  'web.breakpoints': 6,
  'web.components': 6,
  'web.navigation': 6,
  'web.elevation': 6,
  'web.accessibility': 6,

  'voice.grammar': 7,
  'voice.microcopy': 7,
  'marketing.application-examples': 7,
  'marketing.social': 7,
  'marketing.email': 7,
  'marketing.decks': 7,
  'marketing.advertising': 7,

  'collateral.stationery': 8,
  'collateral.packaging': 8,
  'collateral.swag': 8,
  'collateral.signage': 8,
  'collateral.vehicles': 8,
  'collateral.uniforms': 8,
  'collateral.product-design': 8,

  'gov.taxonomy': 9,
  'gov.file-formats': 9,
  'gov.dam': 9,
  'gov.legal-ip': 9,
  'gov.usage-rights': 9,
  'gov.approvals': 9,
  'gov.suppliers': 9,
  'gov.contact': 9,
  'gov.forms': 9,
  'gov.launch': 9,
  'gov.version-changelog': 9,
  'gov.metrics': 9,
};
