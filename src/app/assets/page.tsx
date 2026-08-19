import Link from 'next/link';
import { TABS } from '@/lib/nav/tabs';
import { redirect } from 'next/navigation';
import { BOARD_ASSETS_BUCKET } from '@/lib/supabase/board';
import { listBrandAssets, type BrandAssetRecord } from '@/lib/supabase/brand-assets';
import { resolveDefaultProjectId } from '@/lib/supabase/projects';
import { createServerSupabaseClient } from '@/lib/supabase/server-client';
import { deleteBrandAssetAction, uploadBrandAssetAction } from './actions';
import styles from './assets.module.css';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

interface AssetGroup {
  readonly groupId: string;
  readonly current: BrandAssetRecord;
  readonly history: readonly BrandAssetRecord[];
}

function groupByAsset(assets: readonly BrandAssetRecord[]): AssetGroup[] {
  const byGroup = new Map<string, BrandAssetRecord[]>();
  for (const asset of assets) {
    const bucket = byGroup.get(asset.groupId) ?? [];
    bucket.push(asset);
    byGroup.set(asset.groupId, bucket);
  }

  return Array.from(byGroup.entries()).map(([groupId, versions]) => {
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    return { groupId, current: sorted[0]!, history: sorted.slice(1) };
  });
}

export default async function AssetsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) redirect('/login');

  const projectId = await resolveDefaultProjectId(user.id, supabase);
  const assets = await listBrandAssets(projectId, supabase);
  const groups = groupByAsset(assets);

  const signedUrls = new Map<string, string | null>();
  await Promise.all(
    assets.map(async (asset) => {
      const { data } = await supabase.storage
        .from(BOARD_ASSETS_BUCKET)
        .createSignedUrl(asset.storagePath, SIGNED_URL_TTL_SECONDS);
      signedUrls.set(asset.id, data?.signedUrl ?? null);
    })
  );

  return (
    <div className={styles.shell}>
      <header className={styles.masthead}>
        <h1 className={styles.wordmark}>
          Colors World <span className={styles.wordmarkDim}>/ assets</span>
        </h1>
        {/* /assets is not one of the five tabs — it predates the tab model and
            its long-term home is an open question in ROADMAP.md. It links back
            into the tabs rather than rendering TabNav, which would falsely
            imply it is one of them. */}
        <nav className={styles.navGroup} aria-label="Primary">
          {TABS.filter((tab) => tab.built).map((tab) => (
            <Link key={tab.id} href={tab.href} className={styles.navLink}>
              {tab.label}
            </Link>
          ))}
          <Link href="/palettes" className={styles.navLink}>
            palettes
          </Link>
        </nav>
      </header>

      <form action={uploadBrandAssetAction} className={styles.uploadForm}>
        <input type="text" name="name" placeholder="Name — e.g. Primary logo" required className={styles.textInput} />
        <select name="kind" className={styles.kindSelect} defaultValue="logo">
          <option value="logo">Logo</option>
          <option value="mark">Mark</option>
          <option value="other">Other</option>
        </select>
        <input type="file" name="file" accept="image/*,.svg" required className={styles.fileInput} />
        <button type="submit" className={styles.uploadButton}>
          Upload
        </button>
      </form>

      {groups.length === 0 ? (
        <p className={styles.empty}>No brand assets yet — upload a logo or mark above.</p>
      ) : (
        <div className={styles.grid}>
          {groups.map(({ groupId, current, history }) => (
            <div key={groupId} className={styles.card}>
              <div className={styles.cardPreview}>
                {signedUrls.get(current.id) !== null && signedUrls.get(current.id) !== undefined ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private signed URL, not a next/image remote-pattern candidate.
                  <img src={signedUrls.get(current.id)!} alt={current.name} className={styles.previewImage} />
                ) : (
                  <div className={styles.previewFallback} />
                )}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardName}>{current.name}</div>
                <div className={styles.cardMeta}>
                  {current.kind} · v{current.version}
                </div>

                <form action={uploadBrandAssetAction} className={styles.versionForm}>
                  <input type="hidden" name="name" value={current.name} />
                  <input type="hidden" name="kind" value={current.kind} />
                  <input type="hidden" name="groupId" value={groupId} />
                  <input type="file" name="file" accept="image/*,.svg" required className={styles.fileInputSmall} />
                  <button type="submit" className={styles.smallButton}>
                    New version
                  </button>
                </form>

                <form action={deleteBrandAssetAction.bind(null, current.id)}>
                  <button type="submit" className={styles.deleteButton}>
                    Delete v{current.version}
                  </button>
                </form>

                {history.length > 0 && (
                  <details className={styles.history}>
                    <summary>{history.length} earlier version{history.length === 1 ? '' : 's'}</summary>
                    {history.map((version) => (
                      <div key={version.id} className={styles.historyRow}>
                        <span>v{version.version}</span>
                        <form action={deleteBrandAssetAction.bind(null, version.id)}>
                          <button type="submit" className={styles.deleteButtonSmall}>
                            Delete
                          </button>
                        </form>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
