/**
 * Shared with LandingExperience.tsx for the post-explosion navigation
 * timeout. Deliberately its own file with zero dependencies: ParticleStorm.tsx
 * imports `three`, and LandingExperience.tsx is NOT behind the `ssr: false`
 * dynamic-import boundary (only ParticleCanvas.tsx is) — importing this
 * constant from ParticleStorm.tsx directly would pull three.js back into the
 * main bundle for the sake of one number.
 */
export const EXPLOSION_DURATION_SECONDS = 1.1;

/** A little past the shader's own climax, so the cards never appear
 *  mid-explosion. Shared rather than recomputed at each call site so the
 *  feature-card reveal timeout and the background dim-down (ParticleStorm)
 *  can never drift out of sync with each other. */
export const CARDS_REVEAL_DELAY_SECONDS = EXPLOSION_DURATION_SECONDS + 0.15;
