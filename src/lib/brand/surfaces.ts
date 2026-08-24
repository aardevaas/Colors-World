/**
 * The reference surfaces a system's proportions are measured on.
 *
 * Geometry, transcribed from the four templates `/visualizer` actually
 * renders, normalised to the frame so it states a ratio rather than a pixel
 * count. Every rectangle here was read off the live DOM at 910×710 on
 * 2026-08-24 — `getBoundingClientRect` per element, computed `background-color`
 * matched against the resolved `--ui-*` role variables — not estimated from
 * the CSS and not drawn by hand.
 *
 * ## Why the geometry is data and not the DOM
 *
 * The Book is a server component. Measuring the templates at render time would
 * mean a browser, which means the guideline could not state a proportion at
 * all without one. It would also make the number viewport-dependent, and a
 * ratio that changes when you resize the window is not a rule anybody can be
 * held to. So the measurement happens once, here, at a stated viewport, with
 * the date attached — the same contract as the Fontsource snapshot.
 *
 * **Re-measure with `docs/measure-surfaces.md` if a template's layout
 * changes.** A test asserts each surface is fully covered, so a region deleted
 * by accident fails the build; a region silently *moved* will not, and that is
 * what the recorded date is for.
 *
 * ## The three fills that are not flat colour
 *
 * Each is a real CSS effect and each would be a lie if counted as a flat
 * rectangle. They carry a derived `alpha` and a note saying where it came
 * from, because an unexplained 0.091 is indistinguishable from a guess.
 */

import type { Surface } from './proportions';

const MEASURED_AT = '2026-08-24';
const VIEWPORT = '910×710';

/**
 * A SaaS dashboard — the densest of the four, and the only one that puts a
 * serious amount of primary on screen.
 */
const DASHBOARD: Surface = {
  id: 'dashboard',
  name: 'SaaS dashboard',
  channel: 'web',
  measuredAt: MEASURED_AT,
  measuredViewport: VIEWPORT,
  regions: [
    { role: 'background', x: 0, y: 0, w: 1, h: 1 },
    { role: 'surface', x: 0, y: 0, w: 0.185, h: 1 },
    { role: 'primary', x: 0.015, y: 0.029, w: 0.018, h: 0.023 },
    { role: 'primary', x: 0.015, y: 0.084, w: 0.154, h: 0.047 },
    { role: 'primary', x: 0.857, y: 0.027, w: 0.118, h: 0.055 },
    { role: 'surface', x: 0.209, y: 0.107, w: 0.247, h: 0.115 },
    { role: 'surface', x: 0.469, y: 0.107, w: 0.247, h: 0.115 },
    { role: 'surface', x: 0.729, y: 0.107, w: 0.247, h: 0.115 },
    { role: 'surface', x: 0.209, y: 0.247, w: 0.766, h: 0.726 },
    { role: 'accent', x: 0.903, y: 0.268, w: 0.056, h: 0.03 },
    { role: 'primary', x: 0.226, y: 0.684, w: 0.098, h: 0.268 },
    { role: 'primary', x: 0.332, y: 0.518, w: 0.098, h: 0.433 },
    { role: 'primary', x: 0.438, y: 0.601, w: 0.098, h: 0.351 },
    { role: 'primary', x: 0.543, y: 0.429, w: 0.098, h: 0.523 },
    { role: 'primary', x: 0.649, y: 0.562, w: 0.098, h: 0.389 },
    { role: 'primary', x: 0.755, y: 0.352, w: 0.098, h: 0.599 },
    { role: 'accent', x: 0.861, y: 0.486, w: 0.098, h: 0.465 },
  ],
};

/** A product card — primary and accent side by side at full saturation. */
const COMMERCE: Surface = {
  id: 'commerce',
  name: 'Product card',
  channel: 'web',
  measuredAt: MEASURED_AT,
  measuredViewport: VIEWPORT,
  regions: [
    { role: 'background', x: 0, y: 0, w: 1, h: 1 },
    { role: 'surface', x: 0.335, y: 0.253, w: 0.33, h: 0.494 },
    /*
     * `linear-gradient(135deg, primary, accent)` — opaque, two stops, no
     * transparency anywhere in it. Split into two equal halves at alpha 1
     * rather than stacked: by AREA a two-stop ramp is exactly half each
     * colour, and stacking two half-alpha layers would leave a quarter of the
     * rectangle showing the card through a fill that is not translucent.
     */
    { role: 'primary', x: 0.336, y: 0.254, w: 0.1635, h: 0.211, note: 'Left half of the product image gradient.' },
    { role: 'accent', x: 0.4995, y: 0.254, w: 0.1635, h: 0.211, note: 'Right half of the product image gradient.' },
    { role: 'accent', x: 0.347, y: 0.268, w: 0.047, h: 0.03 },
    { role: 'primary', x: 0.354, y: 0.625, w: 0.022, h: 0.028 },
    { role: 'accent', x: 0.383, y: 0.625, w: 0.022, h: 0.028 },
    { role: 'border', x: 0.412, y: 0.625, w: 0.022, h: 0.028 },
    { role: 'primary', x: 0.354, y: 0.666, w: 0.292, h: 0.055 },
  ],
};

/**
 * An editorial hero — almost all ground, and the surface that most obviously
 * fails a "minimum 25% primary" rule. Also the one that forced the engine to
 * composite rather than sum areas.
 */
const EDITORIAL: Surface = {
  id: 'editorial',
  name: 'Editorial hero',
  channel: 'web',
  measuredAt: MEASURED_AT,
  measuredViewport: VIEWPORT,
  regions: [
    { role: 'background', x: 0, y: 0, w: 1, h: 1 },
    /*
     * `radial-gradient(circle, primary 0%, transparent 65%)` on an element at
     * `opacity: 0.28`, sitting mostly off the top-left corner.
     *
     * Counted as a flat rectangle it is 0% primary — the fill is a
     * `background-image`, so `background-color` reports nothing. Counted as
     * its box it is 72% primary, which is plainly false: the gradient is
     * transparent over most of its own area. Both numbers are confidently
     * wrong, and this one region is why `alpha` exists.
     *
     * Derived, not estimated: the box is 728×639 with the circle's
     * farthest-corner radius R = 484.3, so alpha falls linearly to zero at
     * ρ = 0.65R = 314.8 from the centre at (182, 106.5). Integrating
     * max(0, 1 − d/ρ) × 0.28 over the part of the box inside the frame gives
     * 21,169 px² of primary across a visible 546×426 = 232,596 px² — an
     * effective alpha of 0.0910, or 3.28% of the whole frame. Rect below is
     * the box already clipped to the frame, which is what that integral covers.
     */
    {
      role: 'primary',
      x: 0,
      y: 0,
      w: 0.6,
      h: 0.6,
      alpha: 0.091,
      note: 'Radial glow, integrated: alpha falls to zero at 65% of a 484px radius, over an element at 0.28 opacity.',
    },
    { role: 'accent', x: 0.039, y: 0.295, w: 0.089, h: 0.038 },
    { role: 'primary', x: 0.039, y: 0.644, w: 0.145, h: 0.06 },
    /* `color-mix(in oklab, surface 70%, transparent)` — flat, so alpha is
       simply the 0.7 the mix states. */
    {
      role: 'surface',
      x: 0.194,
      y: 0.644,
      w: 0.151,
      h: 0.06,
      alpha: 0.7,
      note: 'Glass CTA: surface mixed 70% with transparent.',
    },
  ],
};

/** A mobile screen — small controls, and the least brand colour of the four. */
const MOBILE: Surface = {
  id: 'mobile',
  name: 'Mobile screen',
  channel: 'mobile',
  measuredAt: MEASURED_AT,
  measuredViewport: VIEWPORT,
  regions: [
    { role: 'background', x: 0, y: 0, w: 1, h: 1 },
    { role: 'background', x: 0.363, y: 0.197, w: 0.275, h: 0.606 },
    { role: 'accent', x: 0.574, y: 0.249, w: 0.047, h: 0.03 },
    { role: 'surface', x: 0.377, y: 0.316, w: 0.246, h: 0.085 },
    { role: 'primary', x: 0.571, y: 0.344, w: 0.037, h: 0.028 },
    { role: 'background', x: 0.589, y: 0.347, w: 0.018, h: 0.023 },
    { role: 'surface', x: 0.377, y: 0.413, w: 0.246, h: 0.085 },
    { role: 'primary', x: 0.571, y: 0.441, w: 0.037, h: 0.028 },
    { role: 'background', x: 0.589, y: 0.444, w: 0.018, h: 0.023 },
    { role: 'surface', x: 0.377, y: 0.51, w: 0.246, h: 0.085 },
    { role: 'border', x: 0.571, y: 0.538, w: 0.037, h: 0.028 },
    { role: 'background', x: 0.574, y: 0.541, w: 0.018, h: 0.023 },
    { role: 'surface', x: 0.377, y: 0.607, w: 0.246, h: 0.085 },
    { role: 'border', x: 0.571, y: 0.636, w: 0.037, h: 0.028 },
    { role: 'background', x: 0.574, y: 0.638, w: 0.018, h: 0.023 },
    { role: 'border', x: 0.393, y: 0.755, w: 0.022, h: 0.028 },
    { role: 'primary', x: 0.457, y: 0.755, w: 0.022, h: 0.028 },
    { role: 'border', x: 0.521, y: 0.755, w: 0.022, h: 0.028 },
    { role: 'border', x: 0.585, y: 0.755, w: 0.022, h: 0.028 },
  ],
};

/**
 * An email — the one surface that shows the system as it ARRIVES.
 *
 * Every fill here is flat: no gradients, no translucency, nothing to derive.
 * That is itself characteristic of the channel, which is built out of tables
 * and solid colour because that is all it can rely on.
 */
const EMAIL: Surface = {
  id: 'email',
  name: 'Email',
  channel: 'email',
  measuredAt: MEASURED_AT,
  measuredViewport: VIEWPORT,
  regions: [
    { role: 'background', x: 0, y: 0, w: 1, h: 1 },
    { role: 'surface', x: 0.201, y: 0.063, w: 0.598, h: 0.372 },
    { role: 'primary', x: 0.227, y: 0.256, w: 0.169, h: 0.053 },
    { role: 'border', x: 0.227, y: 0.326, w: 0.546, h: 0.001 },
    { role: 'accent', x: 0.227, y: 0.344, w: 0.003, h: 0.057 },
  ],
};

/**
 * The reference set, in the order the guideline reports them.
 *
 * Deliberately ordered most brand colour first, because the interesting
 * finding is almost always at the bottom: a system will pass its own ratio on
 * the dashboard it was designed against and miss it by an order of magnitude
 * on the hero nobody checked.
 *
 * Q1 = A: our own views only. **Breadth is where this feature gets better** —
 * every surface added here is another layout the ratio is checked against, and
 * adding one is data, not code.
 */
export const REFERENCE_SURFACES: readonly Surface[] = [DASHBOARD, COMMERCE, EDITORIAL, MOBILE, EMAIL];

export function surfaceById(id: string): Surface | undefined {
  return REFERENCE_SURFACES.find((s) => s.id === id);
}
