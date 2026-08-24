import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { AssetKind, ProjectRole } from '@/lib/brand/project';

/**
 * The database and the registry, held to the same vocabulary.
 *
 * Two columns had quietly disagreed with `src/lib/brand/project.ts` —
 * `project_members.role` defaulted to a value the contract does not contain,
 * and `brand_assets.kind` allowed a set that overlapped it without matching.
 * Neither file looked wrong on its own, which is exactly how a persistence
 * layer and a contract drift apart.
 *
 * These read the DDL and compare it to the unions, so the next divergence
 * fails a run rather than surviving to production. They cannot see the live
 * database — a schema file that has not been applied still passes — so this
 * checks that the intent is consistent, not that the migration was run.
 */

const sql = (name: string) =>
  readFileSync(join(process.cwd(), 'supabase', name), 'utf8');

/** The values inside `check (col in ('a', 'b'))`, in declaration order. */
function checkedValues(ddl: string, column: string): readonly string[] {
  const pattern = new RegExp(`check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)`, 'i');
  const match = pattern.exec(ddl);
  if (match === null) return [];
  return [...match[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

// Exhaustive by construction: adding a member to either union without adding
// it here is a type error, so the lists cannot fall behind the contract.
const ROLES: readonly ProjectRole[] = ['owner', 'editor', 'reviewer', 'viewer'];
const KINDS: readonly AssetKind[] = ['mark', 'image', 'font', 'document'];

describe('project_members.role', () => {
  const ddl = sql('schema.sql');

  test('is constrained to exactly the roles the registry defines', () => {
    expect([...checkedValues(ddl, 'role')].sort()).toEqual([...ROLES].sort());
  });

  test('defaults to the least privilege there is', () => {
    // A membership row written without an explicit role is a bug, and the safe
    // reading of a bug in an access column grants nothing.
    expect(/role text not null default 'viewer'/.test(ddl)).toBe(true);
  });

  test('no longer carries the retired default', () => {
    expect(ddl).not.toContain("default 'member'");
  });
});

describe('brand_assets.kind', () => {
  const ddl = sql('brand-assets.sql');

  test('is constrained to exactly the kinds the registry defines', () => {
    expect([...checkedValues(ddl, 'kind')].sort()).toEqual([...KINDS].sort());
  });

  test('no longer allows the retired values', () => {
    for (const retired of ["'logo'", "'other'"]) {
      expect(ddl).not.toContain(retired);
    }
  });
});

describe('the reconciliation migration', () => {
  const migration = sql('reconcile-2026-08-24.sql');

  test('is transactional, so a half-applied schema is not a state', () => {
    expect(migration).toMatch(/^\s*begin;/m);
    expect(migration).toMatch(/^\s*commit;/m);
  });

  test('drops each constraint before adding it, so it can be re-run', () => {
    // The property `policies.sql` has and `enable-rls.sql` does not.
    expect(migration).toContain('drop constraint if exists project_members_role_check');
    expect(migration).toContain('drop constraint if exists brand_assets_kind_check');
  });

  test('moves every retired value somewhere the new constraint accepts', () => {
    // A CHECK cannot be added to a column holding values it would reject, so
    // the updates have to come first and cover everything.
    expect(migration).toContain("update project_members set role = 'editor' where role = 'member'");
    expect(migration).toContain("update brand_assets set kind = 'mark' where kind in ('logo', 'mark')");
    expect(migration).toContain("update brand_assets set kind = 'document' where kind = 'other'");
  });

  test('sweeps unrecognised values rather than trusting the known set', () => {
    expect(migration).toMatch(/role not in \('owner', 'editor', 'reviewer', 'viewer'\)/);
    expect(migration).toMatch(/kind not in \('mark', 'image', 'font', 'document'\)/);
  });
});
