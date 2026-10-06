-- Keep FC Online OUID server-only while preserving public profile reads.
revoke all on table public.profiles from anon, authenticated;

grant select (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  fconline_nickname,
  created_at,
  updated_at
) on table public.profiles to anon, authenticated;

grant insert (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  fconline_nickname,
  created_at,
  updated_at
) on table public.profiles to authenticated;

grant update (
  username,
  display_name,
  bio,
  avatar_url,
  fconline_nickname,
  updated_at
) on table public.profiles to authenticated;

-- These SECURITY DEFINER functions are internal implementation details.
-- Browser clients no longer call the view increment RPC directly.
revoke execute on function public.increment_squad_post_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_squad_post_views(uuid) to service_role;

-- The event trigger invokes this as its owner; API roles never need EXECUTE.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
