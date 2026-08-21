-- PRISM — enabling Row Level Security (roadmap phase 3, part 2).
--
-- DO NOT RUN THIS until all of the following are true:
--   1. schema.sql (the version with profiles/projects/project_members) has
--      been run.
--   2. You have signed in at least once via the magic-link flow at /login,
--      so a real row exists in `profiles`.
--   3. NEXT_PUBLIC_SUPABASE_ANON_KEY is set in .env.local and the app is
--      using the per-request client (src/lib/supabase/server-client.ts) for
--      app traffic, not the service-role client.
--
-- Running this before step 2 locks everyone out of every row in the
-- project-scoped tables — there would be no profile for any policy's
-- auth.uid() check to match. The bootstrap block below enforces this itself:
-- it refuses to run unless exactly one profile exists, which is true only
-- once, right after the very first sign-up.

-- ============================================================================
-- Part A — one-time bootstrap: give existing data a home.
--
-- Every palette created before accounts existed has project_id = null.
-- This reassigns every orphaned palette to a "Personal" project owned by
-- whoever just signed up. Idempotent on the project itself — if the app has
-- already auto-provisioned one (visiting the Studio Wall does this the
-- moment someone signs in, via resolveDefaultProjectId), this reuses it
-- instead of creating a duplicate. Safe exactly once, at exactly this
-- moment — the guard below is not decoration.
-- ============================================================================

do $$
declare
  the_owner uuid;
  the_project uuid;
begin
  if (select count(*) from profiles) <> 1 then
    raise exception
      'Expected exactly one profile at bootstrap time, found %. '
      'This block backfills orphaned palettes to a single owner and is only '
      'safe to run once, right after the first sign-up — if you already have '
      'more than one user, assign project_id per-palette by hand instead.',
      (select count(*) from profiles);
  end if;

  select id into the_owner from profiles limit 1;

  select id into the_project
  from projects
  where owner_id = the_owner
  order by created_at asc
  limit 1;

  if the_project is null then
    insert into projects (name, owner_id)
    values ('Personal', the_owner)
    returning id into the_project;

    insert into project_members (project_id, user_id, role)
    values (the_project, the_owner, 'owner');
  end if;

  update palettes set project_id = the_project where project_id is null;
end $$;

-- Every palette has a home now — safe to enforce going forward.
alter table palettes alter column project_id set not null;

-- ============================================================================
-- Part B — turn RLS on, everywhere it matters.
-- ============================================================================

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table palettes enable row level security;
alter table palette_versions enable row level security;
alter table palette_branches enable row level security;
alter table colors enable row level security;
alter table board_items enable row level security;

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

-- profiles: everyone can see the profiles of people they share a project
-- with (so a member list can show names/emails), and can always see and
-- update their own row.
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

-- projects: visible and usable only to members.
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

-- project_members: members can see their co-members; only the owner adds
-- or removes people, except a member may remove themselves (leave).
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

-- palettes, palette_versions, palette_branches: scoped transitively through
-- palettes.project_id. Versions/branches have no project_id of their own —
-- deliberately not duplicated onto every child row — so their policies join
-- back up to the palette that owns them.
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

-- board_items: the Studio Wall itself — directly project-scoped, same shape
-- as palettes_all.
drop policy if exists board_items_all on board_items;
create policy board_items_all on board_items
  for all using (is_project_member(project_id))
  with check (is_project_member(project_id));

-- colors: shared reference data, not project-scoped — every signed-in
-- member of this ~10-person install can browse the whole 100K-color
-- library. Writes stay service-role-only (ingestion scripts), so there is
-- no insert/update/delete policy here at all — RLS defaults to denying
-- those outright for the anon-key/authenticated role.
drop policy if exists colors_select on colors;
create policy colors_select on colors
  for select using (auth.uid() is not null);
