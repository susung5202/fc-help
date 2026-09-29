alter table public.community_comments
  add column if not exists parent_id bigint references public.community_comments(id) on delete cascade,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists community_comments_post_parent_idx
  on public.community_comments(post_id, parent_id, created_at);

create index if not exists squad_comments_post_parent_idx
  on public.squad_comments(post_id, parent_id, created_at);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('community_post','community_comment','squad_post','squad_comment')),
  target_id text not null check (char_length(target_id) between 1 and 80),
  reason text not null check (reason in ('spam','abuse','inappropriate','misinformation','other')),
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists content_reports_target_idx
  on public.content_reports(target_type, target_id, created_at desc);
create index if not exists content_reports_reported_user_idx
  on public.content_reports(reported_user_id, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists "content_reports_select_own" on public.content_reports;
create policy "content_reports_select_own"
on public.content_reports for select
to authenticated
using ((select auth.uid()) = reporter_id);

drop policy if exists "content_reports_insert_own" on public.content_reports;
create policy "content_reports_insert_own"
on public.content_reports for insert
to authenticated
with check ((select auth.uid()) = reporter_id);

revoke all on public.content_reports from anon;
revoke all on public.content_reports from authenticated;
grant select, insert on public.content_reports to authenticated;
