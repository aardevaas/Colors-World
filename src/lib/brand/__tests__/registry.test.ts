/**
 * Structural integrity of the registry.
 *
 * These are the tests that stop a schema from rotting. A registry is only
 * useful if the id list, the section map and the components cannot drift apart
 * — and every one of those three has drifted at least once in the documents
 * this registry was built from.
 */

import { describe, expect, it } from 'vitest';
import { COMPONENT_IDS, SECTION_OF, type ComponentId } from '../ids';
import { REGISTRY, component, componentsInSection } from '../registry';
import { ANONYMOUS_EMPTY } from './fixtures';

describe('registry integrity', () => {
  it('holds exactly one component per declared id', () => {
    expect(REGISTRY).toHaveLength(COMPONENT_IDS.length);
    expect(new Set(REGISTRY.map((c) => c.id)).size).toBe(REGISTRY.length);
  });

  it('registers every declared id and nothing else', () => {
    const registered = new Set(REGISTRY.map((c) => c.id));
    const declared = new Set<ComponentId>(COMPONENT_IDS);
    expect([...declared].filter((id) => !registered.has(id))).toEqual([]);
    expect([...registered].filter((id) => !declared.has(id))).toEqual([]);
  });

  it('is the 80 components the reconciliation produced', () => {
    // 66 rows in the spec's taxonomy table + 13 observed ids that had no row
    // + 1 row split in two because the research keeps the halves apart.
    expect(REGISTRY).toHaveLength(80);
  });

  it('agrees with SECTION_OF on every component', () => {
    for (const c of REGISTRY) {
      expect(c.section, c.id).toBe(SECTION_OF[c.id]);
    }
  });

  it('covers all nine sections, none empty', () => {
    for (const section of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      expect(componentsInSection(section).length, `§${section}`).toBeGreaterThan(0);
    }
  });

  it('throws on an unregistered id rather than returning undefined', () => {
    expect(() => component('not.a.component' as ComponentId)).toThrow(/No component registered/);
  });
});

describe('the readiness graph', () => {
  it('names only real components in every requires list', () => {
    const known = new Set(REGISTRY.map((c) => c.id));
    for (const c of REGISTRY) {
      for (const r of c.requires) {
        expect(known.has(r), `${c.id} requires ${r}`).toBe(true);
      }
    }
  });

  it('has no component requiring itself', () => {
    for (const c of REGISTRY) {
      expect(c.requires, c.id).not.toContain(c.id);
    }
  });

  it('is acyclic', () => {
    const byId = new Map(REGISTRY.map((c) => [c.id, c]));
    const state = new Map<ComponentId, 'visiting' | 'done'>();
    const cycles: string[] = [];

    const walk = (id: ComponentId, trail: ComponentId[]): void => {
      const mark = state.get(id);
      if (mark === 'done') return;
      if (mark === 'visiting') {
        cycles.push([...trail, id].join(' → '));
        return;
      }
      state.set(id, 'visiting');
      for (const r of byId.get(id)?.requires ?? []) walk(r, [...trail, id]);
      state.set(id, 'done');
    };

    for (const c of REGISTRY) walk(c.id, []);
    expect(cycles).toEqual([]);
  });
});

describe('every contract is complete', () => {
  it('declares a machine, a storage target, evidence and provenance', () => {
    for (const c of REGISTRY) {
      expect(c.machine, c.id).toMatch(/^M[1-6]$/);
      expect(['system', 'project', 'none'], c.id).toContain(c.storage);
      expect(['measured', 'cited', 'declared'], c.id).toContain(c.evidence);
      expect(c.provenance, c.id).toBeDefined();
      expect(c.name.length, c.id).toBeGreaterThan(0);
    }
  });

  it('describes what it produces', () => {
    for (const c of REGISTRY) {
      expect(c.produces.type, c.id).toBeDefined();
    }
  });

  it('renders every component against an empty anonymous state without throwing', () => {
    for (const c of REGISTRY) {
      expect(() => c.render(ANONYMOUS_EMPTY), c.id).not.toThrow();
    }
  });

  it('runs every check against an empty anonymous state without throwing', () => {
    for (const c of REGISTRY) {
      expect(() => c.validate?.(ANONYMOUS_EMPTY), c.id).not.toThrow();
    }
  });

  it('never labels a rule measured when the component stores nothing to measure', () => {
    /*
     * A component may be `declared` and still carry a check: `logo.primary`'s
     * rule is "this is our mark", which you decided, while its check measures
     * a *precondition* — whether the file is vector. Rule and precondition are
     * different claims and the contract labels the rule.
     *
     * What must not happen is the reverse of that: a component claiming its
     * rule is measured while holding nothing of its own to measure it from.
     */
    for (const c of REGISTRY) {
      if (c.evidence === 'measured') {
        expect(c.storage, `${c.id} claims a measured rule but stores nothing`).not.toBe('none');
      }
    }
  });
});
