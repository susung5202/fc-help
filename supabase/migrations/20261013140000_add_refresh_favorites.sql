-- FC Help refresh-time favorites: independent from notifications/reports.
create table if not exists public.refresh_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_spid bigint not null check (player_spid > 0),
  player_name text not null check (char_length(player_name) between 1 and 100),
  season_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, player_spid)
);

create index if not exists refresh_favorites_user_created_idx
  on public.refresh_favorites (user_id, created_at desc);

alter table public.refresh_favorites enable row level security;
revoke all on public.refresh_favorites from anon;
revoke all on public.refresh_favorites from authenticated;
grant select, insert, delete on public.refresh_favorites to authenticated;

create policy "Users view their own refresh favorites"
  on public.refresh_favorites for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users save their own refresh favorites"
  on public.refresh_favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users remove their own refresh favorites"
  on public.refresh_favorites for delete to authenticated
  using ((select auth.uid()) = user_id);
