/**
 * The registry — all 80 components, assembled.
 *
 * Layer 2 sits between what the brand *is* (Layer 1: the URL-shaped System and
 * the DB-backed Project) and the machines that do work to it (Layer 3). Both
 * neighbours depend on its shape, which is why the contract was settled before
 * any of it was written.
 *
 * The count deserves a sentence, because it is not the number the specification
 * states. `docs/BRAND-BOOK-SPEC.md` says 65; its own taxonomy table holds 66
 * rows. Thirteen ids that the 25-book study actually observed had no row at
 * all, and one row covered two ids the research keeps apart. 66 + 13 + 1 = 80.
 * See `../ids.ts` for the full account.
 */

import type { BookBlock, BrandComponent, BrandState, ComponentId, Finding, SectionId } from '../types';
import { COMPONENT_IDS, SECTION_OF } from '../ids';
import { SECTION_1 } from './section-1-strategy';
import { SECTION_2 } from './section-2-logo';
import { SECTION_3 } from './section-3-colour';
import { SECTION_4 } from './section-4-typography';
import { SECTION_5 } from './section-5-imagery';
import { SECTION_6 } from './section-6-web';
import { SECTION_7 } from './section-7-editorial';
import { SECTION_8 } from './section-8-collateral';
import { SECTION_9 } from './section-9-governance';

const DECLARED_ORDER = new Map<ComponentId, number>(COMPONENT_IDS.map((id, i) => [id, i]));

/**
 * Every component, in the order the book presents them.
 *
 * Sorted by `COMPONENT_IDS` rather than by the order the section files happen
 * to list them. Found by rendering §3 after the grain re-cut: the six new
 * components had been appended to the end of their file, so the book read
 * palette → … → contrast pairings → hierarchy → proportions, which is not an
 * order anyone would write a guideline in. `COMPONENT_IDS` is now the single
 * authority on sequence, and a component moves in the book by moving there.
 */
export const REGISTRY: readonly BrandComponent[] = [
  ...SECTION_1,
  ...SECTION_2,
  ...SECTION_3,
  ...SECTION_4,
  ...SECTION_5,
  ...SECTION_6,
  ...SECTION_7,
  ...SECTION_8,
  ...SECTION_9,
].sort((a, b) => (DECLARED_ORDER.get(a.id) ?? 0) - (DECLARED_ORDER.get(b.id) ?? 0));

const BY_ID: ReadonlyMap<ComponentId, BrandComponent> = new Map(
  REGISTRY.map((c) => [c.id, c])
);

/**
 * Look a component up.
 *
 * Throws rather than returning undefined: `ComponentId` is a closed union, so
 * a miss here means the registry and the id list have diverged, and that is a
 * broken build rather than a runtime condition to handle.
 */
export function component(id: ComponentId): BrandComponent {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`No component registered for id "${id}".`);
  return found;
}

export function componentsInSection(section: SectionId): readonly BrandComponent[] {
  return REGISTRY.filter((c) => c.section === section);
}

/** Every component, in book order, rendered against the current state. */
export function renderBook(state: BrandState): readonly BookBlock[] {
  return REGISTRY.map((c) => c.render(state));
}

/**
 * Everything the book can currently prove wrong about itself.
 *
 * This is the product's whole claim in one function: a brand book that
 * re-checks its own rules rather than reprinting what someone typed.
 */
export function validateBook(state: BrandState): readonly Finding[] {
  return REGISTRY.flatMap((c) => c.validate?.(state) ?? []);
}

/** Components whose contract carries a check at all. */
export function checkableComponents(): readonly BrandComponent[] {
  return REGISTRY.filter((c) => typeof c.validate === 'function');
}

export { COMPONENT_IDS, SECTION_OF };
