import { describe, expect, it } from 'vitest';
import { SECONDARY_ROUTES, TABS, tabById, type TabId } from '../tabs';

describe('tab manifest', () => {
  it('is ordered as the work is actually done', () => {
    // The count was never the invariant -- the sequence is. A person reading
    // the nav should be able to infer the workflow without being told it:
    // find a color, make a palette from it, deepen each color into a scale,
    // prove it on real UI and real type, then assemble. Reordering these is a
    // product decision and should have to come through this test.
    expect(TABS.map((t) => t.id)).toEqual([
      'library',
      'compose',
      'scales',
      'visualizer',
      'typography',
      'studio',
    ]);
  });

  it('puts making a palette before refining one', () => {
    // The split that created Compose: generating a palette and deepening a
    // color are different altitudes, and the generator used to be a strip in
    // the margin of the room named after the refining.
    const ids = TABS.map((t) => t.id);
    expect(ids.indexOf('compose')).toBeLessThan(ids.indexOf('scales'));
  });

  it('gives every tab a unique id and a unique href', () => {
    expect(new Set(TABS.map((t) => t.id)).size).toBe(TABS.length);
    expect(new Set(TABS.map((t) => t.href)).size).toBe(TABS.length);
  });

  it('routes every tab at its own top-level path', () => {
    for (const tab of TABS) {
      expect(tab.href).toBe(`/${tab.id}`);
    }
  });

  it('never collides with a secondary route', () => {
    const tabHrefs = new Set(TABS.map((t) => t.href));
    for (const route of SECONDARY_ROUTES) {
      expect(tabHrefs.has(route.href)).toBe(false);
    }
  });

  it('resolves every tab by id', () => {
    for (const tab of TABS) expect(tabById(tab.id)).toBe(tab);
  });

  it('throws on an unknown id rather than returning undefined', () => {
    expect(() => tabById('nope' as TabId)).toThrow();
  });

  // The regression guard for the bug that made TabNav necessary: the nav must
  // render every tab, so one can never again be built with nowhere to appear.
  // Unbuilt tabs are marked, not omitted.
  it('keeps the built flag on every tab so an unbuilt one can never be dropped', () => {
    // The sixth tab has now been added, which is exactly the moment this was
    // written for.
    expect(TABS.every((t) => typeof t.built === 'boolean')).toBe(true);
    expect(TABS.filter((t) => !t.built)).toEqual([]);
  });
});
