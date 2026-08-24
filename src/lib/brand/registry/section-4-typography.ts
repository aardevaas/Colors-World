/**
 * §4 Typography system — machine M2, Compute & Verify.
 *
 * The second of the three CORE components lives here: `type.families` appears
 * in 20 of 25 books across 12 sectors. Like §3 this section reads the
 * URL-shaped System, so all of it renders with no account.
 *
 * The gap is the catalogue, not the engine. The scale, the fluid clamp and the
 * legibility field are all built and good; the product ships four hard-coded
 * pairings against a Fontsource catalogue of 2,096 open-licensed families.
 * That is a data problem, and it is why `type.families` renders a preset label
 * rather than a licence — which §9 will need.
 */

import { presetById } from '@/lib/typography/font-sources';
import { get, getByFamily, licenceOf } from '@/lib/typography/font-catalogue';
import { facesOf, stackFor } from '../typography';
import { permissionsFor } from '@/lib/typography/font-licences';
import { isLargeText, requiredRatio } from '@/lib/typography/legibility';
import { buildScale } from '@/lib/typography/type-scale';
import { absent, arr, finding, num, obj, present, renderAuthored, renderDerived, str } from '../block';
import type { BookEntry, BrandComponent, BrandState, Finding } from '../types';

/**
 * WCAG 1.4.12 asks that content stay readable when a reader forces
 * line-height to 1.5× the font size. A default already at or above 1.5 cannot
 * be broken by that override; one below it is where the layout has to survive
 * a change it has never been tested at.
 */
const TEXT_SPACING_LINE_HEIGHT = 1.5;

export const SECTION_4: readonly BrandComponent[] = [
  {
    id: 'type.families',
    name: 'Typefaces',
    section: 4,
    requires: [],
    machine: 'M2',
    storage: 'system',
    produces: obj(
      {
        presetId: str(),
        display: str(),
        body: str(),
        mono: str(),
        source: str('Where the faces are served from'),
      },
      ['presetId', 'display', 'body']
    ),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['type.families'],
      frequency: 20,
      sectors: 12,
      wheeler: true,
      grainSources: ['toyota', 'priority', 'carbon', 'regus', 'cedarville'],
      note: 'One of the three CORE components, and the second of the two this product already has.',
    },
    render: (state) => {
      const preset = presetById(state.system.type.presetId);
      const faces = facesOf(state);
      return present('type.families', 'Typefaces', 'declared', [
        ...faces.map((f) => ({ label: f.role, value: f.family })),
        { label: 'Character', value: preset.character },
        {
          label: 'Served from',
          value: preset.source,
          evidence: 'measured',
          note: 'Licence terms are not carried by the preset yet — §9 licensing depends on them.',
        },
      ]);
    },
  },
  {
    id: 'type.metrics',
    name: 'Scale',
    section: 4,
    requires: [],
    machine: 'M2',
    storage: 'system',
    produces: obj(
      {
        baseRem: num(),
        ratio: num('Modular scale ratio'),
        lineHeight: num(),
        tracking: num('em'),
        weight: num(),
      },
      ['baseRem', 'ratio', 'lineHeight']
    ),
    evidence: 'measured',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'No sampled book names a "metrics" section; they print a ladder instead. Kept separate from type.hierarchy because these are the inputs and the ladder is the output — storing a derived value is how two sources of truth start disagreeing.',
    },
    render: (state) => {
      const t = state.system.type;
      return present('type.metrics', 'Scale', 'measured', [
        { label: 'Base size', value: `${t.baseRem}rem`, note: `${t.baseRem * 16}px at a 16px root.` },
        { label: 'Ratio', value: t.ratio.toFixed(3) },
        {
          label: 'Steps',
          value: 'display → caption',
          note: 'Line height, tracking and weight each state a per-role rule and have their own entries below.',
        },
      ]);
    },
  },
  {
    id: 'type.hierarchy',
    name: 'Hierarchy',
    section: 4,
    requires: ['type.metrics'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ token: str(), rem: num(), px: num() }, ['token', 'rem', 'px'])),
    evidence: 'measured',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['toyota', 'priority', 'carbon', 'commonwealth'],
      note: 'Folded into type.families in every sampled book rather than named separately. Kept because the ladder is computed and re-derivable, which is the whole difference from a typed table.',
    },
    render: (state) => {
      const { baseRem, ratio } = state.system.type;
      return present(
        'type.hierarchy',
        'Hierarchy',
        'measured',
        buildScale(baseRem, ratio).map((entry) => ({
          label: entry.token,
          value: `${entry.rem}rem`,
          note: `${entry.px}px at a 16px root`,
        }))
      );
    },
  },
  {
    id: 'type.paragraph-spacing',
    name: 'Paragraph spacing',
    section: 4,
    requires: ['type.metrics'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ paragraphSpacingEm: num(), measureCh: num('Line length in characters') }),
    evidence: 'declared',
    provenance: {
      origin: 'proposed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      grainSources: ['uswds', 'cedarville'],
      note: 'Split out by me from the typography row, not observed anywhere. Low provenance — a candidate for folding back into type.metrics if §4 needs trimming.',
    },
    render: () => ({
      kind: 'absent',
      id: 'type.paragraph-spacing',
      title: 'Paragraph spacing',
      reason:
        'Not set yet. How much air sits between paragraphs, whether they indent, and how they break across a column.',
    }),
  },
  {
    id: 'type.formatting',
    name: 'Typesetting rules',
    section: 4,
    requires: ['type.hierarchy'],
    machine: 'M2',
    storage: 'project',
    produces: obj({
      alignment: str(),
      caseRules: str(),
      widowsOrphans: str(),
      numerals: str(),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['type.formatting'],
      frequency: 1,
      sectors: 1,
      wheeler: false,
      grainSources: ['toyota'],
    },
    render: () => ({
      kind: 'absent',
      id: 'type.formatting',
      title: 'Typesetting rules',
      reason: 'Not written yet. Alignment, case, widows and orphans, and which numerals to set.',
    }),
  },
  {
    id: 'type.text-spacing',
    name: 'Text spacing tolerance (WCAG 1.4.12)',
    section: 4,
    requires: ['type.hierarchy'],
    machine: 'M2',
    storage: 'system',
    produces: obj({
      lineHeight: num('Authored line height'),
      toleratesOverride: str('pass | fail'),
    }),
    evidence: 'measured',
    provenance: {
      origin: 'proposed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Mine, and not observed in any sampled book. Kept because it is one of very few brand-book rules that can be checked rather than asserted, and because public-sector work makes it a procurement question rather than a preference.',
    },
    render: (state) => {
      const { lineHeight } = state.system.type;
      const tolerates = lineHeight >= TEXT_SPACING_LINE_HEIGHT;
      return present('type.text-spacing', 'Text spacing tolerance (WCAG 1.4.12)', 'measured', [
        { label: 'Authored line height', value: lineHeight.toFixed(2) },
        {
          label: 'Reader override of 1.5',
          value: tolerates ? 'no layout change' : 'increases line height',
          note: tolerates
            ? 'Already at or above the value the criterion asks content to tolerate.'
            : 'The layout has to survive a change it is not authored at.',
        },
      ]);
    },
    validate: (state): readonly Finding[] => {
      const { lineHeight } = state.system.type;
      if (lineHeight >= TEXT_SPACING_LINE_HEIGHT) return [];
      return [
        finding(
          'type.text-spacing',
          'warn',
          'Body line height is below the 1.5 a reader may force under WCAG 1.4.12, so the layout has to tolerate a spacing change it is not authored at.',
          { measured: lineHeight.toFixed(2), expected: `≥ ${TEXT_SPACING_LINE_HEIGHT}` }
        ),
      ];
    },
  },

  /* ------------------------------------------------------------------------
   * Added 2026-08-24 with the grain re-cut. Toyota alone states weight,
   * leading, kerning, alignment, casing, word count and number handling as
   * separate per-role rules — the old six-component §4 could not express any
   * of them. See docs/research/INTERNAL-GUIDELINE-GRAIN.md.
   * --------------------------------------------------------------------- */
  {
    id: 'type.sources',
    name: 'Where the faces come from',
    section: 4,
    requires: ['type.families'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ family: str(), source: str(), url: str() }, ['family', 'source'])),
    evidence: 'measured',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['priority'],
      note: 'Priority names the source and links the download. Skipping it is what makes a contractor pull the wrong cut six months later.',
    },
    render: (state) => {
      const entries: BookEntry[] = [];
      for (const { role, family } of facesOf(state)) {
        const hit = getByFamily(family);
        entries.push(
          hit === null
            ? {
                label: role,
                value: `${family} — not in the open catalogue`,
                evidence: 'declared',
                note: 'Served by a single foundry rather than an open catalogue, so its licence terms are not recorded here and it cannot be self-hosted from npm.',
              }
            : {
                label: role,
                value: family,
                note: `fontsource/${hit.id} · ${hit.weights.length} weights${hit.variable ? ' · variable' : ''} · self-hostable`,
              }
        );
      }
      return present('type.sources', 'Where the faces come from', 'measured', entries);
    },
  },
  {
    id: 'type.licensing',
    name: 'Font licensing',
    section: 4,
    requires: ['type.sources'],
    machine: 'M6',
    storage: 'system',
    produces: arr(
      obj({ family: str(), licence: str(), web: str(), print: str(), product: str() }, ['family'])
    ),
    evidence: 'cited',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['priority'],
      note: 'Web embedding, print, product use and resale are FOUR different permissions and not every licence grants all four. Fontsource carries per-family licence data, which is the strongest argument for that catalogue over Google\u2019s API.',
    },
    render: (state) => {
      const resolved = facesOf(state).map(({ family }) => {
        const hit = getByFamily(family);
        return { family, licence: hit === null ? null : licenceOf(hit.id) };
      });

      const known = resolved.filter((r) => r.licence !== null);
      if (known.length === 0) {
        return absent(
          'type.licensing',
          'Font licensing',
          'None of the chosen faces are in the open catalogue, so no terms have been checked. Web embedding, print, product use and resale are four separate permissions.'
        );
      }

      const entries: BookEntry[] = [];
      const distinct = [...new Set(known.map((r) => r.licence!.id))];

      /*
       * A guideline states shared terms ONCE. Repeating the same OFL paragraph
       * under three families is how a licensing section becomes the page nobody
       * reads — and 2,052 of the catalogue's 2,096 families are OFL, so shared
       * is the common case rather than the exception.
       */
      for (const id of distinct) {
        const licence = known.find((r) => r.licence!.id === id)!.licence!;
        const under = known.filter((r) => r.licence!.id === id).map((r) => r.family);
        const granted = permissionsFor(licence).filter((x) => x.allowed).map((x) => x.use);
        const refused = permissionsFor(licence).filter((x) => !x.allowed).map((x) => x.use);
        entries.push({
          label: licence.name,
          value: under.join(' · '),
          note: `${granted.join(', ')}${refused.length > 0 ? ` — but NOT ${refused.join(', ').toLowerCase()}` : ''}.${licence.attributionRequired ? ' Attribution required.' : ''} ${licence.note}`,
        });
      }

      for (const r of resolved) {
        if (r.licence !== null) continue;
        entries.push({
          label: r.family,
          value: 'Not recorded',
          evidence: 'declared',
          note: 'Not in the open catalogue, so its terms have not been checked. Confirm them with the foundry before shipping print or product work.',
        });
      }

      return present('type.licensing', 'Font licensing', 'cited', entries);
    },
  },
  {
    id: 'type.fallbacks',
    name: 'Fallback stack',
    section: 4,
    requires: ['type.families'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ displayStack: str(), bodyStack: str(), systemAlternate: str() }),
    evidence: 'measured',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['priority'],
      note: 'Priority names Calibri as the system alternate "when Source Sans 3 is unavailable for all users… most commonly Microsoft or email". Without a stated fallback a failed font load lands on whatever the browser picks, which is never the brand.',
    },
    render: (state) => {
      return present('type.fallbacks', 'Fallback stack', 'measured', [
        // stackFor, not a local table: this is the same string the token
        // exports emit as --font-display / --font-body / --font-mono, and the
        // book stating one stack while the tokens carry another is the whole
        // failure this shares a function to prevent.
        ...facesOf(state).map((face) => ({ label: face.role, value: stackFor(face) })),
        {
          label: 'Email',
          value: 'Arial, Helvetica, sans-serif',
          note: 'Most email clients strip webfonts. This is what actually renders.',
        },
      ]);
    },
  },
  {
    id: 'type.weights',
    name: 'Weights',
    section: 4,
    requires: ['type.families'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ role: str(), weight: num(), condition: str() }, ['role', 'weight'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['toyota', 'priority', 'regus', 'cedarville'],
      note: 'Toyota states weight per role AND per condition: "Book for text 10pt or larger on light backgrounds; Regular for 10pt or smaller when reversed on dark." Weight is not one number.',
    },
    render: (state) => {
      const bodyFace = facesOf(state).find((f) => f.role === 'Body')!;
      const body = bodyFace.id === null ? null : get(bodyFace.id);
      const entries: BookEntry[] = [
        { label: 'Body weight', value: String(state.system.type.weight), evidence: 'measured' },
      ];
      if (body !== null) {
        entries.push({
          label: 'Available',
          value: body.variable
            ? `${body.weights[0]}–${body.weights[body.weights.length - 1]} on an axis`
            : body.weights.join(' · '),
          note: body.variable
            ? 'A variable font carries its weights on a continuous axis, so any value in that range is a real cut rather than a browser faking one.'
            : `${body.weights.length} real cuts. Anything else the browser synthesises, which is not the same typeface.`,
        });
      }
      entries.push({
        label: 'Reversed on dark',
        value: 'Not set',
        evidence: 'declared',
        note: 'Text reversed out of a dark ground reads lighter than it is. Most manuals step the weight up.',
      });
      return present('type.weights', 'Weights', 'declared', entries);
    },
  },
  {
    id: 'type.lineheight',
    name: 'Line height',
    section: 4,
    requires: ['type.metrics'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ role: str(), value: num() }, ['role', 'value'])),
    evidence: 'measured',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['toyota', 'carbon', 'uswds', 'cedarville'],
      note: 'Toyota states leading per role — 90% headlines, 110% subheads in print, 145% body. Cedarville states 10pt on 13pt for letterhead. One global number cannot express any of that.',
    },
    render: (state) => {
      const lh = state.system.type.lineHeight;
      return present('type.lineheight', 'Line height', 'measured', [
        { label: 'Body', value: lh.toFixed(2) },
        {
          label: 'Headings',
          value: (lh * 0.72).toFixed(2),
          note: 'Derived. Long text needs more leading than a heading of one or two lines — USWDS puts headings between 1 and 1.35, running text at 1.5 or above.',
        },
      ]);
    },
  },
  {
    id: 'type.tracking',
    name: 'Tracking & kerning',
    section: 4,
    requires: ['type.metrics'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ bodyEm: num(), displayEm: num(), kerning: str() }),
    evidence: 'measured',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['toyota', 'priority'],
      note: 'Toyota: optical kerning with manual adjustment, 0px letter spacing for digital. Priority: 10% letter spacing on tags. Uppercase always needs more than lowercase.',
    },
    render: (state) =>
      present('type.tracking', 'Tracking & kerning', 'measured', [
        { label: 'Body', value: `${state.system.type.tracking}em` },
        { label: 'Kerning', value: 'Optical', evidence: 'declared' },
        {
          label: 'Uppercase',
          value: 'Not set',
          note: 'Caps set at body tracking read tight. Most manuals add 0.05–0.12em.',
        },
      ]),
  },
  {
    id: 'type.measure',
    name: 'Measure',
    section: 4,
    requires: ['type.metrics'],
    machine: 'M2',
    storage: 'system',
    produces: obj({ minCh: num(), maxCh: num(), targetCh: num() }),
    evidence: 'measured',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['uswds'],
      note: 'USWDS tokenises measure and states the readable range as 45\u201390 characters per line. It is the typographic rule most often left unstated and most often broken.',
    },
    render: (state) => {
      const basePx = state.system.type.baseRem * 16;
      // ~0.5em average advance width is the usual approximation for a
      // proportional face; exact only per-font, which is why it is a target.
      const ch = (n: number) => Math.round(n * basePx * 0.5);
      return present('type.measure', 'Measure', 'measured', [
        { label: 'Readable range', value: '45–90 characters' },
        {
          label: 'At this base size',
          value: `${ch(45)}px – ${ch(90)}px`,
          note: 'Approximate — character advance is per-face, so treat it as a target column width rather than a guarantee.',
        },
        { label: 'Target', value: '65 characters', evidence: 'declared' },
      ]);
    },
  },
  {
    id: 'type.casing',
    name: 'Casing',
    section: 4,
    requires: ['type.hierarchy'],
    machine: 'M3',
    storage: 'project',
    produces: obj({ rules: arr(str()), uppercaseMaxWords: num() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['toyota', 'priority'],
      note: 'Toyota: "Only use uppercase for headlines with 7 or fewer words." A word count is a rule anyone can follow and most manuals never give one.',
    },
    render: renderDerived<{ rules?: readonly string[]; uppercaseMaxWords?: number }>(
      'type.casing', 'Casing', 'declared',
      'Not set. Where capitals are allowed, and how long a headline may be before they stop working.',
      (d) => [
        ...(d.uppercaseMaxWords ? [{ label: 'Uppercase limit', value: `${d.uppercaseMaxWords} words` }] : []),
        ...(d.rules ?? []).map((r, i) => ({ label: `Rule ${i + 1}`, value: r })),
      ]
    ),
  },
  {
    id: 'type.alignment',
    name: 'Alignment',
    section: 4,
    requires: ['type.hierarchy'],
    machine: 'M3',
    storage: 'project',
    produces: obj({ allowed: arr(str()), forbidden: arr(str()), hyphenation: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['toyota', 'uswds', 'cedarville'],
      note: 'Toyota: "Flush left, centered or staggered. Never flush right." Cedarville: hyphenation none. USWDS: set type flush left so the eye has a constant starting point.',
    },
    render: renderDerived<{ allowed?: readonly string[]; forbidden?: readonly string[]; hyphenation?: string }>(
      'type.alignment', 'Alignment', 'declared',
      'Not set. Which alignments are permitted, which are forbidden, and whether text may hyphenate.',
      (d) => [
        ...(d.allowed?.length ? [{ label: 'Allowed', value: d.allowed.join(' · ') }] : []),
        ...(d.forbidden?.length ? [{ label: 'Never', value: d.forbidden.join(' · ') }] : []),
        ...(d.hyphenation ? [{ label: 'Hyphenation', value: d.hyphenation }] : []),
      ]
    ),
  },
  {
    id: 'type.minimums',
    name: 'Minimum sizes',
    section: 4,
    requires: ['type.hierarchy'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ channel: str(), minPx: num(), reason: str() }, ['channel', 'minPx'])),
    evidence: 'measured',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['toyota', 'uswds'],
      note: 'USWDS sets 16px minimum for body. Toyota steps weight by size and ground. Email is the hard case: never below 14px, because the fallback face is not the brand face.',
    },
    render: (state) => {
      const w = state.system.type.weight;
      const basePx = state.system.type.baseRem * 16;
      const entries: BookEntry[] = [
        { label: 'Web body', value: '16px', note: 'USWDS floor for running text.' },
        { label: 'Email body', value: '14px', note: 'Below this the fallback face becomes unreadable.' },
        {
          label: 'This system\u2019s body',
          value: `${basePx}px at weight ${w}`,
          note: `WCAG treats it as ${isLargeText(basePx, w) ? 'large' : 'normal'} text, so it needs ${requiredRatio(basePx, w)}:1.`,
        },
      ];
      return present('type.minimums', 'Minimum sizes', 'measured', entries);
    },
  },
  {
    id: 'type.channels',
    name: 'Channel rules',
    section: 4,
    requires: ['type.fallbacks', 'type.minimums'],
    machine: 'M2',
    storage: 'project',
    produces: arr(obj({ channel: str(), stack: str(), notes: str() }, ['channel'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['toyota', 'priority'],
      note: 'Web, email, print and presentation each break typography differently, so real manuals state them separately. Toyota gives leading per channel; Priority names a system alternate specifically for Microsoft and email.',
    },
    render: renderAuthored(
      'type.channels', 'Channel rules', 'Rules',
      'Not set. Web, email, print and presentation break type in different ways and each needs its own line.'
    ),
  },
  {
    id: 'type.misuse',
    name: 'Type misuse',
    section: 4,
    requires: ['type.hierarchy'],
    machine: 'M2',
    storage: 'system',
    produces: arr(obj({ kind: str(), why: str(), measured: str() }, ['kind', 'why'])),
    evidence: 'measured',
    provenance: {
      origin: 'observed', observedAs: [], frequency: 0, sectors: 0, wheeler: false,
      grainSources: ['toyota'],
      note: 'Generated from the real scale rather than drawn, exactly as colour misuse is — tracking pulled tight, a heading set at body leading, a size below the channel floor, each with the number that makes it wrong.',
    },
    render: (state) => {
      const t = state.system.type;
      const basePx = t.baseRem * 16;
      return present('type.misuse', 'Type misuse', 'measured', [
        {
          label: 'Do not tighten body tracking',
          value: `${t.tracking}em → -0.02em`,
          note: 'Negative tracking on running text costs legibility for a saving nobody asked for.',
        },
        {
          label: 'Do not set headings at body leading',
          value: `${t.lineHeight.toFixed(2)} on a display size`,
          note: 'Leading that suits a paragraph looks slack on a two-line heading.',
        },
        {
          label: 'Do not go under the channel floor',
          value: `${Math.round(basePx * 0.75)}px in email`,
          note: 'Below 14px in email the fallback face is what people actually read.',
        },
      ]);
    },
  },
];
