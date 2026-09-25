create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default '구단주',
  bio text not null default '',
  avatar_url text,
  fconline_nickname text,
  fconline_ouid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 20),
  constraint profiles_bio_length check (char_length(bio) <= 150),
  constraint profiles_fconline_nickname_length check (fconline_nickname is null or char_length(fconline_nickname) <= 30)
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
begin
  base_name := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', 'user'), '[^a-zA-Z0-9_]+', '', 'g'));
  if char_length(base_name) < 3 then
    base_name := 'user';
  end if;
  base_name := left(base_name, 11) || '_' || left(replace(new.id::text, '-', ''), 8);

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    base_name,
    left(coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, ''), '@', 1), '구단주'), 20)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

insert into public.profiles (id, username, display_name)
select
  u.id,
  'user_' || left(replace(u.id::text, '-', ''), 8),
  left(coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(coalesce(u.email, ''), '@', 1), '구단주'), 20)
from auth.users u
on conflict (id) do nothing;

create index if not exists profiles_fconline_nickname_idx on public.profiles (fconline_nickname);
