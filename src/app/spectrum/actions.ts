'use server';

import {
  countColors,
  getSpectrumPage,
  getSpectrumWindow,
  type SpectrumFilters,
  type SpectrumRow,
} from '@/lib/supabase/colors';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';

export async function fetchSpectrumWindow(
  startIndex: number,
  count: number
): Promise<SpectrumRow[]> {
  const supabase = await createServerSupabaseClient();
  return getSpectrumWindow(startIndex, count, supabase);
}

export async function fetchSpectrumPage(
  afterIndex: number | undefined,
  count: number,
  filters: SpectrumFilters
): Promise<SpectrumRow[]> {
  const supabase = await createServerSupabaseClient();
  return getSpectrumPage(afterIndex, count, filters, supabase);
}

export async function fetchSpectrumTotal(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  return countColors(supabase);
}
