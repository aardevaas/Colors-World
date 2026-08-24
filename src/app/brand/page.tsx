import type { Metadata } from 'next';
import { AccountStatus } from '@/components/auth/AccountStatus';
import { BookDocument } from '@/components/brand/BookDocument';
import { SystemUrlBridge } from '@/components/brand/SystemUrlBridge';
import { SkipLink, RoomMain } from '@/components/nav/SkipLink';
import { TabNav } from '@/components/nav/TabNav';
import { parseBookView } from '@/lib/brand/view';
import { decodeSystem } from '@/lib/system/codec';
import styles from '@/components/brand/book.module.css';

export const metadata: Metadata = {
  title: 'brand',
  description:
    'The internal guideline, rendered from the system you built and re-checked every time it changes.',
};

interface PageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The guideline.
 *
 * A SERVER component, and that is the load-bearing decision. The registry
 * imports every component's renderer and, through §4, the ~385KB font
 * catalogue; rendering here means none of it reaches the browser. The document
 * is markup and anchors, so it needs no client JavaScript to be read.
 *
 * The System arrives in the query string — the same encoding every other room
 * shares — so this page has no state of its own and cannot drift from the rooms
 * that produced it. `SystemUrlBridge` covers the one case the query string
 * cannot: a bookmark landing here bare while the System sits in localStorage.
 */
export default async function BrandPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Rebuild the query exactly as the codec wrote it. Re-encoding through
  // URLSearchParams keeps a hand-edited or duplicated key from reaching the
  // decoder as something it never emits.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) query.set(key, value[0]);
  }

  const system = decodeSystem(query.toString());
  // The view rides in the same query string and the codec ignores it, so a
  // shared link always hands over the whole internal guideline — trimming it
  // is a choice made at the moment of export, not one that travels.
  const view = parseBookView(query);

  return (
    <div className={styles.shell}>
      <SkipLink />
      <TabNav current="brand">
        <AccountStatus />
      </TabNav>
      <SystemUrlBridge />
      <RoomMain className={styles.roomMain}>
        {/* project: null — the guideline renders for a visitor with no account.
            That is the whole point of the split state model, and §3 and §4 are
            the half that lives in the URL. */}
        <BookDocument state={{ system, project: null }} view={view} />
      </RoomMain>
    </div>
  );
}
