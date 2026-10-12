
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
  v_current_hour text;
  v_current_minute integer;
  v_current_confidence text;
  v_current_conflict boolean := false;
begin
  select r.hour_type, r.refresh_minute, r.confidence
  into v_current_hour, v_current_minute, v_current_confidence
  from public.refresh_reference_times r
  where r.player_spid = p_player_spid;

  if v_current_hour is not null then
    select exists (
      select 1
      from public.refresh_observations o
      where o.player_spid = p_player_spid
        and o.observation_kind = 'exact'
        and o.source_type = 'scraped_public'
        and o.source_status in ('reported', 'confirmed')
        and (
          o.start_hour_type <> v_current_hour
          or o.start_minute <> v_current_minute
        )
    )
    into v_current_conflict;

    if v_current_conflict and v_current_confidence = 'verified' then
      update public.refresh_reference_times
      set confidence = 'community_reference',
          note = '독립 공개 exact 기록 충돌이 발견되어 자동 검증 해제',
          updated_at = now()
      where player_spid = p_player_spid;
    end if;
  end if;

  with evidence as (
    select
      o.start_hour_type,
      o.start_minute,
      o.source_url,
      o.updated_at,
      o.source_type,
      o.source_status,
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
  candidates as (
    select
      e.start_hour_type,
      e.start_minute,
      count(distinct e.evidence_key)::integer as support,
      min(e.source_url) as source_url,
      max(e.updated_at) as latest_at
    from evidence e
    group by e.start_hour_type, e.start_minute
    having count(distinct e.evidence_key) >= 2
  ),
  safe_winner as (
    select c.*
    from candidates c
    where not exists (
      select 1
      from public.refresh_observations x
      where x.player_spid = p_player_spid
        and x.observation_kind = 'exact'
        and x.source_type = 'scraped_public'
        and x.source_status in ('reported', 'confirmed')
        and (
          x.start_hour_type <> c.start_hour_type
          or x.start_minute <> c.start_minute
        )
    )
    order by c.support desc, c.latest_at desc
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
  from safe_winner w;

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
    '서로 다른 독립 근거 ' || v_support::text || '개에서 같은 exact 갱신 기준 시각 확인 · 반대 공개 exact 없음'
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

insert into public.refresh_observations (
  player_spid, player_name, season_name, observation_kind,
  start_hour_type, start_minute, end_hour_type, end_minute,
  source_type, source_name, source_url, source_observation_count,
  source_status, source_observed_date, observer_key, source_record_key
) values (
  268013128,
  '안드리 셰우첸코',
  'LN (LEGENDARY NUMBERS)',
  'exact',
  'odd', 55, 'odd', 55,
  'scraped_public',
  'Inven 갱신시간 모음',
  'https://www.inven.co.kr/board/fifaonline4/3146/8149585',
  1,
  'reported',
  '2024-04-16',
  'web:inven.co.kr:8149585',
  'audit:conflict:inven:8149585:268013128'
)
on conflict (source_record_key) do nothing;

update public.refresh_reference_times r
set confidence = 'community_reference',
    note = '독립 공개 exact 기록 충돌이 발견되어 자동 검증 해제',
    updated_at = now()
where r.confidence = 'verified'
  and exists (
    select 1
    from public.refresh_observations o
    where o.player_spid = r.player_spid
      and o.observation_kind = 'exact'
      and o.source_type = 'scraped_public'
      and o.source_status in ('reported', 'confirmed')
      and (
        o.start_hour_type <> r.hour_type
        or o.start_minute <> r.refresh_minute
      )
  );
