import { describe, expect, it } from 'vitest';
import { SECONDARY_ROUTES, TABS, tabById, type TabId } from '../tabs';

describe('tab manifest', () => {
  it('has exactly the five tabs the product is built around', () => {
    expect(TABS).toHaveLength(5);
    expect(TABS.map((t) => t.id)).toEqual([
      'library',
      'builder',
      'studio',
      'visualizer',
      'typography',
    ]);
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

  it('resolves a tab by id', () => {
    expect(tabById('studio').label).toBe('studio');
  });

  it('throws on an unknown id rather than returning undefined', () => {
    expect(() => tabById('nope' as TabId)).toThrow();
  });

  // This is the regression guard for the bug that made TabNav necessary: the
  // nav must always render all five, so a tab can never again be built with
  // nowhere to appear. Unbuilt tabs are marked, not omitted.
  it('keeps the built flag on every tab so an unbuilt one can never be dropped', () => {
    // All five now ship. The flag stays because the failure it guards against
    // — building a tab with nowhere to appear — returns the moment a sixth is
    // added and someone omits it from the nav rather than marking it.
    expect(TABS.every((t) => typeof t.built === 'boolean')).toBe(true);
    expect(TABS.filter((t) => !t.built)).toEqual([]);
  });
});
