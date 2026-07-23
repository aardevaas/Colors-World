import 'server-only';
import { lookup } from 'node:dns/promises';
import { extractTitleFromHtml } from './parse-title';

const FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES_TO_READ = 100_000;

/**
 * IPv4 ranges that must never be reachable from a server-side "unfurl this
 * URL" fetch: loopback, link-local, RFC1918 private space, and CGNAT. This
 * is the standard SSRF guard for any endpoint that fetches a user-supplied
 * URL — without it, "add a link" becomes a way to probe or hit internal
 * services (including cloud metadata endpoints) from the server's network.
 */
const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

export function isBlockedIpv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  if (target === null) return true; // unparseable — fail closed
  return BLOCKED_IPV4_RANGES.some(([base, prefix]) => {
    const baseInt = ipv4ToInt(base)!;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (target & mask) === (baseInt & mask);
  });
}

/**
 * IPv6 is default-denied rather than range-checked — correctly enumerating
 * "global unicast" is easy to get subtly wrong, and this tool only needs
 * best-effort link previews, not universal IPv6 reachability.
 */
function isSafeResolvedAddress(address: string, family: number): boolean {
  if (family === 6) return false;
  return !isBlockedIpv4(address);
}

async function assertSafeToFetch(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Refusing to fetch a non-HTTP(S) URL: ${url.protocol}`);
  }

  const resolved = await lookup(url.hostname, { all: true });
  if (resolved.length === 0) {
    throw new Error(`Could not resolve host: ${url.hostname}`);
  }
  for (const { address, family } of resolved) {
    if (!isSafeResolvedAddress(address, family)) {
      throw new Error(`Refusing to fetch a URL that resolves to a private/internal address.`);
    }
  }
}

/**
 * Best-effort page-title fetch for a link board item. Never throws for the
 * caller's convenience — pinning a link should still succeed (falling back
 * to the URL itself as the title) even when the target is unreachable,
 * slow, or blocked by the SSRF guard above.
 */
export async function fetchPageTitle(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  try {
    await assertSafeToFetch(url);
  } catch {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html' },
    });
    if (!response.ok || response.body === null) return null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let bytesRead = 0;

    while (bytesRead < MAX_BYTES_TO_READ) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break;
    }
    await reader.cancel().catch(() => undefined);

    return extractTitleFromHtml(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
