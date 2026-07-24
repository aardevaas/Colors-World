-- PRISM — palette persistence schema.
--
-- Mirrors src/lib/versioning/types.ts exactly:
--   PaletteSnapshot -> palette_versions.snapshot (jsonb, token name -> CSS colour string)
--   VersionNode      -> palette_versions (id, parent_ids)
--
-- Run this once, in full, in the Supabase SQL Editor of a fresh project.
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE).

create extension if not exists pgcrypto;

-- One row per named palette (a collection of scales/tokens with its own history).
create table if not exists palettes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per commit. parent_ids is an array — 2+ entries means a merge commit,
-- which is what turns this from a linear history into a real DAG. Snapshots are
-- stored whole (not as deltas): palettes are kilobytes, so trading a little
-- storage for trivial, non-recursive history reads is the right side of that
-- trade-off.
create table if not exists palette_versions (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references palettes(id) on delete cascade,
  parent_ids uuid[] not null default '{}',
  message text,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- A named pointer at a version — "main", "warmer-autumn", etc. Branch creation
-- and fast-forwarding are just moving this pointer; findLowestCommonAncestor
-- and threeWayMerge (src/lib/versioning) operate purely on palette_versions.
create table if not exists palette_branches (
  id uuid primary key default gen_random_uuid(),
  palette_id uuid not null references palettes(id) on delete cascade,
  name text not null,
  head_version_id uuid not null references palette_versions(id),
  created_at timestamptz not null default now(),
  unique (palette_id, name)
);

-- The DAG walk in findLowestCommonAncestor fetches versions by palette
-- repeatedly and filters/searches parent_ids — both need an index or every
-- merge does a sequential scan once history grows.
create index if not exists palette_versions_palette_id_idx
  on palette_versions (palette_id);

create index if not exists palette_versions_parent_ids_idx
  on palette_versions using gin (parent_ids);

-- Keep palettes.updated_at honest without every write site having to remember to.
create or replace function touch_palette_updated_at()
returns trigger
language plpgsql
as $$
begin
  update palettes set updated_at = now() where id = new.palette_id;
  return new;
end;
$$;

drop trigger if exists palette_versions_touch_updated_at on palette_versions;
create trigger palette_versions_touch_updated_at
  after insert on palette_versions
  for each row
  execute function touch_palette_updated_at();

-- ============================================================================
-- Knowledge graph, phase 1: a flat, searchable colour library.
--
-- Deliberately NOT the generic kg_node/kg_edge graph the architecture doc
-- originally sketched. Nothing in the app yet needs cross-entity graph
-- traversal ("show every colour used in this art movement") — what it needs
-- is "type a word, find matching colours with their tags." A flat table with
-- full-text search delivers that with a fraction of the schema and query
-- complexity. Graduate to the graph model if/when a real feature (RAG
-- grounding for AI generation, a graph browser) actually needs traversal.
--
-- Seeded from boltuix/color-pedia (HF, MIT licensed, ~100K rows). That
-- dataset reads as LLM-generated bulk data with no citations — treated as a
-- *starting corpus*, not verified fact. Every row lands with
-- provenance = 'seed'; promote rows to 'curated' as they're verified. The UI
-- must surface that distinction rather than presenting seed data as
-- authoritative.
-- ============================================================================

create table if not exists colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hex text not null,
  oklch_l double precision not null,
  oklch_c double precision not null,
  oklch_h double precision not null,
  category text,
  description text,
  emotion text,
  personality text,
  mood text,
  symbolism text,
  use_case text,
  keywords text,
  contrast_level text,
  provenance text not null default 'seed',
  created_at timestamptz not null default now(),
  -- A real, stored column (not an expression index) so PostgREST's
  -- `.textSearch('search_vector', ...)` can address it directly by name.
  search_vector tsvector generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(emotion, '') || ' ' ||
      coalesce(personality, '') || ' ' ||
      coalesce(mood, '') || ' ' ||
      coalesce(symbolism, '') || ' ' ||
      coalesce(use_case, '') || ' ' ||
      coalesce(keywords, '')
    )
  ) stored
);

create index if not exists colors_search_idx on colors using gin (search_vector);
create index if not exists colors_name_idx on colors (name);

-- ============================================================================
-- The Spectrum (roadmap phase 2): every colour, perceptually ordered.
--
-- spectrum_index is a precomputed position in the hue -> lightness -> chroma
-- ordering. Offset pagination ("skip 40,000 rows") degrades badly at this
-- size, and a scrollbar representing 100K rows needs to jump to an arbitrary
-- position instantly. A stored integer column makes both trivial: any window
-- is `WHERE spectrum_index BETWEEN x AND y`, answered by the index below
-- rather than a sequential scan, and the scrollbar maps 1:1 to position.
--
-- Backfilled with a single deterministic pass rather than assigned at insert
-- time — row_number() needs the full table in view to produce a contiguous
-- 0..N-1 sequence, and re-running this block after new rows land (e.g. a
-- future curated batch) simply recomputes the same ordering, `id` breaking
-- ties so reruns are stable.
-- ============================================================================

alter table colors add column if not exists spectrum_index integer;

with ordered as (
  select
    id,
    row_number() over (
      order by oklch_h, oklch_l desc, oklch_c desc, id
    ) - 1 as rn
  from colors
)
update colors
set spectrum_index = ordered.rn
from ordered
where colors.id = ordered.id
  and colors.spectrum_index is distinct from ordered.rn;

create unique index if not exists colors_spectrum_index_idx
  on colors (spectrum_index);

-- ============================================================================
-- Accounts & projects (roadmap phase 3).
--
-- This platform was single-user with no accounts through phase 2 — that
-- premise expired the moment it became "~10 people, business and family."
-- Multi-user makes Row Level Security a real security gate rather than a
-- checkbox; see enable-rls.sql for why RLS is deliberately NOT turned on by
-- this file.
--
-- profiles mirrors auth.users (a schema Supabase manages, not this app) so
-- the rest of the schema can have a plain foreign key to a user instead of
-- reaching into auth.* everywhere. Kept in sync by a trigger, not app code —
-- nothing has to remember to insert a profile row after sign-up.
-- ============================================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

-- email is nullable because anonymous sign-ins (auth.users.is_anonymous)
-- have no email at all; re-running this on an older database drops the
-- not-null constraint that was here before anonymous auth existed.
alter table profiles alter column email drop not null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- A project is the unit everything gets shared or kept private at. Private
-- by default: a project with one member (its owner) until someone
-- deliberately adds another.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

-- Nullable for now. Every palette created before this column existed has
-- project_id = null; enable-rls.sql's migration step assigns them to a real
-- project before RLS starts enforcing project_id — flip this to NOT NULL
-- once that backfill has actually run, not before.
alter table palettes add column if not exists project_id uuid references projects(id);

create index if not exists projects_owner_id_idx on projects (owner_id);
create index if not exists project_members_user_id_idx on project_members (user_id);
create index if not exists palettes_project_id_idx on palettes (project_id);

-- ============================================================================
-- The Studio Wall (roadmap phase 4, pulled forward) — a freeform per-project
-- board. One row per pinned item; x/y/rotation/z_index are what make it feel
-- like a corkboard instead of a grid. item_type + ref_id is a loose polymorphic
-- reference (ref_id points at a palette row when item_type = 'palette', is
-- null for a 'note') rather than a separate join table per item type — the
-- set of pinnable things is small and each one is cheap to special-case in
-- the query layer, so a real foreign key per type would be more schema than
-- the problem needs.
-- ============================================================================

create table if not exists board_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  item_type text not null check (item_type in ('palette', 'note', 'gradient', 'image')),
  ref_id uuid references palettes(id) on delete cascade,
  content jsonb,
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 240,
  height double precision not null default 180,
  rotation double precision not null default 0,
  z_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists board_items_project_id_idx on board_items (project_id);

-- 'gradient' and 'image' were added after board_items first shipped —
-- CREATE TABLE IF NOT EXISTS above is a no-op on an existing table, so the
-- widened CHECK has to be applied explicitly. Postgres has no
-- "ADD CONSTRAINT IF NOT EXISTS", so drop-then-add is the idempotent form.
alter table board_items drop constraint if exists board_items_item_type_check;
alter table board_items add constraint board_items_item_type_check
  check (item_type in ('palette', 'note', 'gradient', 'image', 'color', 'link', 'type-pairing'));

create or replace function touch_board_item_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists board_items_touch_updated_at on board_items;
create trigger board_items_touch_updated_at
  before update on board_items
  for each row
  execute function touch_board_item_updated_at();

-- Row Level Security: still OFF in this file — see enable-rls.sql.
--
-- Turning it on requires two things that don't exist yet the moment this
-- file first runs: a real signed-up user, and every existing palette
-- reassigned from project_id = null to a project that user owns. Enabling
-- RLS before that migration would lock the account out of its own data.
-- enable-rls.sql documents the exact order: sign in once, run the backfill,
-- then enable RLS — never RLS first.
