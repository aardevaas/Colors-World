/**
 * What the registry actually does when it meets state.
 *
 * Two things are being defended here. First, that the split state model pays
 * off: a visitor with no account and no project gets a real book out of §3 and
 * §4, because those read the URL-shaped System. Second, that `validate` is not
 * decoration — each check is exercised against state that should trip it and
 * state that should not.
 */

import { describe, expect, it } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import { component, renderBook, validateBook } from '../registry';
import { ANONYMOUS_EMPTY, approval, mark, projectWith, stateOf, systemWith } from './fixtures';

/** A palette with plenty of contrast between its extremes. */
const READABLE = ['#0A0A0B', '#F5F5F7', '#3B6CF6', '#8A8A93'];

describe('an anonymous visitor with nothing', () => {
  it('renders the whole book without an account', () => {
    expect(renderBook(ANONYMOUS_EMPTY)).toHaveLength(98);
  });

  it('shows colour as absent, and says what would fill it', () => {
    const block = component('colour.palette').render(ANONYMOUS_EMPTY);
    expect(block.kind).toBe('absent');
    if (block.kind === 'absent') expect(block.reason).toMatch(/No colours yet/);
  });

  it('still ships a typeface, because the System has one by default', () => {
    expect(component('type.families').render(ANONYMOUS_EMPTY).kind).toBe('present');
  });

  it('reports nothing wrong, because there is nothing to be wrong', () => {
    expect(validateBook(ANONYMOUS_EMPTY)).toEqual([]);
  });
});

describe('an anonymous visitor with a palette — the point of the split model', () => {
  const state = stateOf(systemWith(READABLE));

  it.each([
    'colour.palette',
    'colour.values',
    'colour.print',
    'colour.tints',
    'colour.surfaces',
    'colour.themes',
    'colour.contrast-pairs',
  ] as const)('renders %s with no project at all', (id) => {
    expect(state.project).toBeNull();
    expect(component(id).render(state).kind).toBe('present');
  });

  it('measures contrast rather than asserting it', () => {
    const block = component('colour.contrast-pairs').render(state);
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.evidence).toBe('measured');

    /*
     * The block is a MATRIX now, not a list of named pairs — one row per
     * background carrying every foreground on it, then two summary rows. So
     * the assertion is on the rows that state ratios: each must be a real
     * number with a WCAG band beside it, never prose.
     */
    const columns = block.entries.filter((e) => e.label.startsWith('On '));
    expect(columns.length).toBeGreaterThan(0);
    for (const entry of columns) {
      for (const cell of entry.value.split(' · ')) {
        expect(cell).toMatch(/^\w+ \d+\.\d{2} (AAA|AA|AA large|fail)$/);
      }
    }

    // And the summaries still count rather than claim.
    expect(block.entries.find((e) => e.label === 'Required pairs')?.value).toMatch(
      /^\d+ of \d+ reach AA$/
    );
  });

  it('says plainly that spot colours are not shipped', () => {
    const block = component('colour.print').render(state);
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    const spot = block.entries.find((e) => e.label === 'Spot colours');
    expect(spot?.note).toMatch(/licensed/i);
  });
});

describe('the palette anchor check', () => {
  it('warns when a palette has no anchor, because every scale derives from it', () => {
    const system = { ...systemWith(READABLE), anchorHex: null };
    const findings = component('colour.palette').validate!(stateOf(system));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toMatch(/no anchor is set/);
  });

  it('is silent once an anchor is set', () => {
    expect(component('colour.palette').validate!(stateOf(systemWith(READABLE)))).toEqual([]);
  });
});

describe('the contrast check', () => {
  it('fails a palette whose text and background are too close', () => {
    const findings = component('colour.contrast-pairs').validate!(
      stateOf(systemWith(['#777777', '#7A7A7A', '#808080']))
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.severity).toBe('fail');
    expect(findings[0]!.expected).toBe('≥ 4.5:1');
  });

  it('passes a readable one', () => {
    expect(component('colour.contrast-pairs').validate!(stateOf(systemWith(READABLE)))).toEqual([]);
  });
});

describe('the text-spacing check', () => {
  it('warns when body line height is below the 1.5 a reader may force', () => {
    const system = { ...EMPTY_SYSTEM, type: { ...EMPTY_SYSTEM.type, lineHeight: 1.2 } };
    const findings = component('type.text-spacing').validate!(stateOf(system));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.measured).toBe('1.20');
  });

  it('is silent at the shipped default of 1.55', () => {
    expect(component('type.text-spacing').validate!(ANONYMOUS_EMPTY)).toEqual([]);
  });
});

describe('the logo format check', () => {
  it('warns that nothing can be derived from a raster mark', () => {
    const state = stateOf(EMPTY_SYSTEM, projectWith({ assets: [mark({ format: 'png' })] }));
    const findings = component('logo.primary').validate!(state);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toMatch(/cannot be derived/);
    expect(findings[0]!.expected).toBe('SVG');
  });

  it('is silent for a vector mark', () => {
    const state = stateOf(EMPTY_SYSTEM, projectWith({ assets: [mark()] }));
    expect(component('logo.primary').validate!(state)).toEqual([]);
  });
});

describe('the approvals check — governance the sample found nobody shipping', () => {
  it('warns when sign-off is pinned to a version that is no longer current', () => {
    const state = stateOf(
      EMPTY_SYSTEM,
      projectWith({ versionId: 'v3', approvals: [approval({ versionId: 'v2' })] })
    );
    const findings = component('gov.approvals').validate!(state);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.measured).toBe('v2');
    expect(findings[0]!.expected).toBe('v3');
  });

  it('is silent when the approval is against the current version', () => {
    const state = stateOf(EMPTY_SYSTEM, projectWith({ approvals: [approval()] }));
    expect(component('gov.approvals').validate!(state)).toEqual([]);
  });

  it('does not treat a pending approval as stale', () => {
    const state = stateOf(
      EMPTY_SYSTEM,
      projectWith({ versionId: 'v3', approvals: [approval({ versionId: 'v2', state: 'pending' })] })
    );
    expect(component('gov.approvals').validate!(state)).toEqual([]);
  });
});

describe('the asset naming lint', () => {
  const pattern = '^[a-z0-9-]+$';

  it('flags an asset that breaks the declared pattern', () => {
    const state = stateOf(
      EMPTY_SYSTEM,
      projectWith({
        data: { 'gov.taxonomy': { pattern } },
        assets: [mark({ label: 'Primary Mark FINAL v2.svg' })],
      })
    );
    const findings = component('gov.taxonomy').validate!(state);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.expected).toBe(pattern);
  });

  it('accepts an asset that matches', () => {
    const state = stateOf(
      EMPTY_SYSTEM,
      projectWith({ data: { 'gov.taxonomy': { pattern } }, assets: [mark({ label: 'logo-primary' })] })
    );
    expect(component('gov.taxonomy').validate!(state)).toEqual([]);
  });

  it('fails loudly rather than silently when the pattern is not a valid regex', () => {
    const state = stateOf(
      EMPTY_SYSTEM,
      projectWith({ data: { 'gov.taxonomy': { pattern: '[' } }, assets: [mark()] })
    );
    const findings = component('gov.taxonomy').validate!(state);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('fail');
  });
});

describe('the colour-vision check on chart palettes', () => {
  it('warns when two series would read as one', () => {
    const findings = component('colour.dataviz').validate!(
      stateOf(systemWith(['#D62728', '#2CA02C']))
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.message).toMatch(/read as one/);
  });

  it('passes a palette that stays apart', () => {
    expect(
      component('colour.dataviz').validate!(stateOf(systemWith(['#0A0A0B', '#F5F5F7'])))
    ).toEqual([]);
  });
});

describe('every finding carries a number', () => {
  /*
   * The discipline that separates this from a linter with opinions: a check
   * that reports a problem without a measurement or a threshold is an
   * assertion wearing a check's clothes, and this product's whole claim is the
   * difference between those two things.
   */
  it('reports nothing without either what was measured or what was expected', () => {
    const state = stateOf(
      systemWith(['#777777', '#7A7A7A', '#808080']),
      projectWith({
        versionId: 'v3',
        assets: [mark({ format: 'png', label: 'BAD NAME' })],
        approvals: [approval({ versionId: 'v1' })],
        data: { 'gov.taxonomy': { pattern: '^[a-z-]+$' } },
      })
    );
    const findings = validateBook(state);
    expect(findings.length).toBeGreaterThan(3);
    for (const f of findings) {
      expect(
        f.measured !== undefined || f.expected !== undefined,
        `${f.componentId}: "${f.message}"`
      ).toBe(true);
    }
  });
});

describe('stored but empty is still absent', () => {
  /*
   * The failure mode a "view, not container" book has to avoid: data exists in
   * the store, so something looks filled in, but there is nothing to show. A
   * present block with no entries is a heading over a blank space, and it is
   * how completeness numbers start lying.
   */
  it('renders a component whose stored data yields no entries as absent', () => {
    const state = stateOf(EMPTY_SYSTEM, projectWith({ data: { 'logo.architecture': {} } }));
    const block = component('logo.architecture').render(state);
    expect(block.kind).toBe('absent');
  });

  it('renders it as present once the stored data says something', () => {
    const state = stateOf(
      EMPTY_SYSTEM,
      projectWith({ data: { 'logo.architecture': { model: 'endorsed' } } })
    );
    const block = component('logo.architecture').render(state);
    expect(block.kind).toBe('present');
    if (block.kind === 'present') expect(block.entries[0]!.value).toBe('endorsed');
  });

  it('shows authored prose once it is written, labelled as declared', () => {
    const state = stateOf(
      EMPTY_SYSTEM,
      projectWith({ text: { 'brand.story': 'We began in a shed.' } })
    );
    const block = component('brand.story').render(state);
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.evidence).toBe('declared');
    expect(block.entries).toEqual([{ label: 'Story', value: 'We began in a shed.' }]);
  });
});

describe('the chart palette renders its own colour-vision result', () => {
  it('names the pairs that collapse, with the measured distance', () => {
    const block = component('colour.dataviz').render(
      stateOf(systemWith(['#D62728', '#2CA02C']))
    );
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    const check = block.entries.find((e) => e.label === 'Colour-vision check');
    expect(check?.value).toMatch(/collapses?$/);
    expect(check?.note).toMatch(/our judgement, not a published requirement/);
    expect(block.entries.some((e) => /ΔE \d\.\d{3} under/.test(e.value))).toBe(true);
  });

  it('says so plainly when every pair stays apart', () => {
    const block = component('colour.dataviz').render(
      stateOf(systemWith(['#0A0A0B', '#F5F5F7']))
    );
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.entries.find((e) => e.label === 'Colour-vision check')?.value).toMatch(
      /stay apart/
    );
  });
});

describe('the book renders the polarity the System is authored in', () => {
  /*
   * Light mode is not a swap of palette members — `flipPolarity` mirrors
   * lightness (l → 1 - l), so a light background is a *computed* colour rather
   * than one of the hexes the person picked. Asserted as the property that
   * matters (it is light, and it is not the dark-mode answer) rather than as a
   * literal hex, which would pin the mirror's arithmetic rather than the rule.
   */
  const PALETTE = ['#0A0A0B', '#F5F5F7', '#3B6CF6'];

  function backgroundOf(mode: 'light' | 'dark'): string {
    const block = component('colour.themes').render(stateOf(systemWith(PALETTE, { mode })));
    if (block.kind !== 'present') throw new Error('expected colour.themes to render');
    return block.entries.find((e) => e.label === 'Background')!.value;
  }

  it('reports which polarity it was authored in', () => {
    const block = component('colour.themes').render(
      stateOf(systemWith(PALETTE, { mode: 'light' }))
    );
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.entries.find((e) => e.label === 'Authored in')?.value).toBe('light');
  });

  it('renders a light background in light mode and a dark one in dark mode', () => {
    expect(parseColor(backgroundOf('light')).l).toBeGreaterThan(0.5);
    expect(parseColor(backgroundOf('dark')).l).toBeLessThan(0.5);
  });

  it('does not render the same background for both polarities', () => {
    expect(backgroundOf('light')).not.toBe(backgroundOf('dark'));
  });
});

describe('the book states the face you chose, not the preset', () => {
  /*
   * The room can override any role with a family from the open catalogue. If
   * §4 kept printing the preset's name next to type set in something else, the
   * guideline would be stating something untrue about itself — which is the
   * exact class of error the whole product exists to prevent.
   */
  const withBody = (slug: string) =>
    stateOf({ ...EMPTY_SYSTEM, type: { ...EMPTY_SYSTEM.type, families: { body: slug } } });

  it('names the chosen family in Typefaces', () => {
    const block = component('type.families').render(withBody('lora'));
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.entries.find((e) => e.label === 'Body')?.value).toBe('Lora');
    // Display was not overridden, so it stays on the preset.
    expect(block.entries.find((e) => e.label === 'Display')?.value).toBe('Unbounded');
  });

  it('falls back within the chosen family’s own category', () => {
    // Lora is a serif; the preset body is a sans. A serif falling back to a
    // sans is a different page, so the stack has to follow the face.
    const block = component('type.fallbacks').render(withBody('lora'));
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.entries.find((e) => e.label === 'Body')?.value).toMatch(/^"Lora", Georgia/);
  });

  it('reports the chosen family’s real weights, not the preset’s', () => {
    const block = component('type.weights').render(withBody('lora'));
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.entries.find((e) => e.label === 'Available')?.value).toBe('400–700 on an axis');
  });

  it('states the chosen family’s licence', () => {
    const block = component('type.licensing').render(withBody('lora'));
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.entries.some((e) => e.value.includes('Lora'))).toBe(true);
  });

  it('ignores a slug that is not in the catalogue, keeping the preset', () => {
    const block = component('type.families').render(withBody('not-a-real-font'));
    expect(block.kind).toBe('present');
    if (block.kind !== 'present') return;
    expect(block.entries.find((e) => e.label === 'Body')?.value).toBe('Plus Jakarta Sans');
  });
});
