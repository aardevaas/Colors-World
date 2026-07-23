import type { Oklch } from '@/lib/color-engine';
import { HUE_FAMILIES } from './hue-family';

/**
 * Owned here rather than by a Supabase repository — filtering now runs
 * entirely against generated (in-memory) swatches, not a database query, so
 * this is a plain colour-space predicate with no DB dependency at all.
 */
export interface SpectrumFilters {
  /** OKLCH lightness, 0–1. */
  readonly minLightness?: number;
  readonly maxLightness?: number;
  readonly minChroma?: number;
  readonly maxChroma?: number;
  /** OKLCH hue, 0–360. */
  readonly minHue?: number;
  readonly maxHue?: number;
}

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

/** Pure predicate — tests one generated colour against a resolved filter set. */
export function matchesFilters(oklch: Oklch, filters: SpectrumFilters): boolean {
  if (filters.minLightness !== undefined && oklch.l < filters.minLightness) return false;
  if (filters.maxLightness !== undefined && oklch.l > filters.maxLightness) return false;
  if (filters.minChroma !== undefined && oklch.c < filters.minChroma) return false;
  if (filters.maxChroma !== undefined && oklch.c > filters.maxChroma) return false;
  if (filters.minHue !== undefined && oklch.h < filters.minHue) return false;
  if (filters.maxHue !== undefined && oklch.h > filters.maxHue) return false;
  return true;
}
