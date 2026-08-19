/**
 * The System every visitor starts from.
 *
 * These values are not new opinions — they are exactly what the tabs already
 * defaulted to individually, lifted into one place so "unconfigured" means the
 * same thing everywhere and the codec has something to compare against when
 * deciding what to leave out of the URL.
 */

import { DEFAULT_RATIO } from '@/lib/typography/type-scale';
import { DEFAULT_PRESET_ID } from '@/lib/typography/font-sources';
import { DEFAULT_STEP_COUNT } from '@/lib/builder/builder-reducer';
import type { ScaleSystem, System, TypeSettings } from './types';

export const DEFAULT_TYPE: TypeSettings = {
  presetId: DEFAULT_PRESET_ID,
  ratio: DEFAULT_RATIO,
  baseRem: 1,
  lineHeight: 1.55,
  tracking: 0,
  weight: 400,
};

export const DEFAULT_SCALES: ScaleSystem = {
  steps: DEFAULT_STEP_COUNT,
  gamut: 'srgb',
  byHex: {},
};

export const EMPTY_SYSTEM: System = {
  palette: [],
  anchorHex: null,
  roleOverrides: {},
  type: DEFAULT_TYPE,
  scales: DEFAULT_SCALES,
  mode: 'dark',
};
