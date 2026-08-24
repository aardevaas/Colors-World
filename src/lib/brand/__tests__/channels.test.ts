import { describe, expect, test } from 'vitest';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import type { BrandState } from '../types';
import { CHANNELS, channelRules, floorBreaches } from '../channels';

const stateWith = (patch: Partial<typeof EMPTY_SYSTEM.type> = {}): BrandState => ({
  system: { ...EMPTY_SYSTEM, type: { ...EMPTY_SYSTEM.type, ...patch } },
  project: null,
});

describe('CHANNELS', () => {
  test('covers the four a manual states separately', () => {
    expect(CHANNELS.map((c) => c.id)).toEqual(['web', 'email', 'print', 'presentation']);
  });

  test('every stated floor carries where it came from', () => {
    for (const c of CHANNELS) {
      if (c.minBodyPx !== undefined) {
        expect(c.minBodyPx).toBeGreaterThan(0);
        expect(c.floorSource, c.id).toBeTruthy();
        expect(c.floorEvidence).toMatch(/^(cited|declared)$/);
      } else {
        // A channel with no defensible floor states none rather than inventing
        // one — print and presentation are sized in points, at a distance.
        expect(c.floorSource).toBeUndefined();
      }
    }
  });

  test('says which channels the brand face actually reaches', () => {
    expect(CHANNELS.find((c) => c.id === 'web')?.rendersBrandFace).toBe(true);
    expect(CHANNELS.find((c) => c.id === 'email')?.rendersBrandFace).toBe(false);
  });
});

describe('channelRules', () => {
  test('returns one rule per channel', () => {
    expect(channelRules(stateWith())).toHaveLength(CHANNELS.length);
  });

  test('states the stack that actually renders, per channel', () => {
    const rules = channelRules(stateWith());
    const email = rules.find((r) => r.channel.id === 'email')!;
    const web = rules.find((r) => r.channel.id === 'web')!;
    // Email strips webfonts, so it cannot be the brand stack.
    expect(email.stack).toContain('Arial');
    expect(email.stack).not.toBe(web.stack);
  });

  test('measures this system’s body against each floor', () => {
    const rules = channelRules(stateWith({ baseRem: 1 }));
    const web = rules.find((r) => r.channel.id === 'web')!;
    expect(web.bodyPx).toBe(16);
    expect(web.holds).toBe(true);
  });

  test('a body under a floor does not hold', () => {
    const rules = channelRules(stateWith({ baseRem: 0.8 }));
    const web = rules.find((r) => r.channel.id === 'web')!;
    expect(web.bodyPx).toBeCloseTo(12.8, 6);
    expect(web.holds).toBe(false);
  });

  test('a channel with no floor neither holds nor fails', () => {
    const print = channelRules(stateWith({ baseRem: 0.5 })).find((r) => r.channel.id === 'print')!;
    expect(print.holds).toBeNull();
  });

  test('converts to points for print, because print is not sized in pixels', () => {
    const print = channelRules(stateWith({ baseRem: 1 })).find((r) => r.channel.id === 'print')!;
    expect(print.bodyPt).toBe(12); // 16px at 96dpi is 12pt
  });

  test('answers whether the body face may be used in print at all', () => {
    const print = channelRules(stateWith()).find((r) => r.channel.id === 'print')!;
    // The default preset resolves to a catalogue face with known terms.
    expect(print.printLicence).not.toBeUndefined();
    expect(typeof print.printLicence!.allowed).toBe('boolean');
    expect(print.printLicence!.name).toBeTruthy();
  });
});

describe('floorBreaches', () => {
  test('is empty at the shipped default', () => {
    expect(floorBreaches(channelRules(stateWith()))).toHaveLength(0);
  });

  test('reports every channel a small body breaks, and only those', () => {
    const breaches = floorBreaches(channelRules(stateWith({ baseRem: 0.5 })));
    expect(breaches.map((b) => b.channel.id).sort()).toEqual(['email', 'web']);
    for (const b of breaches) expect(b.holds).toBe(false);
  });

  test('a body exactly on a floor holds — the floor is a minimum, not a margin', () => {
    // 14px clears email's 14 floor but not web's 16.
    const breaches = floorBreaches(channelRules(stateWith({ baseRem: 14 / 16 })));
    expect(breaches.map((b) => b.channel.id)).toEqual(['web']);
  });
});
