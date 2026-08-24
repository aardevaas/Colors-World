/**
 * The Project accessors, and the role-override path they feed.
 *
 * These are small functions, and small functions holding the difference
 * between "absent" and "present" are exactly where a book quietly starts
 * claiming things. The whitespace case below is the one that matters: someone
 * who opened a field, typed a space and left has not authored anything, and a
 * book that renders that as content is the completeness theatre this product
 * exists to avoid.
 */

import { describe, expect, it } from 'vitest';
import { parseColor } from '@/lib/color-engine';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import { approvalFor, assetsFor, dataFor, primaryMark, textFor } from '../project';
import { systemRoles } from '../colour';
import { approval, mark, projectWith, systemWith } from './fixtures';

describe('primaryMark', () => {
  it('is null without a project', () => {
    expect(primaryMark(null)).toBeNull();
  });

  it('prefers the mark that answers logo.primary', () => {
    const other = mark({ id: 'a2', componentId: undefined, label: 'Sketch' });
    const primary = mark({ id: 'a1' });
    expect(primaryMark(projectWith({ assets: [other, primary] }))?.id).toBe('a1');
  });

  it('falls back to any mark when none is assigned to logo.primary', () => {
    const loose = mark({ id: 'a9', componentId: undefined });
    expect(primaryMark(projectWith({ assets: [loose] }))?.id).toBe('a9');
  });

  it('ignores assets that are not marks', () => {
    const photo = mark({ id: 'p1', kind: 'image', componentId: undefined });
    expect(primaryMark(projectWith({ assets: [photo] }))).toBeNull();
  });
});

describe('assetsFor', () => {
  it('is empty without a project', () => {
    expect(assetsFor(null, 'logo.primary')).toEqual([]);
  });

  it('returns only the assets belonging to that component', () => {
    const project = projectWith({
      assets: [mark({ id: 'a1' }), mark({ id: 'a2', componentId: 'logo.variants' })],
    });
    expect(assetsFor(project, 'logo.variants').map((a) => a.id)).toEqual(['a2']);
  });
});

describe('textFor', () => {
  it('is null without a project', () => {
    expect(textFor(null, 'brand.story')).toBeNull();
  });

  it('is null when nothing was written', () => {
    expect(textFor(projectWith(), 'brand.story')).toBeNull();
  });

  it('treats whitespace as nothing written', () => {
    expect(textFor(projectWith({ text: { 'brand.story': '   \n  ' } }), 'brand.story')).toBeNull();
  });

  it('trims what was written', () => {
    expect(textFor(projectWith({ text: { 'brand.story': '  We began in a shed.  ' } }), 'brand.story')).toBe(
      'We began in a shed.'
    );
  });
});

describe('dataFor', () => {
  it('is null without a project', () => {
    expect(dataFor(null, 'gov.taxonomy')).toBeNull();
  });

  it('returns the stored value', () => {
    expect(dataFor(projectWith({ data: { 'web.grid': { basePx: 8 } } }), 'web.grid')).toEqual({
      basePx: 8,
    });
  });
});

describe('approvalFor', () => {
  it('is null without a project', () => {
    expect(approvalFor(null, 'colour.palette')).toBeNull();
  });

  it('is null when the component was never submitted', () => {
    expect(approvalFor(projectWith({ approvals: [approval()] }), 'logo.primary')).toBeNull();
  });

  it('returns the most recent decision, not the first', () => {
    const project = projectWith({
      approvals: [
        approval({ state: 'rejected', decidedAt: 1 }),
        approval({ state: 'approved', decidedAt: 9 }),
        approval({ state: 'pending', decidedAt: 5 }),
      ],
    });
    expect(approvalFor(project, 'colour.palette')?.state).toBe('approved');
  });
});

describe('systemRoles honours manual overrides', () => {
  /*
   * Written because no call site in the app passes overrides to deriveRoles —
   * they all map the palette inline and drop them. The book must show the
   * roles the person actually chose, so this path is exercised directly.
   */
  it('uses the overridden colour for that role', () => {
    const system = systemWith(['#0A0A0B', '#F5F5F7', '#3B6CF6'], {
      roleOverrides: { accent: '#FF00AA' },
    });
    expect(systemRoles(system).accent.hex).toBe('#FF00AA');
    expect(systemRoles(system).accent.oklch).toEqual(parseColor('#FF00AA'));
  });

  it('derives normally when there are no overrides', () => {
    const system = systemWith(['#0A0A0B', '#F5F5F7', '#3B6CF6']);
    expect(systemRoles(system).accent.hex).not.toBe('#FF00AA');
  });

  it('derives an empty palette without throwing', () => {
    expect(() => systemRoles(EMPTY_SYSTEM)).not.toThrow();
  });
});

describe('systemRoles follows the System’s polarity', () => {
  /*
   * `SystemProvider`'s roles memo (src/lib/system/system-context.tsx) derives
   * roles and *then* flips polarity for light mode, and every room renders
   * from it. This helper has to agree: if it does not, the book prints
   * different colours than the room the person just left — which is the exact
   * class of bug the one-shared-role-model rule exists to prevent.
   *
   * Asserted behaviourally rather than by comparing to flipPolarity, so this
   * still means something if the flip is ever implemented differently.
   */
  const PALETTE = ['#0A0A0B', '#F5F5F7', '#3B6CF6'];

  it('puts the light colour behind the dark one in light mode', () => {
    const roles = systemRoles(systemWith(PALETTE, { mode: 'light' }));
    expect(roles.background.oklch.l).toBeGreaterThan(roles.text.oklch.l);
  });

  it('puts the dark colour behind the light one in dark mode', () => {
    const roles = systemRoles(systemWith(PALETTE, { mode: 'dark' }));
    expect(roles.background.oklch.l).toBeLessThan(roles.text.oklch.l);
  });

  it('does not hand back the same mapping for both polarities', () => {
    const light = systemRoles(systemWith(PALETTE, { mode: 'light' }));
    const dark = systemRoles(systemWith(PALETTE, { mode: 'dark' }));
    expect(light.background.hex).not.toBe(dark.background.hex);
  });

  it('applies an override before flipping, not after', () => {
    // The override names the colour that plays `accent`; polarity must not
    // reassign it to something the person did not choose.
    const roles = systemRoles(
      systemWith(PALETTE, { mode: 'light', roleOverrides: { accent: '#FF00AA' } })
    );
    expect(roles.accent.hex).toBe('#FF00AA');
  });
});
