-- Admin-only, unlimited pinned notices for the community board.
alter table public.community_posts
  add column if not exists is_notice boolean not null default false;

create index if not exists community_posts_notice_order_idx
  on public.community_posts (is_notice desc, created_at desc);

-- Even a post author must not change a notice status or edit/delete a
-- pinned announcement unless they are currently an administrator.
create or replace function public.guard_community_notice()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1 from public.admin_users a where a.user_id = (select auth.uid())
  ) into is_admin;

  if tg_op = 'INSERT' then
    if new.is_notice and not is_admin then
      raise exception '공지 지정은 관리자만 가능합니다.' using errcode = '42501';
    end if;
    return new;
  end if;

  if not is_admin and (
    old.is_notice or
    (tg_op = 'UPDATE' and new.is_notice is distinct from old.is_notice)
  ) then
    raise exception '공지 게시글은 관리자만 수정하거나 삭제할 수 있습니다.' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.guard_community_notice() from public, anon, authenticated;

drop trigger if exists community_notice_guard_trigger on public.community_posts;
create trigger community_notice_guard_trigger
before insert or update or delete on public.community_posts
for each row execute function public.guard_community_notice();

-- Administrators can pin/unpin any community post, including another
-- user's post, without granting unrestricted update access via RLS.
create or replace function public.set_community_post_notice(
  p_post_id uuid, p_is_notice boolean
) returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users a where a.user_id = (select auth.uid())
  ) then
    raise exception '관리자 권한이 필요합니다.' using errcode = '42501';
  end if;

  update public.community_posts
  set is_notice = p_is_notice
  where id = p_post_id;

  if not found then
    raise exception '게시글을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  return p_is_notice;
end;
$$;

revoke all on function public.set_community_post_notice(uuid, boolean)
  from public, anon;
grant execute on function public.set_community_post_notice(uuid, boolean)
  to authenticated;
