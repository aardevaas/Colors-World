/**
 * Readiness — what can be done now, and in what order.
 *
 * Sixty-five empty boxes teaches nothing and demoralises everyone; a
 * completeness percentage is worse, because 3% of 80 is hostile to the largest
 * group this product will ever have — the person who wanted a palette. So the
 * book never shows a checklist. It shows at most three things that are
 * unlockable right now, and it is right about the order because the dependency
 * graph is real data rather than a hand-maintained list.
 *
 * The ordering is the part worth defending. Suggestions are ranked by how many
 * of the 25 sampled brand books contain the component, so the top of the list
 * is not an opinion: `logo.primary` at 22 of 25 outranks everything, then
 * `type.families` at 20, then `colour.palette` at 18. The three most universal
 * components in real brand books are the three the product suggests first.
 */

import { REGISTRY, component } from './registry';
import type { BrandComponent, BrandState, ComponentId } from './types';

/** The most suggestions shown at once. Three, deliberately. */
export const MAX_SUGGESTIONS = 3;

/**
 * Whether a component has anything in it.
 *
 * Defined as "its own renderer produced a present block", not as a separate
 * completeness flag. One source of truth: if the book shows it, it is done,
 * and there is no way for a progress marker to disagree with the page.
 */
export function isPresent(componentId: ComponentId, state: BrandState): boolean {
  return component(componentId).render(state).kind === 'present';
}

/** True when every prerequisite is present. */
export function isUnlocked(c: BrandComponent, state: BrandState): boolean {
  return c.requires.every((r) => isPresent(r, state));
}

/**
 * Components that could be done right now: not present, nothing blocking them.
 *
 * Ranked by observed frequency, then by section, then by id — so the order is
 * stable and reproducible rather than dependent on registry insertion order.
 */
export function unlockable(
  state: BrandState,
  limit: number = MAX_SUGGESTIONS
): readonly BrandComponent[] {
  return REGISTRY.filter((c) => !isPresent(c.id, state) && isUnlocked(c, state))
    .slice()
    .sort(
      (a, b) =>
        b.provenance.frequency - a.provenance.frequency ||
        a.section - b.section ||
        a.id.localeCompare(b.id)
    )
    .slice(0, limit);
}

/** Components waiting on something else. The rest of the graph, unranked. */
export function blocked(state: BrandState): readonly BrandComponent[] {
  return REGISTRY.filter((c) => !isPresent(c.id, state) && !isUnlocked(c, state));
}

/** Everything that directly names this component as a prerequisite. */
export function dependents(componentId: ComponentId): readonly BrandComponent[] {
  return REGISTRY.filter((c) => c.requires.includes(componentId));
}

/**
 * How many components a single component would unlock, counting the whole
 * chain rather than only its direct dependents.
 *
 * This is the number behind "the logo is the biggest unlock in the graph", and
 * it is computed rather than asserted so the claim survives the taxonomy
 * changing under it.
 */
export function unlockCount(componentId: ComponentId): number {
  const reached = new Set<ComponentId>();
  const queue: ComponentId[] = [componentId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const d of dependents(current)) {
      if (!reached.has(d.id)) {
        reached.add(d.id);
        queue.push(d.id);
      }
    }
  }
  return reached.size;
}
