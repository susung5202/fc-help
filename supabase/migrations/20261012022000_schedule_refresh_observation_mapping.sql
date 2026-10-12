create or replace function public.promote_refresh_observation(p_player_spid bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hour_type text;
  v_minute integer;
  v_support integer;
  v_source_url text;
begin
  select
    o.start_hour_type,
    o.start_minute,
    count(distinct coalesce(nullif(o.observer_key, ''), o.source_url, o.source_name))::integer,
    min(o.source_url)
  into
    v_hour_type,
    v_minute,
    v_support,
    v_source_url
  from public.refresh_observations o
  where o.player_spid = p_player_spid
    and o.observation_kind = 'exact'
  group by o.start_hour_type, o.start_minute
  having count(distinct coalesce(nullif(o.observer_key, ''), o.source_url, o.source_name)) >= 2
  order by count(distinct coalesce(nullif(o.observer_key, ''), o.source_url, o.source_name)) desc,
           max(o.updated_at) desc
  limit 1;

  if v_hour_type is null then
    return false;
  end if;

  insert into public.refresh_reference_times (
    player_spid,
    hour_type,
    refresh_minute,
    source_name,
    source_url,
    source_published_at,
    confidence,
    note
  )
  values (
    p_player_spid,
    v_hour_type,
    v_minute,
    'FC Help 교차 검증',
    coalesce(v_source_url, 'https://fchelp.xyz/refresh/' || p_player_spid::text),
    now(),
    'verified',
    '서로 다른 근거 ' || v_support::text || '개에서 같은 exact 갱신 기준 시각 확인'
  )
  on conflict (player_spid) do update
  set
    hour_type = excluded.hour_type,
    refresh_minute = excluded.refresh_minute,
    source_name = excluded.source_name,
    source_url = excluded.source_url,
    source_published_at = excluded.source_published_at,
    confidence = 'verified',
    note = excluded.note,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.promote_refresh_observation(bigint) from public, anon, authenticated;
grant execute on function public.promote_refresh_observation(bigint) to service_role;

create or replace function public.refresh_observation_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.player_spid is null or new.observation_kind <> 'exact' then
    return new;
  end if;

  if new.source_type in ('scraped_public','manual','fc_help') then
    insert into public.refresh_reference_times (
      player_spid,
      hour_type,
      refresh_minute,
      source_name,
      source_url,
      source_published_at,
      confidence,
      note
    )
    values (
      new.player_spid,
      new.start_hour_type,
      new.start_minute,
      new.source_name,
      new.source_url,
      coalesce(new.source_observed_date::timestamptz, now()),
      'community_reference',
      '공개 웹 exact 관측값 · FC Help 독립 검증 전'
    )
    on conflict (player_spid) do nothing;
  end if;

  perform public.promote_refresh_observation(new.player_spid);
  return new;
end;
$$;

revoke all on function public.refresh_observation_after_write() from public, anon, authenticated;
grant execute on function public.refresh_observation_after_write() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fc-help-refresh-observation-spid-map';

select cron.schedule(
  'fc-help-refresh-observation-spid-map',
  '17 18 * * *',
  $cron$
  select net.http_get(
    url := 'https://fchelp.xyz/api/refresh/map-observations/cron',
    headers := jsonb_build_object(
      'x-fc-help-cron-secret',
      (select secret from public.cron_secrets where name = 'push_run')
    )
  );
  $cron$
);
