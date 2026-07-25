/**
 * A minimal sliding-window rate limiter — protects the Gemini vibe-search
 * free-tier quota from being burned through by a burst of traffic, not a
 * general-purpose rate-limiting solution.
 *
 * Explicitly single-process, in-memory, not distributed: on a
 * multi-instance deployment (or any redeploy, which clears this process's
 * memory), each instance/restart gets its own independent budget rather
 * than one shared one. That's an honest limitation, not an oversight — a
 * real distributed limiter needs a shared store (Redis, Upstash, etc.),
 * which this project doesn't have yet. For a single small-scale deployment
 * protecting a genuinely free API tier, "good enough, not perfect" is the
 * right amount of engineering to spend here today.
 *
 * `now` is injectable specifically so tests don't need real wall-clock
 * delays to exercise window expiry.
 */
export interface RateLimiter {
  /** Returns true and records the attempt if `key` is under its limit for
   *  the current window; returns false (and does NOT record) if not. */
  tryConsume(key: string): boolean;
}

export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  now: () => number = Date.now
): RateLimiter {
  const hitsByKey = new Map<string, number[]>();

  return {
    tryConsume(key: string): boolean {
      const currentTime = now();
      const windowStart = currentTime - windowMs;
      const stillInWindow = (hitsByKey.get(key) ?? []).filter((t) => t > windowStart);

      if (stillInWindow.length >= maxRequests) {
        hitsByKey.set(key, stillInWindow);
        return false;
      }

      stillInWindow.push(currentTime);
      hitsByKey.set(key, stillInWindow);
      return true;
    },
  };
}
