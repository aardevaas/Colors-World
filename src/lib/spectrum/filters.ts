import type { SpectrumFilters } from '@/lib/supabase/colors';
import { HUE_FAMILIES } from './hue-family';

export type LightnessBand = 'all' | 'pastel' | 'deep';
export type ChromaBand = 'all' | 'muted' | 'vivid';

export interface SpectrumFilterSelection {
  /** 'all' or one of HUE_FAMILIES' names. */
  readonly hueFamily: string;
  readonly lightnessBand: LightnessBand;
  readonly chromaBand: ChromaBand;
}

export const DEFAULT_FILTER_SELECTION: SpectrumFilterSelection = {
  hueFamily: 'all',
  lightnessBand: 'all',
  chromaBand: 'all',
};

const LIGHTNESS_BOUNDS: Record<LightnessBand, Partial<SpectrumFilters>> = {
  all: {},
  pastel: { minLightness: 0.85 },
  deep: { maxLightness: 0.35 },
};

const CHROMA_BOUNDS: Record<ChromaBand, Partial<SpectrumFilters>> = {
  all: {},
  muted: { maxChroma: 0.06 },
  vivid: { minChroma: 0.15 },
};

export function resolveSpectrumFilters(selection: SpectrumFilterSelection): SpectrumFilters {
  const hue = HUE_FAMILIES.find((f) => f.name === selection.hueFamily);
  return {
    ...(hue ? { minHue: hue.minHue, maxHue: hue.maxHue } : {}),
    ...LIGHTNESS_BOUNDS[selection.lightnessBand],
    ...CHROMA_BOUNDS[selection.chromaBand],
  };
}

export function hasActiveFilters(selection: SpectrumFilterSelection): boolean {
  return (
    selection.hueFamily !== 'all' ||
    selection.lightnessBand !== 'all' ||
    selection.chromaBand !== 'all'
  );
}
