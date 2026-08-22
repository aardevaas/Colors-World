import 'server-only';

/**
 * Public facts about the repository, for the landing page's credibility strip.
 *
 * The star count is worth showing and is not worth a slow page. GitHub's
 * unauthenticated API allows sixty requests an hour per IP and can be slow or
 * unreachable, so every failure mode here resolves to "render without the
 * number" rather than to an error or a delay:
 *
 * - the response is cached for an hour, so traffic does not multiply into
 *   rate-limit failures;
 * - the request is abandoned after two seconds, because a star count is never
 *   worth making someone wait for the page;
 * - anything unexpected in the payload is treated as absent.
 *
 * The consequence is deliberate: the strip is designed to read correctly with
 * no number at all, and the number is a bonus rather than a load-bearing part
 * of the layout.
 */

export { REPO_URL } from './repo';

const API_URL = 'https://api.github.com/repos/aardevaas/Colors-World';
const CACHE_SECONDS = 3600;
const TIMEOUT_MS = 2000;

export interface RepoStats {
  readonly stars: number | null;
}

export async function repoStats(): Promise<RepoStats> {
  try {
    const response = await fetch(API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return { stars: null };

    const payload: unknown = await response.json();
    return { stars: readStars(payload) };
  } catch {
    // Offline, rate-limited, timed out, or the shape changed. The page is the
    // same page without a number in it.
    return { stars: null };
  }
}

function readStars(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const value = (payload as { stargazers_count?: unknown }).stargazers_count;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}
