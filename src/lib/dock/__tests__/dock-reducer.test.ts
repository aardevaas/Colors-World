import { describe, expect, it } from 'vitest';
import { EMPTY_DOCK_STATE, dockReducer, type DockState } from '../dock-reducer';

const RED: { hex: string; oklch: { l: number; c: number; h: number } } = {
  hex: '#ff0000',
  oklch: { l: 0.63, c: 0.26, h: 29 },
};
const BLUE = { hex: '#0000ff', oklch: { l: 0.45, c: 0.31, h: 264 } };
const GREEN = { hex: '#00ff00', oklch: { l: 0.87, c: 0.29, h: 142 } };

describe('dockReducer', () => {
  it('the first added colour becomes the primary anchor', () => {
    const state = dockReducer(EMPTY_DOCK_STATE, {
      type: 'add',
      ...RED,
      addedAt: 1,
    });
    expect(state.primaryAnchorHex).toBe('#ff0000');
    expect(state.items).toHaveLength(1);
  });

  it('adding a second colour does not change an existing anchor', () => {
    let state = dockReducer(EMPTY_DOCK_STATE, { type: 'add', ...RED, addedAt: 1 });
    state = dockReducer(state, { type: 'add', ...BLUE, addedAt: 2 });
    expect(state.primaryAnchorHex).toBe('#ff0000');
    expect(state.items).toHaveLength(2);
  });

  it('adding a colour already in the dock is a no-op', () => {
    let state = dockReducer(EMPTY_DOCK_STATE, { type: 'add', ...RED, addedAt: 1 });
    state = dockReducer(state, { type: 'add', ...RED, addedAt: 2 });
    expect(state.items).toHaveLength(1);
  });

  it('removing a non-anchor item leaves the anchor unchanged', () => {
    let state = dockReducer(EMPTY_DOCK_STATE, { type: 'add', ...RED, addedAt: 1 });
    state = dockReducer(state, { type: 'add', ...BLUE, addedAt: 2 });
    state = dockReducer(state, { type: 'remove', hex: '#0000ff' });
    expect(state.primaryAnchorHex).toBe('#ff0000');
    expect(state.items).toHaveLength(1);
  });

  it('removing the anchor promotes the next-oldest remaining item', () => {
    let state = dockReducer(EMPTY_DOCK_STATE, { type: 'add', ...RED, addedAt: 1 });
    state = dockReducer(state, { type: 'add', ...BLUE, addedAt: 2 });
    state = dockReducer(state, { type: 'add', ...GREEN, addedAt: 3 });
    state = dockReducer(state, { type: 'remove', hex: '#ff0000' }); // remove the anchor
    expect(state.primaryAnchorHex).toBe('#0000ff'); // next-oldest promoted
  });

  it('removing the last item clears the anchor to null', () => {
    let state = dockReducer(EMPTY_DOCK_STATE, { type: 'add', ...RED, addedAt: 1 });
    state = dockReducer(state, { type: 'remove', hex: '#ff0000' });
    expect(state.primaryAnchorHex).toBeNull();
    expect(state.items).toHaveLength(0);
  });

  it('setPrimaryAnchor reassigns to any item currently in the dock', () => {
    let state = dockReducer(EMPTY_DOCK_STATE, { type: 'add', ...RED, addedAt: 1 });
    state = dockReducer(state, { type: 'add', ...BLUE, addedAt: 2 });
    state = dockReducer(state, { type: 'setPrimaryAnchor', hex: '#0000ff' });
    expect(state.primaryAnchorHex).toBe('#0000ff');
  });

  it('setPrimaryAnchor silently ignores a hex not in the dock', () => {
    const state = dockReducer(EMPTY_DOCK_STATE, { type: 'add', ...RED, addedAt: 1 });
    const result = dockReducer(state, { type: 'setPrimaryAnchor', hex: '#abcdef' });
    expect(result.primaryAnchorHex).toBe('#ff0000');
    expect(result).toEqual(state);
  });

  it('clear empties both items and the anchor', () => {
    let state = dockReducer(EMPTY_DOCK_STATE, { type: 'add', ...RED, addedAt: 1 });
    state = dockReducer(state, { type: 'clear' });
    expect(state).toEqual(EMPTY_DOCK_STATE);
  });

  it('hydrate replaces state wholesale (loading from localStorage)', () => {
    const stored: DockState = { items: [{ ...RED, addedAt: 5 }], primaryAnchorHex: '#ff0000' };
    const state = dockReducer(EMPTY_DOCK_STATE, { type: 'hydrate', state: stored });
    expect(state).toEqual(stored);
  });
});
