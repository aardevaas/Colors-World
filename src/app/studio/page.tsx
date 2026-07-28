import Link from 'next/link';
import { redirect } from 'next/navigation';
import { listBoardItems } from '@/lib/supabase/board';
import { resolveDefaultProjectId } from '@/lib/supabase/projects';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import { hydrateBoardCard } from '@/lib/board/hydrate-card';
import { AccountStatus } from '@/components/auth/AccountStatus';
import { StudioWallBoard } from '@/components/studio-wall/StudioWallBoard';
import { ShareControl } from '@/components/studio-wall/ShareControl';
import styles from '@/components/studio-wall/studio-wall.module.css';

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
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ studio</span>
        </h1>
        <nav className={styles.navGroup}>
          <Link href="/builder" className={styles.navLink}>
            builder
          </Link>
          <Link href="/library" className={styles.navLink}>
            library
          </Link>
          <Link href="/palettes" className={styles.navLink}>
            palettes
          </Link>
          <Link href="/assets" className={styles.navLink}>
            assets
          </Link>
        </nav>
        <ShareControl />
        <AccountStatus />
      </header>

      <StudioWallBoard initialCards={cards} />
    </div>
  );
}
