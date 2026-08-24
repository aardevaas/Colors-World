/**
 * The Project — the half of Layer 1 that cannot fit in a URL.
 *
 * The System (`src/lib/system/types.ts`) models seven query parameters and is
 * all colour and typography. That shape is deliberate and worth keeping: a
 * whole design system travels in a link, with no account and no database
 * write per visitor. A logo is a file. Photography direction has reference
 * images. Voice and values are paragraphs. The moment the book holds any of
 * those, the URL model breaks.
 *
 * So the model is split rather than moved. The System stays anonymous,
 * instant and link-shareable forever; the Project is what an account buys.
 * The Book renders both, and a component declares which store it reads via
 * `storage` on its contract.
 *
 * This module is the *shape* the registry reads, not the persistence layer.
 * No Supabase, no fetch, no React — the same discipline the System half keeps.
 */

import type { System } from '@/lib/system/types';
import type { ComponentId } from './ids';

/** What someone may do inside a project. */
export type ProjectRole = 'owner' | 'editor' | 'reviewer' | 'viewer';

export interface ProjectMember {
  readonly userId: string;
  readonly role: ProjectRole;
}

/**
 * A file held for the brand: a mark, a reference image, a document.
 *
 * `kind` is narrow on purpose. `mark` is what M1 derives rules from and it is
 * the only kind with computable geometry, so the difference between a mark and
 * a photograph is not cosmetic — it decides whether clear space, minimum size
 * and background safety can be computed at all.
 */
export type AssetKind = 'mark' | 'image' | 'font' | 'document';

/** Vector marks are the only ones M1 can derive geometry from. */
export type AssetFormat = 'svg' | 'png' | 'jpg' | 'webp' | 'pdf' | 'woff2' | 'other';

export interface BrandAsset {
  readonly id: string;
  readonly kind: AssetKind;
  readonly format: AssetFormat;
  readonly url: string;
  /** Author-supplied label: "Primary mark", "Reversed", "App icon". */
  readonly label: string;
  /**
   * Which component this asset answers. An upload with no component is still a
   * legitimate DAM entry — `gov.dam` renders those — it just unlocks nothing.
   */
  readonly componentId?: ComponentId;
  /** Intrinsic size in px, when known. Absent for formats without one. */
  readonly width?: number;
  readonly height?: number;
  readonly addedAt: number;
}

/**
 * An approval on one component, at one point in the version history.
 *
 * Pinned to `versionId` because an approval that floats is worthless: the
 * whole reason 32% of real brand books carry an approval section is that
 * someone needs to know *which* version legal signed off on.
 */
export interface Approval {
  readonly componentId: ComponentId;
  readonly versionId: string;
  readonly userId: string;
  readonly state: 'pending' | 'approved' | 'rejected';
  readonly note?: string;
  readonly decidedAt: number;
}

/**
 * Authored prose, keyed by component.
 *
 * Flat rather than a per-component nested shape, for the same reason
 * `PaletteSnapshot` is flat: every consumer that exports the book wants a map
 * it can walk without knowing the taxonomy.
 */
export type AuthoredText = Readonly<Partial<Record<ComponentId, string>>>;

/**
 * Structured (non-prose) values a component produces, keyed by component.
 *
 * Validated at write time against the component's `produces` schema. Kept
 * separate from `text` so that "did the author write anything" and "is there
 * structured data" never have to be distinguished by inspecting a string.
 */
export type AuthoredData = Readonly<Partial<Record<ComponentId, unknown>>>;

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly ownerId: string;
  /** Present because collaboration is in scope; a solo project has one member. */
  readonly members: readonly ProjectMember[];
  readonly assets: readonly BrandAsset[];
  readonly text: AuthoredText;
  readonly data: AuthoredData;
  readonly approvals: readonly Approval[];
  /**
   * The version this project's book currently renders. The versioning DAG
   * already exists (`src/lib/versioning`); this is the pin into it, and it is
   * what an `Approval` refers to.
   */
  readonly versionId: string;
  readonly createdAt: number;
}

/**
 * A project paired with the System it holds.
 *
 * Multi-project is in scope, so a System is no longer singular: each project
 * carries its own. The URL codec still round-trips a bare System, which is
 * what keeps anonymous sharing working unchanged.
 */
export interface StoredProject {
  readonly project: Project;
  readonly system: System;
}

/** The first asset of kind `mark`, which is what M1 derives from. */
export function primaryMark(project: Project | null): BrandAsset | null {
  if (!project) return null;
  return (
    project.assets.find((a) => a.kind === 'mark' && a.componentId === 'logo.primary') ??
    project.assets.find((a) => a.kind === 'mark') ??
    null
  );
}

/** Assets belonging to one component. */
export function assetsFor(
  project: Project | null,
  componentId: ComponentId
): readonly BrandAsset[] {
  if (!project) return [];
  return project.assets.filter((a) => a.componentId === componentId);
}

/**
 * Authored prose for a component, or null.
 *
 * Whitespace-only counts as absent. Someone who opened a field, typed a space
 * and left has not authored anything, and a book that claims otherwise is the
 * completeness-theatre this product is supposed to avoid.
 */
export function textFor(project: Project | null, componentId: ComponentId): string | null {
  const raw = project?.text[componentId];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Structured data for a component, or null. */
export function dataFor(project: Project | null, componentId: ComponentId): unknown {
  return project?.data[componentId] ?? null;
}

/** The approval state of one component, or null when never submitted. */
export function approvalFor(
  project: Project | null,
  componentId: ComponentId
): Approval | null {
  if (!project) return null;
  const forComponent = project.approvals.filter((a) => a.componentId === componentId);
  if (forComponent.length === 0) return null;
  return forComponent.reduce((latest, a) => (a.decidedAt > latest.decidedAt ? a : latest));
}
