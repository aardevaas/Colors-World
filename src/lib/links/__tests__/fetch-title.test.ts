import { describe, expect, test } from 'vitest';
import { isBlockedIpv4 } from '../fetch-title';

describe('isBlockedIpv4 — SSRF guard', () => {
  test('blocks loopback', () => {
    expect(isBlockedIpv4('127.0.0.1')).toBe(true);
  });

  test('blocks RFC1918 private ranges', () => {
    expect(isBlockedIpv4('10.0.0.5')).toBe(true);
    expect(isBlockedIpv4('172.16.0.1')).toBe(true);
    expect(isBlockedIpv4('172.31.255.255')).toBe(true);
    expect(isBlockedIpv4('192.168.1.1')).toBe(true);
  });

  test('blocks link-local (cloud metadata range)', () => {
    expect(isBlockedIpv4('169.254.169.254')).toBe(true);
  });

  test('blocks CGNAT range', () => {
    expect(isBlockedIpv4('100.64.0.1')).toBe(true);
  });

  test('allows an ordinary public address', () => {
    expect(isBlockedIpv4('93.184.216.34')).toBe(false);
    expect(isBlockedIpv4('8.8.8.8')).toBe(false);
  });

  test('does not false-positive on a public address that merely starts similarly to a private one', () => {
    // 172.32.x.x is outside the 172.16.0.0/12 block (which ends at 172.31.255.255).
    expect(isBlockedIpv4('172.32.0.1')).toBe(false);
  });

  test('fails closed on an unparseable address', () => {
    expect(isBlockedIpv4('not-an-ip')).toBe(true);
  });
});
