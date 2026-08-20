import { afterEach, describe, expect, it, vi } from 'vitest';
import { REPO_URL, repoStats } from '../repo-stats';

/**
 * Every test here is a failure mode, because that is the whole design: a star
 * count is worth showing and is never worth a slow or broken page, so each way
 * this can go wrong has to resolve to "render without the number".
 */

/** Typed to fetch's own signature so the recorded calls stay inspectable —
 *  an implementation taking no arguments infers `[]` and makes every
 *  assertion about what was requested a type error. */
type FetchArgs = Parameters<typeof fetch>;

function mockFetch(implementation: (...args: FetchArgs) => Promise<Response> | Response) {
  const spy = vi.fn<(...args: FetchArgs) => Promise<Response> | Response>(implementation);
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('repoStats', () => {
  it('reads the count from a good response', async () => {
    mockFetch(() => new Response(JSON.stringify({ stargazers_count: 1234 }), { status: 200 }));
    expect(await repoStats()).toEqual({ stars: 1234 });
  });

  it('asks GitHub for the repository the site actually links to', async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ stargazers_count: 1 }), { status: 200 }));
    await repoStats();
    const requested = String(spy.mock.calls[0]?.[0]);
    // The strip's link and its number have to describe the same repository.
    expect(REPO_URL).toContain('aardevaas/Colors-World');
    expect(requested).toContain('aardevaas/Colors-World');
  });

  it('returns no count when GitHub rate-limits, which it will', async () => {
    mockFetch(() => new Response('{"message":"API rate limit exceeded"}', { status: 403 }));
    expect(await repoStats()).toEqual({ stars: null });
  });

  it('returns no count when the request throws', async () => {
    mockFetch(() => Promise.reject(new Error('network down')));
    await expect(repoStats()).resolves.toEqual({ stars: null });
  });

  it('returns no count when the request times out', async () => {
    mockFetch(() => Promise.reject(new DOMException('The operation was aborted.', 'TimeoutError')));
    await expect(repoStats()).resolves.toEqual({ stars: null });
  });

  it('returns no count for a body that is not JSON', async () => {
    mockFetch(() => new Response('<html>nope</html>', { status: 200 }));
    await expect(repoStats()).resolves.toEqual({ stars: null });
  });

  it('ignores a payload whose shape changed', async () => {
    for (const body of ['null', '[]', '"a string"', '{}', '{"stargazers_count":"many"}']) {
      mockFetch(() => new Response(body, { status: 200 }));
      expect(await repoStats()).toEqual({ stars: null });
    }
  });

  it('rejects a nonsensical count rather than rendering it', async () => {
    for (const value of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      mockFetch(() => new Response(JSON.stringify({ stargazers_count: value }), { status: 200 }));
      expect(await repoStats()).toEqual({ stars: null });
    }
  });

  it('floors a fractional count instead of printing a decimal star', async () => {
    mockFetch(() => new Response(JSON.stringify({ stargazers_count: 12.7 }), { status: 200 }));
    expect(await repoStats()).toEqual({ stars: 12 });
  });

  it('bounds the request so a hanging GitHub cannot hang the page', async () => {
    const spy = mockFetch(() => new Response(JSON.stringify({ stargazers_count: 1 }), { status: 200 }));
    await repoStats();
    const init = spy.mock.calls[0]?.[1] as
      | (RequestInit & { next?: { revalidate?: number } })
      | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    // And cached, so ordinary traffic cannot multiply into rate-limit failures.
    expect(init?.next?.revalidate).toBeGreaterThan(0);
  });
});
