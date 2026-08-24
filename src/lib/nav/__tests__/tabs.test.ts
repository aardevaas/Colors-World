import { describe, expect, it } from 'vitest';
import { TABS, tabById, type TabId } from '../tabs';

describe('tab manifest', () => {
  it('is ordered as the work is actually done', () => {
    // The count was never the invariant -- the sequence is. A person reading
    // the nav should be able to infer the workflow without being told it:
    // find a color, make a palette from it, deepen each color into a scale,
    // prove it on real UI and real type, then write it down. Reordering these
    // is a product decision and should have to come through this test.
    //
    // `studio` left this list on 2026-08-24 and `brand` took its slot: the Book
    // replaces the wall as the place work comes together. `/studio` still
    // resolves, as a secondary route.
    expect(TABS.map((t) => t.id)).toEqual([
      'library',
      'compose',
      'scales',
      'visualizer',
      'typography',
      'brand',
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

  it('is exactly six rooms, which is the whole nav', () => {
    // The primary navigation is a closed set on purpose: every other route in
    // the app answers a bookmark, not an exploration.
    expect(TABS).toHaveLength(6);
    expect(new Set(TABS.map((t) => t.href)).size).toBe(6);
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
    /*
     * This used to also assert that NOTHING was unbuilt, which was a snapshot
     * of the state on the day it was written rather than the invariant the
     * comment above describes. `brand` is deliberately unbuilt today — the Book
     * ships in days 3-5 of roadmap v9 — and an unbuilt tab appearing here is
     * the flag doing its job, not a failure.
     *
     * The real invariant is that an unbuilt tab is still a full manifest entry,
     * so TabNav renders it as inert text instead of omitting it. Every field
     * has to be there for that to work.
     */
    for (const tab of TABS) {
      expect(typeof tab.built, tab.id).toBe('boolean');
      expect(tab.href, tab.id).toBe(`/${tab.id}`);
      expect(tab.label.length, tab.id).toBeGreaterThan(0);
    }
  });

  it('has every tab built', () => {
    /*
     * Deliberately a state assertion, separate from the invariant above. It
     * read `['brand']` from 2026-08-24 until the Book shipped later the same
     * day, which is exactly what it was written to catch. Add an unbuilt tab
     * and this fails until it is listed here on purpose.
     */
    expect(TABS.filter((t) => !t.built).map((t) => t.id)).toEqual([]);
  });
});
