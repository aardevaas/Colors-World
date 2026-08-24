-- ============================================================================
-- Reconciling two columns with the registry, BEFORE data exists.
--
-- `src/lib/brand/project.ts` is the contract the Book renders from, and two
-- database columns disagreed with it. Both are cheap to change now and
-- expensive later: a CHECK constraint cannot be added to a column that already
-- holds values it would reject, so the window for this closes the moment real
-- projects and real uploads exist.
--
--   project_members.role  default 'member', no constraint
--                      →  owner | editor | reviewer | viewer, constrained
--
--   brand_assets.kind     logo | mark | other
--                      →  mark | image | font | document
--
-- IDEMPOTENT. Run it more than once safely — the same property `policies.sql`
-- has and `enable-rls.sql` does not. Every step re-checks its own precondition
-- rather than assuming the previous run's state.
--
-- Run as the service role in the SQL editor.
-- ============================================================================

begin;

-- ---------------------------------------------------------------- roles ----

-- Existing 'member' rows meant "somebody added to a project", which under the
-- registry's vocabulary is an editor: they were added to work, not to watch.
-- Anything else already unrecognised is dropped to the least privilege it can
-- have rather than guessed upward.
update project_members set role = 'editor' where role = 'member';
update project_members
   set role = 'viewer'
 where role not in ('owner', 'editor', 'reviewer', 'viewer');

alter table project_members
  drop constraint if exists project_members_role_check;

alter table project_members
  add constraint project_members_role_check
  check (role in ('owner', 'editor', 'reviewer', 'viewer'));

-- 'viewer', not 'editor'. A membership row written without an explicit role is
-- a bug somewhere, and the safe reading of a bug in an access column is the
-- one that grants nothing.
alter table project_members alter column role set default 'viewer';

-- ---------------------------------------------------------------- kinds ----

-- 'logo' and 'mark' both become 'mark': the registry's distinction is not
-- logo-versus-mark but "vector geometry M1 can derive from" versus everything
-- else, and both of the old values meant the former.
update brand_assets set kind = 'mark' where kind in ('logo', 'mark');

-- 'other' was the catch-all and 'document' is the registry's. Nothing is lost
-- that was not already unlabelled.
update brand_assets set kind = 'document' where kind = 'other';

update brand_assets
   set kind = 'document'
 where kind not in ('mark', 'image', 'font', 'document');

alter table brand_assets
  drop constraint if exists brand_assets_kind_check;

alter table brand_assets
  add constraint brand_assets_kind_check
  check (kind in ('mark', 'image', 'font', 'document'));

commit;

-- ---------------------------------------------------------------- check ----
-- Expect: every role in the four, every kind in the four, and no row left on
-- a retired value.
--
--   select role, count(*) from project_members group by role order by role;
--   select kind, count(*) from brand_assets    group by kind order by kind;
