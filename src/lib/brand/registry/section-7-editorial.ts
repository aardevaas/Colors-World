/**
 * §7 Editorial & marketing — machines M3 (Author) and M5 (Template).
 *
 * Where the system meets an audience. Everything M5 builds here needs the same
 * three things — a mark, a palette and a typeface — which is exactly the
 * irreducible core the frequency study found. That is not a coincidence: a
 * template is the point at which a brand book stops describing and starts
 * producing, and you cannot produce without all three.
 *
 * `voice.microcopy` sits here rather than in §1 on purpose. Carbon keeps error
 * and button copy separate from tone of voice because they are a different
 * craft — one is who the brand is, the other is what the button says when the
 * upload fails.
 */

import { arr, num, obj, renderAuthored, str } from '../block';
import type { BrandComponent, ComponentId } from '../types';

/** The irreducible three. Nothing M5 makes is possible without all of them. */
const CORE: readonly ComponentId[] = ['logo.primary', 'colour.palette', 'type.families'];

export const SECTION_7: readonly BrandComponent[] = [
  {
    id: 'voice.grammar',
    name: 'Grammar & style rules',
    section: 7,
    requires: ['voice.tone'],
    machine: 'M3',
    storage: 'project',
    produces: obj({
      styleGuide: str('Which house style is followed'),
      rules: arr(obj({ rule: str(), example: str() }, ['rule'])),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['voice.grammar'],
      frequency: 2,
      sectors: 1,
      wheeler: true,
    },
    render: renderAuthored(
      'voice.grammar',
      'Grammar & style rules',
      'Rules',
      'Not written yet. Serial commas, capitalisation, dates and numbers — the arguments that recur forever until someone writes them down.'
    ),
  },
  {
    id: 'voice.microcopy',
    name: 'UI microcopy',
    section: 7,
    requires: ['voice.tone'],
    machine: 'M3',
    storage: 'project',
    produces: arr(
      obj({ context: str('button | error | empty | confirmation'), guidance: str(), example: str() }, [
        'context',
        'guidance',
      ])
    ),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'One of the eleven found by checking real books — Carbon treats it separately from voice and tone. Observed there but not recorded as its own id in the 25-book sample, so the frequency is genuinely 0 rather than low.',
    },
    render: renderAuthored(
      'voice.microcopy',
      'UI microcopy',
      'Microcopy',
      'Not written yet. What the button says, and what the error says when it fails.'
    ),
  },
  {
    id: 'marketing.application-examples',
    name: 'Application examples by audience',
    section: 7,
    requires: CORE,
    machine: 'M5',
    storage: 'project',
    produces: arr(obj({ audience: str(), example: str(), assetId: str() }, ['audience', 'example'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'One of the eleven found by checking real books — MemorialCare splits consumer from clinician. How a system flexes is not the same thing as a template of it. Not recorded as its own id in the sample.',
    },
    render: renderAuthored(
      'marketing.application-examples',
      'Application examples by audience',
      'Examples',
      'Not built yet. The same system shown to two different audiences is what proves it flexes.'
    ),
  },
  {
    id: 'marketing.social',
    name: 'Social templates',
    section: 7,
    requires: CORE,
    machine: 'M5',
    storage: 'project',
    produces: arr(
      obj({ platform: str(), widthPx: num(), heightPx: num(), safeAreaPx: num() }, [
        'platform',
        'widthPx',
        'heightPx',
      ])
    ),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['marketing.social'],
      frequency: 3,
      sectors: 3,
      wheeler: false,
    },
    render: renderAuthored(
      'marketing.social',
      'Social templates',
      'Templates',
      'Not built yet. Needs a mark, a palette and a typeface — then sizes and safe zones follow.'
    ),
  },
  {
    id: 'marketing.email',
    name: 'Email system',
    section: 7,
    requires: ['colour.palette', 'type.families'],
    machine: 'M5',
    storage: 'project',
    produces: obj({
      widthPx: num(),
      darkModeStrategy: str(),
      fallbackStack: str('Email clients ignore webfonts'),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['marketing.email'],
      frequency: 1,
      sectors: 1,
      wheeler: true,
      note: 'Does not require a mark: an email system is buildable from colour and type alone, which is why its requires list is shorter than the rest of M5.',
    },
    render: renderAuthored(
      'marketing.email',
      'Email system',
      'System',
      'Not built yet. Dark mode and the webfont fallback are the two things every email system gets wrong.'
    ),
  },
  {
    id: 'marketing.decks',
    name: 'Presentation decks',
    section: 7,
    requires: CORE,
    machine: 'M5',
    storage: 'project',
    produces: obj({ ratio: str('16:9 | 4:3'), masters: arr(str()) }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['marketing.decks'],
      frequency: 1,
      sectors: 1,
      wheeler: true,
    },
    render: renderAuthored(
      'marketing.decks',
      'Presentation decks',
      'Masters',
      'Not built yet. Slide masters are where a brand system is violated first and most.'
    ),
  },
  {
    id: 'marketing.advertising',
    name: 'Advertising',
    section: 7,
    requires: CORE,
    machine: 'M5',
    storage: 'project',
    produces: arr(obj({ format: str(), widthPx: num(), heightPx: num() }, ['format'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['marketing.advertising'],
      frequency: 4,
      sectors: 4,
      wheeler: true,
    },
    render: renderAuthored(
      'marketing.advertising',
      'Advertising',
      'Formats',
      'Not built yet. Which formats are supported, and how the mark behaves at each.'
    ),
  },
];
