create schema if not exists private;

create or replace function private.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
  fc_nickname text;
  fc_ouid text;
begin
  base_name := 'user_' || left(replace(new.id::text, '-', ''), 8);
  fc_nickname := trim(coalesce(
    nullif(new.raw_user_meta_data->>'fconline_nickname', ''),
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    '구단주'
  ));
  fc_ouid := nullif(trim(coalesce(new.raw_user_meta_data->>'fconline_ouid', '')), '');

  insert into public.profiles (id, username, display_name, fconline_nickname, fconline_ouid)
  values (
    new.id,
    base_name,
    left(fc_nickname, 20),
    left(fc_nickname, 30),
    fc_ouid
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_user_profile();

drop function if exists public.handle_new_user_profile();
