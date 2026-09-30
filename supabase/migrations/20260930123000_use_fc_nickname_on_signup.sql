create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  fc_nickname text;
begin
  base_name := 'user_' || left(replace(new.id::text, '-', ''), 8);
  fc_nickname := trim(coalesce(
    nullif(new.raw_user_meta_data->>'fconline_nickname', ''),
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    '구단주'
  ));

  insert into public.profiles (id, username, display_name, fconline_nickname)
  values (
    new.id,
    base_name,
    left(fc_nickname, 20),
    left(fc_nickname, 30)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
