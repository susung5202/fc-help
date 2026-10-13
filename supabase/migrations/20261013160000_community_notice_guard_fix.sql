-- Keep DELETE logic independent of NEW to avoid dereferencing NEW on delete.
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
  elsif tg_op = 'DELETE' then
    if old.is_notice and not is_admin then
      raise exception '공지 삭제는 관리자만 가능합니다.' using errcode = '42501';
    end if;
    return old;
  else
    if not is_admin and (old.is_notice or new.is_notice is distinct from old.is_notice) then
      raise exception '공지 지정·수정은 관리자만 가능합니다.' using errcode = '42501';
    end if;
    return new;
  end if;
end;
$$;
