'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { encodeSystem } from '@/lib/system/codec';
import { useSystem } from '@/lib/system/system-context';

interface SystemLinkProps {
  /** Route to link to, without a query string. */
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A link between rooms that carries the System with it.
 *
 * Navigating with a bare href does still work — the provider falls back to
 * `localStorage` and rewrites the address — but relying on that leaves the URL
 * briefly wrong and quietly breaks the cases where storage is not consulted at
 * all: opening a room in a new tab, copying a link out of the nav, or sending
 * one to someone whose browser has never been here. The System is supposed to
 * be in the address; a link that drops it is a link that lies.
 *
 * A deliberately small client component so `TabNav` can stay a server
 * component. Navigation markup is identical on every render of a route and has
 * no business shipping a client bundle; only the href needs the System, so only
 * the href crosses the boundary.
 */
export function SystemLink({ href, className, children }: SystemLinkProps) {
  const { system } = useSystem();
  const query = encodeSystem(system);

  return (
    <Link href={query === '' ? href : `${href}?${query}`} className={className}>
      {children}
    </Link>
  );
}
