-- Keep every enabled refresh-alert player on the user's favorites list.
-- Disabling an alert intentionally does NOT remove a saved favorite.
create or replace function public.sync_refresh_alert_favorite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.enabled then
    insert into public.refresh_favorites (
      user_id, player_spid, player_name, season_name
    )
    values (
      new.user_id,
      new.player_spid,
      left(coalesce(nullif(btrim(new.player_name), ''), '선수 ' || new.player_spid::text), 100),
      left(coalesce(new.season_name, ''), 200)
    )
    on conflict (user_id, player_spid) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_refresh_alert_favorite() from public, anon, authenticated;

drop trigger if exists sync_refresh_alert_favorite_trigger on public.refresh_alerts;
create trigger sync_refresh_alert_favorite_trigger
after insert or update of enabled, player_name, season_name
on public.refresh_alerts
for each row
execute function public.sync_refresh_alert_favorite();

-- Existing active alerts should also appear in favorites.
insert into public.refresh_favorites (user_id, player_spid, player_name, season_name)
select user_id,
       player_spid,
       left(coalesce(nullif(btrim(player_name), ''), '선수 ' || player_spid::text), 100),
       left(coalesce(season_name, ''), 200)
from public.refresh_alerts
where enabled = true
on conflict (user_id, player_spid) do nothing;
