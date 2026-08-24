/**
 * Test fixtures for the brand registry.
 *
 * Deliberately built from the real `EMPTY_SYSTEM` rather than a hand-written
 * literal, so a change to the System's shape breaks these loudly instead of
 * letting the registry's tests pass against a System that no longer exists.
 */

import { parseColor } from '@/lib/color-engine';
import { EMPTY_SYSTEM } from '@/lib/system/defaults';
import type { System } from '@/lib/system/types';
import type { Approval, BrandAsset, Project } from '../project';
import type { BrandState } from '../types';

export function systemWith(hexes: readonly string[], overrides: Partial<System> = {}): System {
  return {
    ...EMPTY_SYSTEM,
    palette: hexes.map((hex, i) => ({ hex, oklch: parseColor(hex), addedAt: i })),
    anchorHex: hexes[0] ?? null,
    ...overrides,
  };
}

export function projectWith(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Test project',
    ownerId: 'u1',
    members: [{ userId: 'u1', role: 'owner' }],
    assets: [],
    text: {},
    data: {},
    approvals: [],
    versionId: 'v2',
    createdAt: 0,
    ...overrides,
  };
}

export function mark(overrides: Partial<BrandAsset> = {}): BrandAsset {
  return {
    id: 'a1',
    kind: 'mark',
    format: 'svg',
    url: 'https://example.test/mark.svg',
    label: 'Primary mark',
    componentId: 'logo.primary',
    addedAt: 0,
    ...overrides,
  };
}

export function approval(overrides: Partial<Approval> = {}): Approval {
  return {
    componentId: 'colour.palette',
    versionId: 'v2',
    userId: 'u1',
    state: 'approved',
    decidedAt: 1,
    ...overrides,
  };
}

/** The anonymous visitor: a System and no account. The majority case. */
export const ANONYMOUS_EMPTY: BrandState = { system: EMPTY_SYSTEM, project: null };

export function stateOf(system: System, project: Project | null = null): BrandState {
  return { system, project };
}
