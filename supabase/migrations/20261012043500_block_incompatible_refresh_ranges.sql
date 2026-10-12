
create or replace function private.refresh_observation_conflicts_with_pattern(
  p_kind text,
  p_start_hour_type text,
  p_start_minute integer,
  p_end_hour_type text,
  p_end_minute integer,
  p_hour_type text,
  p_minute integer
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_candidate integer;
  v_start integer;
  v_end integer;
  v_inside boolean;
begin
  if p_kind = 'exact' then
    if p_start_hour_type = 'every' then
      return p_start_minute <> p_minute;
    end if;

    if p_hour_type = 'every' then
      return p_start_hour_type <> 'every' or p_start_minute <> p_minute;
    end if;

    return p_start_hour_type <> p_hour_type or p_start_minute <> p_minute;
  end if;

  if p_kind <> 'range' then
    return false;
  end if;

  if p_hour_type = 'every'
     or p_start_hour_type = 'every'
     or p_end_hour_type = 'every' then
    return false;
  end if;

  v_candidate :=
    case p_hour_type when 'odd' then 60 + p_minute else p_minute end;
  v_start :=
    case p_start_hour_type when 'odd' then 60 + p_start_minute else p_start_minute end;
  v_end :=
    case p_end_hour_type when 'odd' then 60 + p_end_minute else p_end_minute end;

  if v_start <= v_end then
    v_inside := v_candidate between v_start and v_end;
  else
    v_inside := v_candidate >= v_start or v_candidate <= v_end;
  end if;

  return not v_inside;
end;
$$;

revoke all on function private.refresh_observation_conflicts_with_pattern(
  text, text, integer, text, integer, text, integer
) from public, anon, authenticated;
grant execute on function private.refresh_observation_conflicts_with_pattern(
  text, text, integer, text, integer, text, integer
) to service_role;

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
        and o.source_type = 'scraped_public'
        and o.source_status in ('reported', 'confirmed')
        and private.refresh_observation_conflicts_with_pattern(
          o.observation_kind,
          o.start_hour_type,
          o.start_minute,
          o.end_hour_type,
          o.end_minute,
          v_current_hour,
          v_current_minute
        )
    )
    into v_current_conflict;

    if v_current_conflict and v_current_confidence = 'verified' then
      update public.refresh_reference_times
      set confidence = 'community_reference',
          note = '독립 공개 관측과 충돌이 발견되어 자동 검증 해제',
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
        and x.source_type = 'scraped_public'
        and x.source_status in ('reported', 'confirmed')
        and private.refresh_observation_conflicts_with_pattern(
          x.observation_kind,
          x.start_hour_type,
          x.start_minute,
          x.end_hour_type,
          x.end_minute,
          c.start_hour_type,
          c.start_minute
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
    '서로 다른 독립 근거 ' || v_support::text || '개에서 같은 exact 갱신 기준 시각 확인 · 반대 공개 관측 없음'
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
) values
  (273020801,'크리스티아누 호날두','WC22 (World Cup 2022)','exact','even',5,'even',5,
   'scraped_public','Inven 갱신시간 정리','https://www.inven.co.kr/board/fifaonline4/3145/51542',1,'reported','2023-10-16',
   'web:inven.co.kr:51542','audit:inven:51542:273020801'),
  (280231866,'로드리','22 UCL (22 UEFA Champions League)','exact','odd',20,'odd',20,
   'scraped_public','Inven 갱신시간 정리','https://www.inven.co.kr/board/fifaonline4/3145/51542',1,'reported','2023-10-16',
   'web:inven.co.kr:51542','audit:inven:51542:280231866'),
  (289191208,'차범근','CC (CenturyClub)','exact','even',55,'even',55,
   'scraped_public','Inven 갱신시간 정리','https://www.inven.co.kr/board/fifaonline4/3145/51542',1,'reported','2023-10-16',
   'web:inven.co.kr:51542','audit:inven:51542:289191208'),
  (289200104,'손흥민','CC (CenturyClub)','exact','odd',2,'odd',2,
   'scraped_public','이쿠로그 CC 시즌 공개 정리','https://www.yooniku.com/2025/07/fc-cc.html',1,'reported',null,
   'web:yooniku.com:fc-cc','audit:yooniku:cc:289200104'),
  (289020801,'크리스티아누 호날두','CC (CenturyClub)','exact','even',21,'even',21,
   'scraped_public','이쿠로그 CC 시즌 공개 정리','https://www.yooniku.com/2025/07/fc-cc.html',1,'reported',null,
   'web:yooniku.com:fc-cc','audit:yooniku:cc:289020801'),
  (289191208,'차범근','CC (CenturyClub)','exact','even',55,'even',55,
   'scraped_public','이쿠로그 CC 시즌 공개 정리','https://www.yooniku.com/2025/07/fc-cc.html',1,'reported',null,
   'web:yooniku.com:fc-cc','audit:yooniku:cc:289191208'),
  (289200104,'손흥민','CC (CenturyClub)','range','even',1,'even',2,
   'scraped_public','Inven 갱신시간 모음','https://www.inven.co.kr/board/fifaonline4/3146/8149585',1,'reported','2024-04-16',
   'web:inven.co.kr:8149585','audit:range-conflict:inven:8149585:289200104'),
  (250020801,'크리스티아누 호날두','21 TOTS (21 Team Of The Season)','range','even',20,'even',40,
   'scraped_public','Inven 21TOTS 호날두 갱신 관찰','https://www.inven.co.kr/board/fifaonline4/3146/7500071',1,'reported','2023-02-03',
   'web:inven.co.kr:7500071','audit:range:inven:7500071:250020801')
on conflict (source_record_key) do nothing;

select public.promote_refresh_observation(273020801);
select public.promote_refresh_observation(280231866);
select public.promote_refresh_observation(289191208);
select public.promote_refresh_observation(289200104);
select public.promote_refresh_observation(289020801);
select public.promote_refresh_observation(250020801);

update public.refresh_reference_times r
set confidence = 'community_reference',
    note = '독립 공개 관측과 충돌이 발견되어 자동 검증 해제',
    updated_at = now()
where r.confidence = 'verified'
  and exists (
    select 1
    from public.refresh_observations o
    where o.player_spid = r.player_spid
      and o.source_type = 'scraped_public'
      and o.source_status in ('reported', 'confirmed')
      and private.refresh_observation_conflicts_with_pattern(
        o.observation_kind,
        o.start_hour_type,
        o.start_minute,
        o.end_hour_type,
        o.end_minute,
        r.hour_type,
        r.refresh_minute
      )
  );
