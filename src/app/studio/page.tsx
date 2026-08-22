import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listBoardItems } from '@/lib/supabase/board';
import { resolveDefaultProjectId } from '@/lib/supabase/projects';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import { hydrateBoardCard } from '@/lib/board/hydrate-card';
import { AccountStatus } from '@/components/auth/AccountStatus';
import { TabNav } from '@/components/nav/TabNav';
import { StudioWallBoard } from '@/components/studio-wall/StudioWallBoard';
import { ShareControl } from '@/components/studio-wall/ShareControl';
import styles from '@/components/studio-wall/studio-wall.module.css';
import { RoomMain, SkipLink } from '@/components/nav/SkipLink';

export const metadata: Metadata = {
  title: 'studio',
  description:
    'A wall to arrange color on, shared by link.',
};

export default async function StudioWallPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    redirect('/login');
  }

  const projectId = await resolveDefaultProjectId(user.id, supabase);
  const items = await listBoardItems(projectId, supabase);
  const cards = await Promise.all(items.map((item) => hydrateBoardCard(item, supabase)));

  return (
    <div className={styles.shell}>
      <SkipLink />
      <TabNav current="studio">
        <ShareControl />
        <AccountStatus />
      </TabNav>

      <RoomMain>
        <StudioWallBoard initialCards={cards} />
      </RoomMain>
    </div>
  );
}
