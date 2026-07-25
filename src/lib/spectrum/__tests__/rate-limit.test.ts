import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../rate-limit';

describe('createRateLimiter', () => {
  it('allows requests up to the limit', () => {
    const limiter = createRateLimiter(3, 1000, () => 0);
    expect(limiter.tryConsume('key')).toBe(true);
    expect(limiter.tryConsume('key')).toBe(true);
    expect(limiter.tryConsume('key')).toBe(true);
  });

  it('rejects the request that exceeds the limit', () => {
    const limiter = createRateLimiter(2, 1000, () => 0);
    expect(limiter.tryConsume('key')).toBe(true);
    expect(limiter.tryConsume('key')).toBe(true);
    expect(limiter.tryConsume('key')).toBe(false);
  });

  it('does not record a rejected attempt against the window', () => {
    const limiter = createRateLimiter(1, 1000, () => 0);
    expect(limiter.tryConsume('key')).toBe(true);
    expect(limiter.tryConsume('key')).toBe(false);
    expect(limiter.tryConsume('key')).toBe(false); // still rejected, not double-counted into allowing more
  });

  it('allows a request again once the window has passed', () => {
    let time = 0;
    const limiter = createRateLimiter(1, 1000, () => time);
    expect(limiter.tryConsume('key')).toBe(true);
    expect(limiter.tryConsume('key')).toBe(false);
    time = 1001;
    expect(limiter.tryConsume('key')).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const limiter = createRateLimiter(1, 1000, () => 0);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('b')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
    expect(limiter.tryConsume('b')).toBe(false);
  });
});
