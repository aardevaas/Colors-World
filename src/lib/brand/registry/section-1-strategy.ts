/**
 * §1 Brand strategy & narrative — machine M3, Author (guided).
 *
 * The second front door. Nothing in this section has a prerequisite outside
 * itself, which means a founder with no palette, no logo and no design
 * training can start here on day one and finish something legitimate. That is
 * a much larger audience than people who arrive wanting OKLCH, and it is the
 * half of the user base the rest of the product does not serve at all today.
 *
 * Every component here is `declared`. We did not measure anyone's values and
 * no research says what an archetype should be — the person decided, and the
 * book labels it as a decision rather than dressing it as a finding. Applying
 * the evidence rule honestly to the weakest section is the test of whether the
 * rule means anything.
 */

import { obj, prose, renderAuthored, str, arr } from '../block';
import type { BrandComponent } from '../types';

export const SECTION_1: readonly BrandComponent[] = [
  {
    id: 'brand.mission-vision',
    name: 'Mission & vision',
    section: 1,
    requires: [],
    machine: 'M3',
    storage: 'project',
    produces: obj({ mission: str('Why the organisation exists'), vision: str('Where it is going') }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['brand.mission-vision'],
      frequency: 3,
      sectors: 3,
      wheeler: true,
    },
    render: renderAuthored(
      'brand.mission-vision',
      'Mission & vision',
      'Mission',
      'Not written yet. Two sentences: why this exists, and where it is going.'
    ),
  },
  {
    id: 'brand.values',
    name: 'Values & behaviours',
    section: 1,
    requires: [],
    machine: 'M3',
    storage: 'project',
    produces: obj({
      values: arr(
        obj({ name: str(), behaviour: str('What it looks like in practice') }, ['name']),
        'Each value paired with an observable behaviour'
      ),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['brand.values'],
      frequency: 3,
      sectors: 3,
      wheeler: true,
    },
    render: renderAuthored(
      'brand.values',
      'Values & behaviours',
      'Values',
      'Not written yet. A value without an observable behaviour beside it is decoration.'
    ),
  },
  {
    id: 'brand.archetype',
    name: 'Archetype & personality',
    section: 1,
    requires: [],
    machine: 'M3',
    storage: 'project',
    produces: obj({ archetype: str('e.g. The Explorer'), traits: arr(str()) }),
    evidence: 'declared',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'Not a named section in any sampled book, and not in Wheeler. Kept because it is the declared root that voice depends on — but it is the weakest-provenance component in the registry and should be the first cut if §1 needs trimming.',
    },
    render: renderAuthored(
      'brand.archetype',
      'Archetype & personality',
      'Archetype',
      'Not chosen yet. This is what voice and tone are derived from.'
    ),
  },
  {
    id: 'brand.positioning',
    name: 'Positioning & value proposition',
    section: 1,
    requires: [],
    machine: 'M3',
    storage: 'project',
    produces: obj({ audience: str(), category: str(), differentiator: str(), proof: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['brand.positioning'],
      frequency: 1,
      sectors: 1,
      wheeler: true,
    },
    render: renderAuthored(
      'brand.positioning',
      'Positioning & value proposition',
      'Positioning',
      'Not written yet. For whom, in what category, different how, and on what proof.'
    ),
  },
  {
    id: 'brand.story',
    name: 'Brand story',
    section: 1,
    requires: [],
    machine: 'M3',
    storage: 'project',
    produces: prose('The narrative, in the brand’s own voice'),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['brand.story'],
      frequency: 4,
      sectors: 4,
      wheeler: true,
      note: 'Observed in 4 books and prescribed by Wheeler, but had no row in the spec’s taxonomy. Placed here.',
    },
    render: renderAuthored(
      'brand.story',
      'Brand story',
      'Story',
      'Not written yet. Needs nothing else first — this can be the first thing you do.'
    ),
  },
  {
    id: 'brand.naming',
    name: 'Naming principles',
    section: 1,
    requires: [],
    machine: 'M3',
    storage: 'project',
    produces: obj({
      principles: arr(str()),
      conventions: str('How products, features and releases are named'),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['brand.naming'],
      frequency: 3,
      sectors: 2,
      wheeler: true,
      note: 'Observed in 3 books and prescribed by Wheeler, but had no row in the spec’s taxonomy. Placed here. Note this measured 12%, which is why the earlier claim that a name is part of the irreducible core did not survive.',
    },
    render: renderAuthored(
      'brand.naming',
      'Naming principles',
      'Principles',
      'Not written yet. How things get named, so the next product name is not an argument.'
    ),
  },
  {
    id: 'brand.tagline',
    name: 'Taglines & elevator pitches',
    section: 1,
    requires: ['brand.positioning'],
    machine: 'M3',
    storage: 'project',
    produces: obj({
      tagline: str(),
      pitches: arr(obj({ length: str('one-line | short | full'), text: str() }, ['text'])),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['brand.tagline'],
      frequency: 7,
      sectors: 6,
      wheeler: true,
    },
    render: renderAuthored(
      'brand.tagline',
      'Taglines & elevator pitches',
      'Tagline',
      'Not written yet. Positioning first — a tagline without it is a slogan.'
    ),
  },
  {
    id: 'brand.boilerplate',
    name: 'Boilerplate',
    section: 1,
    requires: ['brand.positioning'],
    machine: 'M3',
    storage: 'project',
    produces: prose('The standard paragraph used at the foot of a press release'),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['brand.boilerplate'],
      frequency: 1,
      sectors: 1,
      wheeler: true,
      note: 'Observed once and prescribed by Wheeler, but had no row in the spec’s taxonomy. Placed here.',
    },
    render: renderAuthored(
      'brand.boilerplate',
      'Boilerplate',
      'Boilerplate',
      'Not written yet. The paragraph everyone pastes and nobody owns.'
    ),
  },
  {
    id: 'voice.tone',
    name: 'Voice & tone',
    section: 1,
    requires: ['brand.archetype'],
    machine: 'M3',
    storage: 'project',
    produces: obj({
      voice: str('Constant — who the brand is'),
      tones: arr(
        obj({ situation: str(), guidance: str() }, ['situation', 'guidance']),
        'Tone varies by situation; voice does not'
      ),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['voice.tone'],
      frequency: 7,
      sectors: 5,
      wheeler: true,
    },
    render: renderAuthored(
      'voice.tone',
      'Voice & tone',
      'Voice',
      'Not written yet. Archetype first — tone is how the archetype behaves under pressure.'
    ),
  },
  {
    id: 'voice.vocabulary',
    name: 'Vocabulary rules',
    section: 1,
    requires: ['voice.tone'],
    machine: 'M3',
    storage: 'project',
    produces: obj({
      approved: arr(str()),
      banned: arr(str()),
      substitutions: arr(obj({ instead_of: str(), use: str() }, ['instead_of', 'use'])),
    }),
    evidence: 'declared',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'No sampled book named a vocabulary section, though several fold word lists into voice. Kept as a separate component because it is the one part of §1 that is machine-checkable later — a banned word is lintable, a tone is not.',
    },
    render: renderAuthored(
      'voice.vocabulary',
      'Vocabulary rules',
      'Vocabulary',
      'Not written yet. Approved words, banned words, and what to say instead.'
    ),
  },
];
