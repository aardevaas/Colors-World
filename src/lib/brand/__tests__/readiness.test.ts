/**
 * Readiness, and two claims it does not support.
 *
 * The point of declaring `requires` as data rather than implying it in code is
 * that claims about the graph become checkable. Two claims in the planning
 * documents get checked here, and one of them does not survive:
 *
 * - "One logo upload opens six sections" — **true**, exactly six within §2.
 * - "The logo is the biggest single unlock in the graph" — **false as the
 *   graph is declared.** The palette reaches more components than the mark.
 *
 * Both numbers are asserted below so that if the taxonomy changes under them,
 * the claim fails here rather than quietly becoming wrong in a document.
 */

import { describe, expect, it } from 'vitest';
import { REGISTRY, component } from '../registry';
import {
  MAX_SUGGESTIONS,
  blocked,
  dependents,
  isPresent,
  isUnlocked,
  unlockCount,
  unlockable,
} from '../readiness';
import { ANONYMOUS_EMPTY, mark, projectWith, stateOf, systemWith } from './fixtures';

describe('what an empty System already has', () => {
  it('shows typography as present, because the System ships a default type system', () => {
    const present = REGISTRY.filter((c) => isPresent(c.id, ANONYMOUS_EMPTY)).map((c) => c.id);
    /*
     * Order is COMPONENT_IDS order, which is book order — see registry/index.ts.
     * Thirteen of §4's eighteen render from the System's defaults alone, because
     * a type system is never empty the way a palette is: there is always a
     * preset, a scale and a line height. That asymmetry is real and the Book
     * should not pretend otherwise.
     */
    expect(present).toEqual([
      'type.families',
      'type.sources',
      // Renders since 2026-08-24: the catalogue carries a per-family licence,
      // so the guideline states terms instead of shrugging at them.
      'type.licensing',
      'type.fallbacks',
      'type.weights',
      'type.metrics',
      'type.hierarchy',
      'type.lineheight',
      'type.tracking',
      'type.measure',
      'type.minimums',
      'type.text-spacing',
      'type.misuse',
    ]);
  });
});

describe('suggestions', () => {
  it('never shows more than three', () => {
    expect(unlockable(ANONYMOUS_EMPTY).length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    expect(MAX_SUGGESTIONS).toBe(3);
  });

  it('ranks by how many real brand books contain the component', () => {
    const top = unlockable(ANONYMOUS_EMPTY, 3);
    expect(top.map((c) => c.id)).toEqual(['logo.primary', 'colour.palette', 'gov.legal-ip']);
    const frequencies = top.map((c) => c.provenance.frequency);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => b - a));
  });

  it('never suggests something already present', () => {
    for (const c of unlockable(ANONYMOUS_EMPTY, 80)) {
      expect(isPresent(c.id, ANONYMOUS_EMPTY), c.id).toBe(false);
    }
  });

  it('never suggests something still blocked', () => {
    for (const c of unlockable(ANONYMOUS_EMPTY, 80)) {
      expect(isUnlocked(c, ANONYMOUS_EMPTY), c.id).toBe(true);
    }
  });

  it('is stable — the same state suggests the same three', () => {
    expect(unlockable(ANONYMOUS_EMPTY).map((c) => c.id)).toEqual(
      unlockable(ANONYMOUS_EMPTY).map((c) => c.id)
    );
  });

  it('partitions the registry into present, unlockable and blocked with nothing left over', () => {
    const present = REGISTRY.filter((c) => isPresent(c.id, ANONYMOUS_EMPTY)).length;
    const open = unlockable(ANONYMOUS_EMPTY, REGISTRY.length).length;
    expect(present + open + blocked(ANONYMOUS_EMPTY).length).toBe(REGISTRY.length);
  });
});

describe('the graph moves when state does', () => {
  it('stops suggesting the palette once there is one, and starts suggesting what it unlocked', () => {
    const before = unlockable(ANONYMOUS_EMPTY, 80).map((c) => c.id);
    const after = unlockable(stateOf(systemWith(['#0A0A0B', '#F5F5F7'])), 80).map((c) => c.id);
    expect(before).toContain('colour.palette');
    expect(after).not.toContain('colour.palette');
    expect(before).not.toContain('imagery.dataviz');
    expect(after).toContain('imagery.dataviz');
  });

  it('opens §2 the moment a mark is uploaded', () => {
    const state = stateOf(systemWith(['#0A0A0B', '#F5F5F7']), projectWith({ assets: [mark()] }));
    const open = unlockable(state, 80).map((c) => c.id);
    expect(open).toEqual(
      expect.arrayContaining([
        'logo.clear-space',
        'logo.min-size',
        'logo.variants',
        'logo.misuse',
        'logo.placement-backgrounds',
        'logo.construction',
      ])
    );
  });
});

describe('the two claims about the logo', () => {
  it('confirms one upload opens exactly six components in §2', () => {
    const inLogoSection = dependents('logo.primary')
      .filter((c) => c.section === 2)
      .map((c) => c.id)
      .sort();
    expect(inLogoSection).toEqual([
      'logo.clear-space',
      'logo.construction',
      'logo.min-size',
      'logo.misuse',
      'logo.placement-backgrounds',
      'logo.variants',
    ]);
  });

  it('contradicts "the biggest single unlock in the graph" — the palette reaches further', () => {
    /*
     * Measured, not argued. If the requires graph is rewritten and the logo
     * genuinely does become the largest unlock, this test fails and the claim
     * can be restored to the documents with a number behind it.
     */
    expect(unlockCount('logo.primary')).toBe(22);
    // 28 before §3 was re-cut to internal grain; the six new colour
    // sub-components all hang off the palette, so the gap widened.
    expect(unlockCount('colour.palette')).toBe(34);
    expect(unlockCount('colour.palette')).toBeGreaterThan(unlockCount('logo.primary'));
  });

  it('still makes the logo the first suggestion, because ranking follows the corpus', () => {
    expect(unlockable(ANONYMOUS_EMPTY)[0]!.id).toBe('logo.primary');
    expect(component('logo.primary').provenance.frequency).toBe(22);
  });
});

describe('unlockCount', () => {
  it('counts the whole chain, not only direct dependents', () => {
    // logo.variants is direct; logo.architecture hangs off it.
    expect(dependents('logo.primary').map((c) => c.id)).toContain('logo.variants');
    expect(dependents('logo.primary').map((c) => c.id)).not.toContain('logo.architecture');
    expect(unlockCount('logo.primary')).toBeGreaterThan(dependents('logo.primary').length);
  });

  it('is zero for a leaf nothing depends on', () => {
    expect(unlockCount('gov.metrics')).toBe(0);
  });
});
