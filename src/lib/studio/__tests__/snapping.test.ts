import { describe, expect, it } from 'vitest';
import {
  BENTO_GAP,
  findSnap,
  type SnapCandidate,
} from '../snapping';

function card(overrides: Partial<SnapCandidate> & { id: string }): SnapCandidate {
  return {
    x: 0,
    y: 0,
    width: 200,
    height: 150,
    isColorBearing: false,
    isImage: false,
    ...overrides,
  };
}

describe('findSnap — no snap', () => {
  it('returns the unmodified position when nothing is in range', () => {
    const dragged = card({ id: 'a', x: 5000, y: 5000 });
    const others = [card({ id: 'b', x: 0, y: 0 })];
    const result = findSnap(dragged, others, 1);
    expect(result.snapped).toBe(false);
    expect(result.snapKind).toBeNull();
    expect(result.x).toBe(5000);
    expect(result.y).toBe(5000);
    expect(result.guides).toHaveLength(0);
  });

  it('returns no snap against an empty board', () => {
    const dragged = card({ id: 'a', x: 100, y: 100 });
    const result = findSnap(dragged, [], 1);
    expect(result.snapped).toBe(false);
  });
});

describe('findSnap — bento grid snap', () => {
  it('snaps to a uniform gap to the right of a neighbour', () => {
    const other = card({ id: 'b', x: 0, y: 0, width: 200, height: 150 });
    // Dragged card's left edge is a couple px shy of other.right + GAP.
    const dragged = card({ id: 'a', x: 200 + BENTO_GAP + 3, y: 0, width: 200, height: 150 });
    const result = findSnap(dragged, [other], 1);
    expect(result.snapped).toBe(true);
    expect(result.snapKind).toBe('bento');
    expect(result.x).toBe(200 + BENTO_GAP);
  });

  it('snaps to a uniform gap above a neighbour (edge-to-edge on the y axis)', () => {
    const other = card({ id: 'b', x: 0, y: 500, width: 200, height: 150 });
    const dragged = card({ id: 'a', x: 0, y: 500 - BENTO_GAP - 150 - 2, width: 200, height: 150 });
    const result = findSnap(dragged, [other], 1);
    expect(result.snapped).toBe(true);
    expect(result.y).toBe(500 - BENTO_GAP - 150);
  });

  it('snaps to a shared center line', () => {
    const other = card({ id: 'b', x: 1000, y: 0, width: 200, height: 150 });
    // other's horizontal center is at 1100; give dragged a different width so
    // edge-to-edge alignment cannot also explain the match.
    const dragged = card({ id: 'a', x: 1100 - 50 + 2, y: 800, width: 100, height: 80 });
    const result = findSnap(dragged, [other], 1);
    expect(result.snapped).toBe(true);
    expect(result.x).toBe(1100 - 50);
  });

  it('does not snap when the closest neighbour is outside the threshold', () => {
    const other = card({ id: 'b', x: 0, y: 0, width: 200, height: 150 });
    // y is offset well clear of any edge/center match too, so only the
    // x-axis distance under test can produce a false positive.
    const dragged = card({ id: 'a', x: 200 + BENTO_GAP + 40, y: 900, width: 200, height: 150 });
    const result = findSnap(dragged, [other], 1);
    expect(result.snapped).toBe(false);
  });

  it('ignores itself when present in the candidate list', () => {
    const dragged = card({ id: 'a', x: 500, y: 500, width: 200, height: 150 });
    const result = findSnap(dragged, [dragged], 1);
    expect(result.snapped).toBe(false);
  });

  it('picks the closer of two competing snap opportunities', () => {
    const near = card({ id: 'near', x: 0, y: 0, width: 200, height: 150 });
    const far = card({ id: 'far', x: -5000, y: 0, width: 200, height: 150 });
    const dragged = card({ id: 'a', x: 200 + BENTO_GAP + 1, y: 0, width: 200, height: 150 });
    const result = findSnap(dragged, [near, far], 1);
    expect(result.x).toBe(200 + BENTO_GAP);
  });

  it('scales the world-space threshold with camera zoom — same screen distance, different zoom', () => {
    const other = card({ id: 'b', x: 0, y: 0, width: 200, height: 150 });
    // 30 world units away: within threshold at zoom 0.2 (8/0.2 = 40 world px)
    // but outside threshold at zoom 1 (8 world px). y is offset clear of any
    // accidental edge/center match so only the x-axis distance is exercised.
    const dragged = card({ id: 'a', x: 200 + BENTO_GAP + 30, y: 900, width: 200, height: 150 });

    const zoomedOut = findSnap(dragged, [other], 0.2);
    expect(zoomedOut.snapped).toBe(true);

    const zoomedIn = findSnap(dragged, [other], 1);
    expect(zoomedIn.snapped).toBe(false);
  });

  it('produces a guide line spanning the combined extent of both cards', () => {
    const other = card({ id: 'b', x: 0, y: 0, width: 200, height: 150 });
    const dragged = card({ id: 'a', x: 200 + BENTO_GAP, y: 300, width: 200, height: 150 });
    const result = findSnap(dragged, [other], 1);
    expect(result.guides).toHaveLength(1);
    const [guide] = result.guides;
    expect(guide?.axis).toBe('x');
    expect(guide?.start).toBe(0);
    expect(guide?.end).toBe(450);
  });
});

describe('findSnap — editorial palette docking', () => {
  it('docks a color-bearing card to the nearest edge of an image', () => {
    const image = card({ id: 'img', x: 0, y: 0, width: 400, height: 300, isImage: true });
    // Dragged sits just to the right of the image, closer to its right edge.
    const dragged = card({
      id: 'swatch',
      x: 400 + 5,
      y: 50,
      width: 60,
      height: 60,
      isColorBearing: true,
    });
    const result = findSnap(dragged, [image], 1);
    expect(result.snapped).toBe(true);
    expect(result.snapKind).toBe('image-dock');
    expect(result.dockedToId).toBe('img');
    expect(result.x).toBe(400 + BENTO_GAP);
  });

  it('only docks color-bearing cards — a plain note near an image just falls through to bento/no-snap', () => {
    const image = card({ id: 'img', x: 0, y: 0, width: 400, height: 300, isImage: true });
    const dragged = card({ id: 'note', x: 400 + 5, y: 50, width: 60, height: 60, isColorBearing: false });
    const result = findSnap(dragged, [image], 1);
    expect(result.snapKind).not.toBe('image-dock');
  });

  it('picks the top edge when the dragged card is above the image', () => {
    const image = card({ id: 'img', x: 0, y: 0, width: 400, height: 300, isImage: true });
    const dragged = card({
      id: 'swatch',
      x: 150,
      y: -60 - 5,
      width: 60,
      height: 60,
      isColorBearing: true,
    });
    const result = findSnap(dragged, [image], 1);
    expect(result.snapKind).toBe('image-dock');
    expect(result.y).toBe(0 - BENTO_GAP - 60);
  });

  it('stacks a second docked swatch after the first one along the same edge', () => {
    const image = card({ id: 'img', x: 0, y: 0, width: 400, height: 300, isImage: true });
    const firstDocked = card({
      id: 'swatch-1',
      x: 400 + BENTO_GAP,
      y: 0,
      width: 60,
      height: 60,
      isColorBearing: true,
    });
    const secondDragged = card({
      id: 'swatch-2',
      x: 400 + 5,
      y: 40,
      width: 60,
      height: 60,
      isColorBearing: true,
    });
    const result = findSnap(secondDragged, [image, firstDocked], 1);
    expect(result.snapKind).toBe('image-dock');
    expect(result.x).toBe(400 + BENTO_GAP);
    expect(result.y).toBe(0 + 60 + BENTO_GAP);
  });

  it('image docking takes priority over a bento match when both are in range', () => {
    const image = card({ id: 'img', x: 0, y: 0, width: 400, height: 300, isImage: true });
    // Also placed near another color card's edge, so a bento match would
    // also be found — image-dock should still win.
    const otherColor = card({
      id: 'other-color',
      x: 700,
      y: 40,
      width: 60,
      height: 60,
      isColorBearing: true,
    });
    const dragged = card({
      id: 'swatch',
      x: 400 + 5,
      y: 40,
      width: 60,
      height: 60,
      isColorBearing: true,
    });
    const result = findSnap(dragged, [image, otherColor], 1);
    expect(result.snapKind).toBe('image-dock');
  });

  it('does not dock when outside the (zoom-adjusted) docking threshold', () => {
    const image = card({ id: 'img', x: 0, y: 0, width: 400, height: 300, isImage: true });
    const dragged = card({
      id: 'swatch',
      x: 400 + 100,
      y: 40,
      width: 60,
      height: 60,
      isColorBearing: true,
    });
    const result = findSnap(dragged, [image], 1);
    expect(result.snapKind).not.toBe('image-dock');
  });

  it('docks to the nearest of two images, not just the first in the list', () => {
    const farImage = card({ id: 'far', x: -1000, y: 0, width: 400, height: 300, isImage: true });
    const nearImage = card({ id: 'near', x: 0, y: 0, width: 400, height: 300, isImage: true });
    const dragged = card({
      id: 'swatch',
      x: 400 + 5,
      y: 40,
      width: 60,
      height: 60,
      isColorBearing: true,
    });
    const result = findSnap(dragged, [farImage, nearImage], 1);
    expect(result.dockedToId).toBe('near');
  });
});
