import { describe, expect, test } from 'vitest';
import { generateScale } from '@/lib/color-engine';
import { snapshotFromScales } from '../snapshot';

describe('snapshotFromScales', () => {
  test('names tokens the same way the CSS exporter does', () => {
    const scale = generateScale({
      name: 'Brand Blue',
      anchors: [{ step: 5, color: '#3b82f6' }],
    });
    const snapshot = snapshotFromScales([scale]);

    expect(snapshot['brand-blue-5']).toBe('#3b82f6');
    expect(Object.keys(snapshot)).toHaveLength(10);
  });

  test('flattens multiple scales into one snapshot without collision', () => {
    const blue = generateScale({ name: 'blue', anchors: [{ step: 5, color: '#3b82f6' }] });
    const slate = generateScale({ name: 'slate', anchors: [{ step: 5, color: '#64748b' }] });
    const snapshot = snapshotFromScales([blue, slate]);

    expect(Object.keys(snapshot)).toHaveLength(20);
    expect(snapshot['blue-5']).toBe('#3b82f6');
    expect(snapshot['slate-5']).toBe('#64748b');
  });

  test('an empty scale list produces an empty snapshot', () => {
    expect(snapshotFromScales([])).toEqual({});
  });
});
