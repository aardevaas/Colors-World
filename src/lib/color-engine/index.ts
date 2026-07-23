/**
 * PRISM colour engine — framework-agnostic, dependency-light, fully testable.
 *
 * Nothing in this directory may import React, Next.js, or any browser global.
 * The same code has to run in the browser, in a Node build script that
 * precomputes seed data, and in tests. Keeping it pure is what makes that work.
 */

export type {
  Cmyk,
  ContrastReport,
  CvdType,
  Gamut,
  GeneratedScale,
  Oklch,
  Provenance,
  ScaleAnchor,
  ScaleSpec,
  ScaleStep,
  WcagLevel,
} from './types';

export {
  formatHex,
  formatOklchCss,
  formatRgb,
  gamutMode,
  parseColor,
  toCuloriOklch,
  toOklch,
  toRgb,
  type Rgb8,
} from './color';

export { toCmyk, formatCmyk } from './cmyk';

export { isInGamut, mapToGamut, maxChroma, type GamutMapResult } from './gamut';

export { auditGamutWarning, type GamutWarning } from './warnings';

export {
  monotoneHueInterpolator,
  monotoneInterpolator,
  normalizeHue,
  type ControlPoint,
} from './interpolate';

export { generateScale } from './scale';

export {
  apcaContrast,
  auditContrast,
  bestTextColor,
  contrastRatio,
  relativeLuminance,
} from './contrast';

export { CVD_TYPES, simulateCvd } from './cvd';

export { deltaEOk, shortestHueDelta } from './distance';

export { gradientCssString, sampleOklchGradient, type GradientStop } from './gradient';
