/**
 * The component contract — Layer 2, between what the brand *is* and what does
 * work to it.
 *
 * A component is not a checklist row. If it were, every scope would need its
 * own bespoke rendering of the same item and scopes would be templates again
 * by the back door. Each component owns exactly one renderer, so a scope is
 * genuinely just a set of ids.
 *
 * Pure data and pure functions: no React, no DOM, no fetch. `render` returns a
 * `BookBlock` — a description of what the book should show — and the Book
 * surface is what turns that into elements. That separation is what lets the
 * same component render to a web page, a PDF and a token file without knowing
 * any of them exist.
 */

import type { System } from '@/lib/system/types';
import type { ComponentId, SectionId } from './ids';
import type { Project } from './project';

export type { ComponentId, SectionId };

/** The six machines. One machine serves many components; that is the point. */
export type MachineId =
  | 'M1' // Ingest & Derive — take an uploaded asset, compute rules from it
  | 'M2' // Compute & Verify — the engine: measure, check, prove
  | 'M3' // Author (guided) — structured writing, never an empty box
  | 'M4' // Direct (axes) — set direction on named axes, produce a spec
  | 'M5' // Template & Compose — token-driven layouts with safe zones
  | 'M6'; // Govern — versioning, taxonomy, naming, licences, changelog

/**
 * How strong is the *rule* this component states.
 *
 * This field is the product's identity. Every other brand book asserts "blue
 * conveys trust" with the same confidence as "our hex is #0A5CFF"; one of
 * those is a fact and one is folklore. Cheap to build, impossible to fake.
 */
export type Evidence =
  | 'measured' // we computed it and can re-verify it: "5.82:1 — passes AA"
  | 'cited' // research supports it and the citation is shown
  | 'declared'; // you decided it, and no claim of evidence is made

/** How strong is our reason for *including the component at all*. */
export type ProvenanceOrigin =
  | 'founder' // on the original list, never externally checked
  | 'observed' // found in published brand books
  | 'derived' // from the practitioner reference, or implied by an observed section
  | 'proposed'; // ours, argued, not yet seen in the wild

/**
 * Where a component's data lives, under the split state model.
 *
 * The System is URL-shaped — a whole colour and type system fits in a link
 * with no account and no database, which is the product's best growth
 * property and worth protecting. A logo is a file and voice is paragraphs;
 * neither fits in a URL, so those live in a Project behind an account.
 *
 * `none` is for components that state a rule without storing anything of their
 * own — they read other components' state and present it.
 */
export type StorageTarget = 'system' | 'project' | 'none';

/**
 * Where a component's inclusion came from, and how often it was actually seen.
 *
 * `frequency` and `sectors` are *derived* from `observedAs` against
 * `docs/research/brand-book-sample.json`. They are written out here so a
 * reader sees the number where the decision is made, and a test recomputes
 * both from the sample and fails on any drift. That combination is the whole
 * reason this field exists: version 1 of the taxonomy was transcribed, looked
 * externally grounded, and was not.
 */
export interface Provenance {
  readonly origin: ProvenanceOrigin;
  /**
   * The research ids in the sample whose observation supports this component.
   * Usually one. Empty when nothing in the 25 books corresponds — which is a
   * real and reportable state, not a gap to paper over.
   *
   * Two components may cite the same research id when a single observed
   * section carries both rules (`colour.values-mediums` covers screen values
   * and print mapping). The observation is not split, so both inherit the same
   * count; `sharedObservation` marks it so the number is never read as two
   * independent sightings.
   */
  readonly observedAs: readonly string[];
  /** Books, of the 25 real ones, containing any id in `observedAs`. */
  readonly frequency: number;
  /** Distinct sectors, of 13, that those books span. */
  readonly sectors: number;
  /** Prescribed by Wheeler's practitioner composite. */
  readonly wheeler: boolean;
  /** True when `observedAs` is shared with another component. */
  readonly sharedObservation?: boolean;
  /**
   * Manuals in `docs/research/internal-grain-sample.json` that state this
   * sub-rule explicitly.
   *
   * A SECOND, FINER evidence base than `observedAs`, and the two must never be
   * mixed. `observedAs` keys into the 25-book study, which recorded which
   * *sections* a guideline contains; this keys into the grain study, which
   * recorded which *rules* a section states. The first was blind to depth —
   * `colour.palette` scored the same for a manual giving one hex as for one
   * giving hex, RGB, CMYK, Pantone, tints, proportions, pairings and misuse.
   * That blindness is why the taxonomy had to be re-cut.
   */
  readonly grainSources?: readonly string[];
  /** Why this component exists, when the count alone does not explain it. */
  readonly note?: string;
}

/**
 * A narrow structural subset of JSON Schema — enough to describe what a
 * component adds to Layer 1, without taking a dependency to say it.
 */
export interface JsonSchema {
  readonly type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly items?: JsonSchema;
  readonly required?: readonly string[];
  readonly enum?: readonly string[];
}

/** One labelled fact in the rendered book. */
export interface BookEntry {
  readonly label: string;
  readonly value: string;
  /**
   * Overrides the component's evidence for this line only. A swatch legitimately
   * mixes both: the hex is `declared` (you chose it), the contrast ratio beside
   * it is `measured`. Omit unless the line genuinely differs.
   */
  readonly evidence?: Evidence;
  readonly note?: string;
  /**
   * Makes the value a link.
   *
   * Rare on purpose — the book is a document, not a control panel. It exists
   * for the one case where a rule cannot be checked until someone states it,
   * and the alternative is telling a reader to hand-edit a query string. A
   * bare `?query` href resolves against whatever page is rendering, so the
   * registry states no route.
   */
  readonly href?: string;
}

/**
 * What a component renders to.
 *
 * `absent` is a first-class result, not an error. The book is a view: it shows
 * what exists at this moment, and a component with no data yet says so and
 * says what would fill it. That is what lets someone with only a palette get a
 * legitimate, shippable book without a mode switch or a 3%-complete banner.
 */
export type BookBlock =
  | {
      readonly kind: 'absent';
      readonly id: ComponentId;
      readonly title: string;
      /** What is missing, in the reader's terms. Shown, so make it useful. */
      readonly reason: string;
    }
  | {
      readonly kind: 'present';
      readonly id: ComponentId;
      readonly title: string;
      readonly evidence: Evidence;
      readonly entries: readonly BookEntry[];
    };

export type Severity = 'fail' | 'warn' | 'info';

/** Something `validate` found. The book checking itself, in one record. */
export interface Finding {
  readonly componentId: ComponentId;
  readonly severity: Severity;
  readonly message: string;
  /** What we measured, formatted for a human: "5.82:1". */
  readonly measured?: string;
  /** What it needed to be: "≥ 4.5:1". */
  readonly expected?: string;
}

/**
 * Everything a component may read.
 *
 * Both halves of the split model in one argument, so a component never has to
 * know which store it came from. `project` is null for an anonymous visitor —
 * the majority case, and the one the whole URL-shaped System exists to serve.
 */
export interface BrandState {
  readonly system: System;
  readonly project: Project | null;
}

export interface BrandComponent {
  readonly id: ComponentId;
  /** The label the book prints. Sentence case, no section number. */
  readonly name: string;
  readonly section: SectionId;
  /**
   * The readiness graph, declared as data. This is what turns "what can I do
   * now?" into a graph traversal instead of a hand-maintained list that drifts
   * out of step with the code that actually gates things.
   */
  readonly requires: readonly ComponentId[];
  readonly machine: MachineId;
  readonly storage: StorageTarget;
  /** What this adds to Layer 1 when it is filled in. */
  readonly produces: JsonSchema;
  readonly evidence: Evidence;
  readonly provenance: Provenance;
  /** One renderer, every scope. */
  render(state: BrandState): BookBlock;
  /** Only where a check is actually possible. Most components cannot. */
  validate?(state: BrandState): readonly Finding[];
}
