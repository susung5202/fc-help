create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

drop policy if exists "admin_users_select_own" on public.admin_users;
create policy "admin_users_select_own"
on public.admin_users for select
to authenticated
using ((select auth.uid()) = user_id);

alter table public.content_reports
  add column if not exists status text not null default 'pending',
  add column if not exists resolution_note text not null default '',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

alter table public.content_reports
  drop constraint if exists content_reports_status_check;
alter table public.content_reports
  add constraint content_reports_status_check check (status in ('pending','resolved','dismissed'));

create index if not exists content_reports_status_created_idx
  on public.content_reports(status, created_at desc);

grant update on table public.content_reports to authenticated;

drop policy if exists "content_reports_select_admin" on public.content_reports;
create policy "content_reports_select_admin"
on public.content_reports for select
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

drop policy if exists "content_reports_update_admin" on public.content_reports;
create policy "content_reports_update_admin"
on public.content_reports for update
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

grant select, delete on table public.community_posts, public.community_comments, public.squad_posts, public.squad_comments to authenticated;

drop policy if exists "community_posts_select_admin" on public.community_posts;
create policy "community_posts_select_admin"
on public.community_posts for select
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

drop policy if exists "community_comments_select_admin" on public.community_comments;
create policy "community_comments_select_admin"
on public.community_comments for select
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

drop policy if exists "squad_posts_select_admin" on public.squad_posts;
create policy "squad_posts_select_admin"
on public.squad_posts for select
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

drop policy if exists "squad_comments_select_admin" on public.squad_comments;
create policy "squad_comments_select_admin"
on public.squad_comments for select
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

drop policy if exists "community_posts_delete_admin" on public.community_posts;
create policy "community_posts_delete_admin"
on public.community_posts for delete
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

drop policy if exists "community_comments_delete_admin" on public.community_comments;
create policy "community_comments_delete_admin"
on public.community_comments for delete
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

drop policy if exists "squad_posts_delete_admin" on public.squad_posts;
create policy "squad_posts_delete_admin"
on public.squad_posts for delete
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));

drop policy if exists "squad_comments_delete_admin" on public.squad_comments;
create policy "squad_comments_delete_admin"
on public.squad_comments for delete
to authenticated
using (exists (
  select 1 from public.admin_users a
  where a.user_id = (select auth.uid())
));
