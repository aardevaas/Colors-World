/**
 * The brush strokes that paint a card into existence.
 *
 * A card is not faded in or wiped in — it is *painted*, one broad stroke at a
 * time, and the strokes themselves are what the card's surface is made of.
 * That means the geometry has to satisfy two things at once: cover the panel
 * completely when finished, and read as a plausible hand while it is going.
 *
 * Three decisions do most of that work:
 *
 *  - Strokes alternate direction. A stack all travelling left-to-right reads as
 *    a progress bar; alternating reads as a brush being dragged back and forth.
 *  - Every stroke runs off all four edges. A brush that starts and stops exactly
 *    at the boundary looks like a rectangle being filled; one that runs off the
 *    side looks like paint — and the outermost strokes have to clear the top and
 *    bottom too, or the panel has unpainted bands along those edges.
 *  - The stagger overlaps. If stroke N finishes before N+1 begins the whole
 *    thing stutters, so each starts before its predecessor is done.
 *
 * Paths are emitted in a normalised 100x64 viewBox and stretched by the SVG, so
 * one geometry serves every card size.
 *
 * Pure: no DOM, no React.
 */

/** Enough to cover the panel at this stroke width without wasting draws. */
export const STROKE_COUNT = 7;

/** viewBox the paths are authored in. `preserveAspectRatio="none"` stretches
 *  them to whatever the card turns out to be. */
export const VIEW_WIDTH = 100;
export const VIEW_HEIGHT = 64;

/**
 * Stroke width, in viewBox units, applied by the component rather than by CSS.
 *
 * It lives here because it is a *geometry* constant, not a style one: the
 * strokes must be wider than the largest gap between their centres or the
 * finished panel has seams. Keeping it beside the spacing means one number
 * governs both, and the test can check the relationship instead of guessing.
 */
export const STROKE_WIDTH = 17;

export interface PaintStroke {
  /** SVG path data. */
  readonly d: string;
  /**
   * Which end the stroke draws from, as the sign of the initial dashoffset.
   * With `pathLength="1"` the offset is +1 or -1 and needs no measurement —
   * the alternative is reading getTotalLength() per path at runtime, which
   * forces layout and has to be redone on every resize.
   */
  readonly from: 1 | -1;
  /** Fraction of the whole reveal at which this stroke starts. */
  readonly start: number;
  /** Fraction at which it finishes. */
  readonly end: number;
}

/** Deterministic wobble — these render on the server, so no Math.random(). */
function wobble(index: number, salt: number): number {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function buildStrokes(count: number = STROKE_COUNT): readonly PaintStroke[] {
  const total = Number.isFinite(count) ? Math.max(0, Math.min(24, Math.round(count))) : 0;
  if (total === 0) return [];

  const strokes: PaintStroke[] = [];
  const band = VIEW_HEIGHT / total;
  // Overshoot vertically as well as horizontally. Centring the outermost
  // strokes inside the box left an unpainted band at the top and bottom edges:
  // measured at 295px of paint on a 331px card. The brush has to run off all
  // four sides, not two.
  const over = band * 0.55;

  for (let i = 0; i < total; i += 1) {
    const span = VIEW_HEIGHT + over * 2;
    const y = -over + (span * i) / Math.max(1, total - 1);
    // Each stroke bows slightly, and no two bow the same way.
    const bow = (wobble(i, 1) - 0.5) * band * 0.9;
    const tilt = (wobble(i, 2) - 0.5) * band * 0.5;

    // Overshoots both edges so the brush enters and leaves the panel.
    const d =
      `M -10 ${(y + tilt).toFixed(2)} ` +
      `C ${(VIEW_WIDTH * 0.28).toFixed(2)} ${(y + bow).toFixed(2)}, ` +
      `${(VIEW_WIDTH * 0.62).toFixed(2)} ${(y - bow).toFixed(2)}, ` +
      `110 ${(y - tilt).toFixed(2)}`;

    // Overlapping stagger: each begins before the previous has finished, so
    // the painting is continuous rather than a series of separate wipes.
    const step = 1 / (total + 1.6);
    strokes.push({
      d,
      from: i % 2 === 0 ? 1 : -1,
      start: i * step,
      end: i * step + step * 2.4,
    });
  }

  // Normalised so the final stroke lands exactly on 1. Without this the raw
  // windows finish a little short, and the card would be fully painted slightly
  // before the reveal range ends — a beat of nothing happening at the bottom of
  // every card's scroll.
  const last = strokes[strokes.length - 1]!.end;
  return strokes.map((stroke) => ({
    ...stroke,
    start: Number((stroke.start / last).toFixed(4)),
    end: Number(Math.min(1, stroke.end / last).toFixed(4)),
  }));
}
