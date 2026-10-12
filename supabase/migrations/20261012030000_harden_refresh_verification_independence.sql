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
  with evidence as (
    select
      o.start_hour_type,
      o.start_minute,
      o.source_url,
      o.updated_at,
      case
        when o.source_type = 'scraped_public' then
          'web:' || lower(
            coalesce(
              nullif(substring(o.source_url from '^https?://([^/]+)'), ''),
              nullif(o.source_url, ''),
              o.source_name
            )
          )
        when o.source_type = 'user_report' then
          'reporter:' || coalesce(
            nullif(o.observer_key, ''),
            nullif(o.source_url, ''),
            o.source_name
          )
        when o.source_type in ('manual', 'fc_help') then
          'internal:' || coalesce(
            nullif(o.observer_key, ''),
            nullif(o.source_url, ''),
            o.source_name
          )
        else
          'other:' || coalesce(
            nullif(o.observer_key, ''),
            nullif(o.source_url, ''),
            o.source_name
          )
      end as evidence_key
    from public.refresh_observations o
    where o.player_spid = p_player_spid
      and o.observation_kind = 'exact'
      and not (
        o.source_type = 'scraped_public'
        and o.source_status = 'estimated'
      )
  ),
  winner as (
    select
      e.start_hour_type,
      e.start_minute,
      count(distinct e.evidence_key)::integer as support,
      min(e.source_url) as source_url,
      max(e.updated_at) as latest_at
    from evidence e
    group by e.start_hour_type, e.start_minute
    having count(distinct e.evidence_key) >= 2
    order by support desc, latest_at desc
    limit 1
  )
  select
    w.start_hour_type,
    w.start_minute,
    w.support,
    w.source_url
  into
    v_hour_type,
    v_minute,
    v_support,
    v_source_url
  from winner w;

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
    '서로 다른 독립 근거 ' || v_support::text || '개에서 같은 exact 갱신 기준 시각 확인'
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
