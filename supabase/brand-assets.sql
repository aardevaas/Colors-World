-- PRISM — brand asset library (roadmap phase 5): logos, marks, variants,
-- per project, with simple re-upload versioning.
--
-- Safe to run any time after enable-rls.sql (needs is_project_member()).
-- Assets live in the same 'board-assets' storage bucket from storage.sql,
-- under a brand/{group_id}/ prefix — no separate bucket needed, and the
-- existing storage RLS policies (scoped by the leading project_id path
-- segment) already cover this prefix.
--
-- group_id ties every version of "the same asset" together; version is a
-- plain incrementing integer per group, not a full DAG like palettes — a
-- logo doesn't branch or merge, it just gets replaced, and "what did this
-- look like before" is enough history for this to be useful.

create table if not exists brand_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  group_id uuid not null default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('logo', 'mark', 'other')),
  version integer not null default 1,
  storage_path text not null,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists brand_assets_project_id_idx on brand_assets (project_id);
create index if not exists brand_assets_group_id_idx on brand_assets (group_id);

alter table brand_assets enable row level security;

drop policy if exists brand_assets_all on brand_assets;
create policy brand_assets_all on brand_assets
  for all using (is_project_member(project_id))
  with check (is_project_member(project_id));
