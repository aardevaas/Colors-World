import { notFound } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { listBoardItems } from '@/lib/supabase/board';
import { resolveShareToken } from '@/lib/supabase/sharing';
import { hydrateBoardCard } from '@/lib/board/hydrate-card';
import { StudioWallBoard } from '@/components/studio-wall/StudioWallBoard';
import styles from '@/components/studio-wall/studio-wall.module.css';

interface PageProps {
  readonly params: Promise<{ token: string }>;
}

// Revocation must take effect immediately. Nothing caches this today, but a
// future cache helper wrapped around the read here would silently break
// that guarantee — pin it explicitly rather than relying on today's defaults.
export const dynamic = 'force-dynamic';

/**
 * The one page in this app an anonymous visitor can load. No middleware
 * gate, no sign-in redirect — the token itself is the credential. Every
 * query here is deliberately scoped to exactly the project the token
 * resolved to; nothing on this route ever takes a project id from the
 * request. See supabase/sharing.sql for the authorization model this leans on.
 */
export default async function SharedBoardPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = getSupabaseClient();

  const resolved = await resolveShareToken(token, supabase);
  if (resolved === null) notFound();

  const items = await listBoardItems(resolved.projectId, supabase);
  const cards = await Promise.all(items.map((item) => hydrateBoardCard(item, supabase)));

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ shared, read-only</span>
        </h1>
      </header>

      <StudioWallBoard initialCards={cards} readOnly />
    </div>
  );
}
