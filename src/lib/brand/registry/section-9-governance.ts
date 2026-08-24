/**
 * §9 Governance & infrastructure — machine M6, Govern.
 *
 * The measured whitespace. Four components here — `gov.taxonomy`,
 * `gov.version-changelog`, `gov.launch` and `gov.metrics` — are prescribed by
 * Wheeler's practitioner composite and appear in **none** of the 25 sampled
 * books. Nobody versions a brand book. Nobody tracks whether the assets work.
 *
 * That finding is durable, and it should be stated with its caveat attached:
 * "nobody does it" has two readings — nobody needs it, or nobody can. This
 * registry assumes the second, which makes it unproven demand backed by strong
 * capability rather than validated demand. Do not let it be sold as validated.
 *
 * The capability half is real. Branch, merge and a version DAG already exist
 * (`src/lib/versioning`), share links already exist, and with collaboration in
 * scope an approval can be pinned to a version rather than floating — which is
 * what makes `gov.approvals` the first component in the product that can catch
 * a governance failure instead of describing one.
 */

import { approvalFor, textFor } from '../project';
import { absent, arr, finding, num, obj, present, renderAuthored, renderDerived, str } from '../block';
import { systemVersion } from '../version';
import type { BookEntry, BrandComponent, Finding } from '../types';

/** Romaniuk's grid splits at the midpoint of each axis. */
const GRID_MIDPOINT = 50;

/** Which quadrant of the Fame × Uniqueness grid an asset falls in. */
function quadrant(fame: number, uniqueness: number): string {
  if (fame >= GRID_MIDPOINT && uniqueness >= GRID_MIDPOINT) return 'Distinctive asset — protect it';
  if (fame >= GRID_MIDPOINT) return 'Well known but not distinctive — a category cue, not yours';
  if (uniqueness >= GRID_MIDPOINT) return 'Distinctive but unknown — invest or drop';
  return 'Neither — stop spending on it';
}

export const SECTION_9: readonly BrandComponent[] = [
  {
    id: 'gov.taxonomy',
    name: 'Asset taxonomy & naming',
    section: 9,
    requires: [],
    machine: 'M6',
    storage: 'project',
    produces: obj(
      {
        pattern: str('A regular expression every asset name must match'),
        example: str(),
      },
      ['pattern']
    ),
    evidence: 'measured',
    provenance: {
      origin: 'derived',
      observedAs: ['gov.taxonomy'],
      frequency: 0,
      sectors: 0,
      wheeler: true,
      note: 'Prescribed by Wheeler, shipped by none of the 25. Part of the governance whitespace — and lintable, which is why it can be more than a paragraph.',
    },
    render: renderDerived<{ pattern: string; example?: string }>(
      'gov.taxonomy',
      'Asset taxonomy & naming',
      'measured',
      'Not set yet. A naming pattern turns "please name files sensibly" into something the system can check.',
      (d) => [
        { label: 'Pattern', value: d.pattern },
        ...(d.example ? [{ label: 'Example', value: d.example }] : []),
      ]
    ),
    validate: (state): readonly Finding[] => {
      const raw = state.project?.data['gov.taxonomy'] as { pattern?: string } | null | undefined;
      const pattern = raw?.pattern;
      if (!pattern || !state.project) return [];

      let re: RegExp;
      try {
        re = new RegExp(pattern);
      } catch {
        return [
          finding('gov.taxonomy', 'fail', 'The naming pattern is not a valid regular expression, so nothing can be checked against it.', {
            measured: pattern,
          }),
        ];
      }

      return state.project.assets
        .filter((a) => !re.test(a.label))
        .map((a) =>
          finding('gov.taxonomy', 'warn', `Asset "${a.label}" does not match the naming pattern.`, {
            measured: a.label,
            expected: pattern,
          })
        );
    },
  },
  {
    id: 'gov.file-formats',
    name: 'Format decision matrix',
    section: 9,
    requires: [],
    machine: 'M6',
    storage: 'project',
    produces: arr(obj({ useCase: str(), format: str(), why: str() }, ['useCase', 'format'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['gov.file-formats'],
      frequency: 1,
      sectors: 1,
      wheeler: true,
    },
    render: renderDerived<readonly { useCase: string; format: string; why?: string }[]>(
      'gov.file-formats',
      'Format decision matrix',
      'declared',
      'Not set yet. Which format for print, for web, for a partner who will ask for "the logo".',
      (rows) => rows.map((r) => ({ label: r.useCase, value: r.format, ...(r.why ? { note: r.why } : {}) }))
    ),
  },
  {
    id: 'gov.dam',
    name: 'Asset library',
    section: 9,
    requires: [],
    machine: 'M6',
    storage: 'project',
    produces: arr(obj({ assetId: str(), kind: str(), url: str() }, ['assetId', 'kind'])),
    evidence: 'measured',
    provenance: {
      origin: 'founder',
      observedAs: [],
      frequency: 0,
      sectors: 0,
      wheeler: false,
      note: 'No sampled book names a DAM — a brand book points at one rather than being one. Kept because /assets already versions files and is the seed of it.',
    },
    render: (state) => {
      const assets = state.project?.assets ?? [];
      if (assets.length === 0) {
        return absent(
          'gov.dam',
          'Asset library',
          'Nothing uploaded yet. Files land here whether or not they answer a component.'
        );
      }
      const byKind = new Map<string, number>();
      for (const a of assets) byKind.set(a.kind, (byKind.get(a.kind) ?? 0) + 1);
      const entries: BookEntry[] = [...byKind.entries()].map(([kind, n]) => ({
        label: kind,
        value: String(n),
      }));
      const unassigned = assets.filter((a) => !a.componentId).length;
      entries.push({
        label: 'Unassigned',
        value: String(unassigned),
        note: 'Held in the library but answering no component, so unlocking nothing.',
      });
      return present('gov.dam', 'Asset library', 'measured', entries);
    },
  },
  {
    id: 'gov.legal-ip',
    name: 'Licensing & IP',
    section: 9,
    requires: ['type.families'],
    machine: 'M6',
    storage: 'project',
    produces: obj({
      trademarks: arr(str()),
      fontLicences: arr(obj({ family: str(), licence: str() }, ['family'])),
      stockLicences: arr(str()),
    }),
    evidence: 'cited',
    provenance: {
      origin: 'observed',
      observedAs: ['gov.legal-ip'],
      frequency: 9,
      sectors: 7,
      wheeler: true,
      note: 'The most common governance component at 36%. Font licence terms arrive free with the Fontsource catalogue, which is the strongest single argument for that integration over Google’s API.',
    },
    render: renderAuthored(
      'gov.legal-ip',
      'Licensing & IP',
      'Licensing',
      'Not recorded yet. Font licences, stock licences and which marks are registered.'
    ),
  },
  {
    id: 'gov.usage-rights',
    name: 'Third-party usage rights',
    section: 9,
    requires: ['logo.primary'],
    machine: 'M6',
    storage: 'project',
    produces: obj({ whoMayUse: str(), conditions: str(), howToRequest: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['gov.usage-rights'],
      frequency: 8,
      sectors: 6,
      wheeler: false,
      note: 'One of the eleven found by checking real books, and NASA’s largest section. Distinct from misuse: misuse is about how the mark may be drawn, this is about who may draw it at all.',
    },
    render: renderAuthored(
      'gov.usage-rights',
      'Third-party usage rights',
      'Rights',
      'Not written yet. Who outside the organisation may use the mark, on what conditions, and how they ask.'
    ),
  },
  {
    id: 'gov.approvals',
    name: 'Approvals',
    section: 9,
    requires: [],
    machine: 'M6',
    storage: 'project',
    produces: arr(
      obj({ componentId: str(), versionId: str(), state: str('pending | approved | rejected') }, [
        'componentId',
        'versionId',
        'state',
      ])
    ),
    evidence: 'measured',
    provenance: {
      origin: 'observed',
      observedAs: ['gov.approvals'],
      frequency: 8,
      sectors: 6,
      wheeler: true,
      note: 'Real brand books do care about sign-off — 32%, across 6 sectors. Pinning an approval to a version is what turns it from a paragraph into a check.',
    },
    render: (state) => {
      const project = state.project;
      const approvals = project?.approvals ?? [];
      if (!project || approvals.length === 0) {
        return absent(
          'gov.approvals',
          'Approvals',
          'Nothing submitted yet. An approval records who signed off on which component, at which version.'
        );
      }
      const counts = { approved: 0, pending: 0, rejected: 0 };
      for (const a of approvals) counts[a.state] += 1;
      const stale = approvals.filter(
        (a) => a.state === 'approved' && a.versionId !== project.versionId
      ).length;
      return present('gov.approvals', 'Approvals', 'measured', [
        { label: 'Approved', value: String(counts.approved) },
        { label: 'Pending', value: String(counts.pending) },
        { label: 'Rejected', value: String(counts.rejected) },
        {
          label: 'Approved against an older version',
          value: String(stale),
          note: 'Sign-off does not survive a change to the thing that was signed off.',
        },
      ]);
    },
    validate: (state): readonly Finding[] => {
      const project = state.project;
      if (!project) return [];
      return project.approvals
        .filter((a) => a.state === 'approved' && a.versionId !== project.versionId)
        .map((a) =>
          finding(
            'gov.approvals',
            'warn',
            `${a.componentId} was approved against a version that is no longer current.`,
            { measured: a.versionId, expected: project.versionId }
          )
        );
    },
  },
  {
    id: 'gov.suppliers',
    name: 'Suppliers & production partners',
    section: 9,
    requires: [],
    machine: 'M6',
    storage: 'project',
    produces: arr(obj({ name: str(), scope: str(), contact: str() }, ['name'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['gov.suppliers'],
      frequency: 2,
      sectors: 2,
      wheeler: false,
      note: 'Observed in 2 books, but had no row in the spec’s taxonomy. Placed here.',
    },
    render: renderAuthored(
      'gov.suppliers',
      'Suppliers & production partners',
      'Suppliers',
      'Not recorded yet. Who prints, who fabricates, and who already has the files.'
    ),
  },
  {
    id: 'gov.contact',
    name: 'Who to ask',
    section: 9,
    requires: [],
    machine: 'M6',
    storage: 'project',
    produces: obj({ team: str(), email: str(), escalation: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['gov.contact'],
      frequency: 8,
      sectors: 6,
      wheeler: true,
      note: 'Observed in 8 of 25 across 6 sectors — as common as approvals and usage rights — and it had no row in the spec’s taxonomy at all. The most-missed component found while building this registry, and the cheapest one in it.',
    },
    render: (state) => {
      const text = textFor(state.project, 'gov.contact');
      if (text === null) {
        return absent(
          'gov.contact',
          'Who to ask',
          'Not filled in. One line — a team and an address — and it appears in a third of real brand books.'
        );
      }
      return present('gov.contact', 'Who to ask', 'declared', [{ label: 'Contact', value: text }]);
    },
  },
  {
    id: 'gov.forms',
    name: 'Request forms',
    section: 9,
    requires: ['gov.contact'],
    machine: 'M6',
    storage: 'project',
    produces: arr(obj({ purpose: str(), url: str() }, ['purpose'])),
    evidence: 'declared',
    provenance: {
      origin: 'observed',
      observedAs: ['gov.forms'],
      frequency: 1,
      sectors: 1,
      wheeler: true,
      note: 'Observed once and prescribed by Wheeler, but had no row in the spec’s taxonomy. Placed here.',
    },
    render: renderDerived<readonly { purpose: string; url?: string }[]>(
      'gov.forms',
      'Request forms',
      'declared',
      'None yet. How someone requests an asset, an exception or a new lockup.',
      (rows) => rows.map((r) => ({ label: r.purpose, value: r.url ?? 'no link' }))
    ),
  },
  {
    id: 'gov.launch',
    name: 'Rollout & launch plan',
    section: 9,
    requires: [],
    machine: 'M6',
    storage: 'project',
    produces: obj({ phases: arr(obj({ name: str(), date: str() }, ['name'])), sunset: str() }),
    evidence: 'declared',
    provenance: {
      origin: 'derived',
      observedAs: ['gov.launch'],
      frequency: 0,
      sectors: 0,
      wheeler: true,
      note: 'Prescribed by Wheeler, shipped by none of the 25, and had no row in the spec’s taxonomy. Part of the governance whitespace, and the natural home of the rebrand/migration coordinate — old versus new, what changes, and when the old marks sunset.',
    },
    render: renderAuthored(
      'gov.launch',
      'Rollout & launch plan',
      'Plan',
      'Not planned yet. When the new identity appears, where first, and when the old one stops being acceptable.'
    ),
  },
  {
    id: 'gov.version-changelog',
    name: 'Version history',
    section: 9,
    requires: [],
    machine: 'M6',
    storage: 'project',
    produces: obj({ versionId: str(), changelog: arr(str()) }, ['versionId']),
    evidence: 'measured',
    provenance: {
      origin: 'derived',
      observedAs: ['gov.version-changelog'],
      frequency: 0,
      sectors: 0,
      wheeler: true,
      note: 'Prescribed by Wheeler and shipped by none of the 25 — and the one whitespace component the product already has the machinery for. Branch, merge and a version DAG exist today.',
    },
    render: (state) => {
      const project = state.project;
      if (!project) {
        /*
         * A stamp, not a history — and the difference is stated rather than
         * implied. Remembering previous versions needs somewhere to keep them,
         * which needs an account. Identifying THIS one does not, because the
         * system is the URL and can be fingerprinted.
         *
         * This is the only part of §9 that works without an account, and it is
         * the part that makes a printed guideline checkable: two people can
         * compare eight characters instead of comparing every swatch.
         */
        const version = systemVersion(state.system);
        if (version.isEmpty) {
          return absent(
            'gov.version-changelog',
            'Version history',
            'Nothing is set yet, so there is no version to state. A stamp appears as soon as the system has anything in it.'
          );
        }
        return present('gov.version-changelog', 'Version history', 'measured', [
          {
            label: 'This version',
            value: version.id,
            note: 'Derived from the system itself, so it cannot be forgotten or set wrongly. The same system always stamps the same, including after a round trip through a shared link.',
          },
          { label: 'Taken over', value: version.covers },
          {
            label: 'History',
            value: 'Needs a project',
            evidence: 'declared',
            note: 'This identifies the current version. Remembering the previous ones — what changed, when, and who approved it — needs somewhere to keep them, and that is an account.',
          },
        ]);
      }
      return present('gov.version-changelog', 'Version history', 'measured', [
        { label: 'Current version', value: project.versionId },
        {
          label: 'Recorded',
          value: 'Branch, merge and a full version graph',
          note: 'Nobody in the 25-book sample versions their brand book.',
        },
      ]);
    },
  },
  {
    id: 'gov.metrics',
    name: 'Distinctive asset grid',
    section: 9,
    requires: ['logo.primary', 'colour.palette'],
    machine: 'M6',
    storage: 'project',
    produces: arr(
      obj(
        {
          asset: str('Which distinctive asset was tested'),
          famePct: num('Share who link it to the brand'),
          uniquenessPct: num('Share who link it to this brand only'),
        },
        ['asset', 'famePct', 'uniquenessPct']
      )
    ),
    evidence: 'cited',
    provenance: {
      origin: 'derived',
      observedAs: ['gov.metrics'],
      frequency: 0,
      sectors: 0,
      wheeler: true,
      note: 'Prescribed by Wheeler, shipped by none of the 25 — and it had no row in the spec’s taxonomy either, despite being the component the whole governance-whitespace argument rests on. Romaniuk’s Fame × Uniqueness grid is the method; the survey figures are the brand’s own, so the grid position is measured and the inputs are not.',
    },
    render: renderDerived<readonly { asset: string; famePct: number; uniquenessPct: number }[]>(
      'gov.metrics',
      'Distinctive asset grid',
      'cited',
      'Nothing tested yet. Which of your assets do people actually link to you — and to you alone?',
      (rows) =>
        rows.map((r) => ({
          label: r.asset,
          value: quadrant(r.famePct, r.uniquenessPct),
          evidence: 'measured' as const,
          note: `Fame ${r.famePct}% · Uniqueness ${r.uniquenessPct}% — both supplied, not measured here.`,
        }))
    ),
  },
];
