import { LibraryShell } from '@/components/library/LibraryShell';

/**
 * Tab 01: an infinite, generated-on-demand grid (see generate-color.ts) with
 * a curated-data semantic overlay (see getSemanticMatches) and Gemini-backed
 * vibe search — entirely client-driven virtualization + local state, so this
 * server component's only job is to mount the shell. Compare the old
 * server-rendered `searchColors`/`countColors` page this replaces, which
 * queried a finite curated table directly; that table is now an enrichment
 * layer joined in underneath the arithmetic engine, not the primary source.
 */
export default function LibraryPage() {
  return <LibraryShell />;
}
