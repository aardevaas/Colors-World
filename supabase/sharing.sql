-- PRISM — shareable, no-account board links (roadmap phase 5).
--
-- Safe to run any time after enable-rls.sql (needs is_project_member()).
--
-- A board_shares row is a bearer capability: whoever holds the token can
-- view that project's Studio Wall read-only, no account required — "send a
-- board to a client or supplier who has no account and never will." The
-- table itself stays exactly as RLS-scoped as everything else (project
-- members only select/insert/revoke their own project's rows); a token is
-- never enumerable through the normal API.
--
-- The PUBLIC share route (src/app/share/[token]/page.tsx) resolves a token
-- using the service-role client — a deliberate, narrow exception to
-- "service-role is ingestion-only." An anonymous visitor has no auth.uid()
-- for RLS to scope against, so the application code is the authorization
-- boundary for this one read path: it looks up exactly one project_id from
-- the token, never accepts a project_id from the request itself, and never
-- writes anything.

create table if not exists board_shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  token text not null unique,
  created_by uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists board_shares_project_id_idx on board_shares (project_id);
create index if not exists board_shares_token_idx on board_shares (token);

-- At most one active (non-revoked) share per project. Without this, a race
-- between two "Share" clicks (or any future call site) could create two live
-- tokens for the same project, and the UI — which only ever tracks and
-- offers to revoke the most recent one — would leave the older token valid
-- and invisible. Get-or-create logic in getOrCreateShareLinkAction already
-- checks for an active share before inserting; this index is the backstop
-- that makes the "at most one" guarantee actually hold under concurrency.
create unique index if not exists board_shares_one_active_per_project_idx
  on board_shares (project_id)
  where revoked_at is null;

alter table board_shares enable row level security;

drop policy if exists board_shares_select on board_shares;
create policy board_shares_select on board_shares
  for select using (is_project_member(project_id));

drop policy if exists board_shares_insert on board_shares;
create policy board_shares_insert on board_shares
  for insert with check (is_project_member(project_id) and created_by = auth.uid());

drop policy if exists board_shares_revoke on board_shares;
create policy board_shares_revoke on board_shares
  for update using (is_project_member(project_id))
  with check (is_project_member(project_id));
