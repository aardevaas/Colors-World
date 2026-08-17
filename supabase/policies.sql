-- Colors World — RLS policies, safely re-runnable.
--
-- WHY THIS FILE EXISTS, separately from enable-rls.sql:
--
-- `enable-rls.sql` opens with a one-time bootstrap block (Part A) that
-- backfills pre-accounts palettes to a single owner, and deliberately
-- `raise exception`s unless exactly one profile exists. That guard is
-- correct — that block really is only safe to run once — but it has a
-- consequence that cost real debugging time on 2026-08-17: **once you have
-- more than one user, `enable-rls.sql` can no longer be run at all.** The
-- exception aborts the whole script in the Supabase SQL editor, so Parts B
-- and C (turning RLS on, and every policy definition) silently never
-- execute. The policies then drift from what the repo says they are, with
-- nothing to re-apply them.
--
-- That is exactly what happened: the live `projects` table had RLS on and a
-- working SELECT policy, but no INSERT policy matching the repo's
-- definition — so every anonymous visitor hit
-- `new row violates row-level security policy for table "projects"` the
-- moment /studio tried to auto-provision their Personal project, which
-- broke the entire zero-signup-wall promise.
--
-- This file is the policy layer alone: no bootstrap, no data migration, no
-- destructive statements. Every statement is idempotent, so it is safe to
-- run any time, as many times as you like, at any user count. Treat this as
-- the source of truth for policies from now on; `enable-rls.sql` is kept
-- only as the historical record of the one-time bootstrap.
--
-- Run in: Supabase SQL editor.

-- ============================================================================
-- RLS on. (No-op where already enabled.)
-- ============================================================================

alter table profiles          enable row level security;
alter table projects          enable row level security;
alter table project_members   enable row level security;
alter table palettes          enable row level security;
alter table palette_versions  enable row level security;
alter table palette_branches  enable row level security;
alter table colors            enable row level security;
alter table board_items       enable row level security;

-- Shared helper: is the current user a member of this project (owner or not)?
-- security definer + a fixed search_path so this reads reliably from inside
-- RLS policy evaluation, where the caller's own privileges are otherwise
-- exactly what's being restricted.
create or replace function is_project_member(target_project uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = target_project and user_id = auth.uid()
  );
$$;

-- ============================================================================
-- profiles
-- ============================================================================

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from project_members pm1
      join project_members pm2 on pm1.project_id = pm2.project_id
      where pm1.user_id = auth.uid() and pm2.user_id = profiles.id
    )
  );

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

-- ============================================================================
-- projects — visible and usable only to members.
--
-- projects_insert is the one that was missing live. Note it intentionally
-- admits anonymous users: they carry a real auth.uid() (role `authenticated`,
-- `is_anonymous: true`), and /studio auto-provisions a Personal project for
-- every visitor. See the note at the bottom of this file about what that
-- means at scale.
-- ============================================================================

drop policy if exists projects_select on projects;
create policy projects_select on projects
  for select using (is_project_member(id));

drop policy if exists projects_insert on projects;
create policy projects_insert on projects
  for insert with check (owner_id = auth.uid());

drop policy if exists projects_update_owner on projects;
create policy projects_update_owner on projects
  for update using (owner_id = auth.uid());

drop policy if exists projects_delete_owner on projects;
create policy projects_delete_owner on projects
  for delete using (owner_id = auth.uid());

-- ============================================================================
-- project_members — members see co-members; only the owner adds or removes
-- people, except a member may remove themselves (leave).
-- ============================================================================

drop policy if exists project_members_select on project_members;
create policy project_members_select on project_members
  for select using (is_project_member(project_id));

drop policy if exists project_members_insert on project_members;
create policy project_members_insert on project_members
  for insert with check (
    exists (select 1 from projects where id = project_id and owner_id = auth.uid())
  );

drop policy if exists project_members_delete on project_members;
create policy project_members_delete on project_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from projects where id = project_id and owner_id = auth.uid())
  );

-- ============================================================================
-- palettes, palette_versions, palette_branches — scoped transitively through
-- palettes.project_id. Versions/branches have no project_id of their own
-- (deliberately not duplicated onto every child row), so their policies join
-- back up to the palette that owns them.
-- ============================================================================

drop policy if exists palettes_all on palettes;
create policy palettes_all on palettes
  for all using (is_project_member(project_id))
  with check (is_project_member(project_id));

drop policy if exists palette_versions_all on palette_versions;
create policy palette_versions_all on palette_versions
  for all using (
    exists (
      select 1 from palettes
      where palettes.id = palette_versions.palette_id
        and is_project_member(palettes.project_id)
    )
  );

drop policy if exists palette_branches_all on palette_branches;
create policy palette_branches_all on palette_branches
  for all using (
    exists (
      select 1 from palettes
      where palettes.id = palette_branches.palette_id
        and is_project_member(palettes.project_id)
    )
  );

-- ============================================================================
-- board_items — the Studio Wall itself, directly project-scoped.
-- ============================================================================

drop policy if exists board_items_all on board_items;
create policy board_items_all on board_items
  for all using (is_project_member(project_id))
  with check (is_project_member(project_id));

-- ============================================================================
-- colors — shared reference data, not project-scoped. Writes stay
-- service-role-only (ingestion scripts), so there is deliberately no
-- insert/update/delete policy: RLS denies those outright for the
-- anon-key/authenticated role.
-- ============================================================================

drop policy if exists colors_select on colors;
create policy colors_select on colors
  for select using (auth.uid() is not null);

-- ============================================================================
-- KNOWN SCALING CONSIDERATION — not a bug, a decision to revisit.
--
-- Because every anonymous visitor gets a real session, and /studio
-- auto-provisions a Personal project on first visit, an unauthenticated
-- crawler or a burst of traffic creates one `projects` row + one
-- `project_members` row per visitor, permanently. At ~10 known users that is
-- irrelevant. At the traffic a public launch is aiming for it is not.
--
-- Options when that becomes real: provision the project lazily on first
-- *write* rather than on first *view*, reap anonymous projects that never
-- accumulated board items after N days, or gate /studio behind a real
-- account while /library and /builder stay open. Deliberately not solved
-- here — flagged so it is a choice rather than a surprise.
-- ============================================================================
