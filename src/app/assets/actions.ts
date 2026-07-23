'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import {
  BOARD_ASSETS_BUCKET,
} from '@/lib/supabase/board';
import {
  createBrandAsset,
  deleteBrandAsset,
  type BrandAssetKind,
} from '@/lib/supabase/brand-assets';
import { resolveDefaultProjectId } from '@/lib/supabase/projects';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';

function isBrandAssetKind(value: FormDataEntryValue | null): value is BrandAssetKind {
  return value === 'logo' || value === 'mark' || value === 'other';
}

export async function uploadBrandAssetAction(formData: FormData): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    throw new Error('You must be signed in to upload brand assets.');
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Choose a file to upload.');
  }

  const name = String(formData.get('name') ?? '').trim();
  if (name === '') {
    throw new Error('Give this asset a name.');
  }

  const kind = formData.get('kind');
  if (!isBrandAssetKind(kind)) {
    throw new Error('Invalid asset kind.');
  }

  const groupIdRaw = formData.get('groupId');
  const groupId = typeof groupIdRaw === 'string' && groupIdRaw !== '' ? groupIdRaw : undefined;

  const projectId = await resolveDefaultProjectId(user.id, supabase);
  const path = `${projectId}/brand/${groupId ?? randomUUID()}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BOARD_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (uploadError) {
    throw new Error(`Failed to upload asset: ${uploadError.message}`);
  }

  await createBrandAsset(
    { projectId, name, kind, storagePath: path, createdBy: user.id, groupId },
    supabase
  );

  revalidatePath('/assets');
}

export async function deleteBrandAssetAction(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    throw new Error('You must be signed in to delete brand assets.');
  }
  await deleteBrandAsset(id, supabase);
  revalidatePath('/assets');
}
