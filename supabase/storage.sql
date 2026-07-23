-- PRISM — Supabase Storage for the Studio Wall's image board items
-- (roadmap phase 4: reference photos, logos, brand assets).
--
-- Safe to run any time after enable-rls.sql (needs is_project_member(), and
-- storage.objects already has RLS forced on by Supabase itself — this file
-- does not enable or disable RLS anywhere, only adds policies to it).
--
-- Path convention: every object is stored at `{project_id}/{uuid}-{filename}`.
-- Policies check membership by parsing the project_id back out of the path
-- rather than a separate metadata table — one bucket serves every project,
-- and the path prefix *is* the scoping key.

insert into storage.buckets (id, name, public)
values ('board-assets', 'board-assets', false)
on conflict (id) do nothing;

drop policy if exists board_assets_select on storage.objects;
create policy board_assets_select on storage.objects
  for select using (
    bucket_id = 'board-assets'
    and is_project_member((split_part(name, '/', 1))::uuid)
  );

drop policy if exists board_assets_insert on storage.objects;
create policy board_assets_insert on storage.objects
  for insert with check (
    bucket_id = 'board-assets'
    and is_project_member((split_part(name, '/', 1))::uuid)
  );

drop policy if exists board_assets_delete on storage.objects;
create policy board_assets_delete on storage.objects
  for delete using (
    bucket_id = 'board-assets'
    and is_project_member((split_part(name, '/', 1))::uuid)
  );
