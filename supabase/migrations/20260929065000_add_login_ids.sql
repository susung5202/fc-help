create schema if not exists private;

create table if not exists public.account_login_ids (
  user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null unique,
  created_at timestamptz not null default now(),
  constraint account_login_ids_format check (
    login_id = lower(login_id)
    and login_id ~ '^[a-z0-9_]{3,20}$'
  )
);

alter table public.account_login_ids enable row level security;

revoke all on table public.account_login_ids from anon, authenticated;
grant select, insert on table public.account_login_ids to authenticated;

drop policy if exists "account_login_ids_select_own" on public.account_login_ids;
create policy "account_login_ids_select_own"
on public.account_login_ids for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "account_login_ids_insert_own" on public.account_login_ids;
create policy "account_login_ids_insert_own"
on public.account_login_ids for insert
to authenticated
with check ((select auth.uid()) = user_id);

create or replace function private.handle_new_user_login_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_login_id text;
begin
  requested_login_id := lower(trim(coalesce(new.raw_user_meta_data->>'login_id', '')));

  if requested_login_id = '' then
    return new;
  end if;

  if requested_login_id !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'invalid login id' using errcode = '23514';
  end if;

  insert into public.account_login_ids (user_id, login_id)
  values (new.id, requested_login_id);

  return new;
end;
$$;

revoke all on function private.handle_new_user_login_id() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_login_id on auth.users;
create trigger on_auth_user_created_login_id
after insert on auth.users
for each row execute function private.handle_new_user_login_id();

with candidates as (
  select
    p.id,
    lower(p.display_name) as candidate,
    count(*) over (partition by lower(p.display_name)) as candidate_count
  from public.profiles p
), normalized as (
  select
    id,
    case
      when candidate ~ '^[a-z0-9_]{3,20}$' and candidate_count = 1 then candidate
      else 'user_' || left(replace(id::text, '-', ''), 8)
    end as login_id
  from candidates
)
insert into public.account_login_ids (user_id, login_id)
select id, login_id
from normalized
on conflict (user_id) do nothing;
