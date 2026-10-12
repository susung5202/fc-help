-- Backfill the reusable FMKorea bootstrap reference set as explicit observations.
-- This lets the verification pipeline count the original source together with
-- later independent observations without treating copied mirrors as new evidence.

insert into public.refresh_observations (
  player_spid, player_name, season_name, observation_kind,
  start_hour_type, start_minute, end_hour_type, end_minute,
  source_type, source_name, source_url, source_observation_count,
  source_status, source_observed_date, observer_key, source_record_key
)
select
  r.player_spid,
  p.player_name,
  p.season_name,
  'exact',
  r.hour_type,
  r.refresh_minute,
  r.hour_type,
  r.refresh_minute,
  'scraped_public',
  r.source_name,
  r.source_url,
  1,
  'reported',
  null,
  'web:fmkorea.com:6340976670',
  'reference:fmkorea:' || r.player_spid::text
from public.refresh_reference_times r
join (
  values
    (101013128::bigint,'안드리 셰우첸코','ICON (ICON)'),
    (101037576::bigint,'호나우두','ICON (ICON)'),
    (101191208::bigint,'차범근','ICON (ICON)'),
    (101214100::bigint,'루드 굴리트','ICON (ICON)'),
    (240020801::bigint,'크리스티아누 호날두','21 TOTY (21 Team Of The Year)'),
    (240200104::bigint,'손흥민','21 TOTY (21 Team Of The Year)'),
    (250020801::bigint,'크리스티아누 호날두','21 TOTS (21 Team Of The Season)'),
    (252214100::bigint,'루드 굴리트','CAP (Captain)'),
    (256020801::bigint,'크리스티아누 호날두','BTB (Back to Back)'),
    (258200104::bigint,'손흥민','22 TOTY (22 Team Of The Year)'),
    (260165153::bigint,'카림 벤제마','21 UCL (21 UEFA Champions League)'),
    (260205452::bigint,'안토니오 뤼디거','21 UCL (21 UEFA Champions League)'),
    (260212622::bigint,'요주아 키미히','21 UCL (21 UEFA Champions League)'),
    (260228618::bigint,'페를랑 멘디','21 UCL (21 UEFA Champions League)'),
    (267020801::bigint,'크리스티아누 호날두','22 TOTS (22 Team Of The Season)'),
    (268013128::bigint,'안드리 셰우첸코','LN (LEGENDARY NUMBERS)'),
    (268191208::bigint,'차범근','LN (LEGENDARY NUMBERS)'),
    (268214100::bigint,'루드 굴리트','LN (LEGENDARY NUMBERS)'),
    (273020801::bigint,'크리스티아누 호날두','WC22 (World Cup 2022)'),
    (273200104::bigint,'손흥민','WC22 (World Cup 2022)'),
    (280231866::bigint,'로드리','22 UCL (22 UEFA Champions League)'),
    (283231677::bigint,'마커스 래시포드','HG (Home Grown)'),
    (284214100::bigint,'루드 굴리트','RTN (Returnees)'),
    (289013128::bigint,'안드리 셰우첸코','CC (CenturyClub)'),
    (289020801::bigint,'크리스티아누 호날두','CC (CenturyClub)'),
    (289182495::bigint,'마르틴 카세레스','CC (CenturyClub)'),
    (289191208::bigint,'차범근','CC (CenturyClub)'),
    (289200104::bigint,'손흥민','CC (CenturyClub)'),
    (291264453::bigint,'미키 반더벤','23HW (23 Hard Worker)')
) as p(player_spid, player_name, season_name)
  on p.player_spid = r.player_spid
where r.source_url = 'https://www.fmkorea.com/6340976670'
on conflict (source_record_key) do nothing;

-- Independent exact corroboration found in public community/source pages.
insert into public.refresh_observations (
  player_spid, player_name, season_name, observation_kind,
  start_hour_type, start_minute, end_hour_type, end_minute,
  source_type, source_name, source_url, source_observation_count,
  source_status, source_observed_date, observer_key, source_record_key
) values
  (240020801,'크리스티아누 호날두','21 TOTY (21 Team Of The Year)','exact','even',0,'even',0,'scraped_public','DCInside 21TOTY 공개 정리','https://gall.dcinside.com/board/view/?id=fifaonline&no=2750143',1,'reported',null,'web:gall.dcinside.com:2750143','audit:dcinside:2750143:240020801'),
  (240200104,'손흥민','21 TOTY (21 Team Of The Year)','exact','even',34,'even',34,'scraped_public','DCInside 21TOTY 공개 정리','https://gall.dcinside.com/board/view/?id=fifaonline&no=2750143',1,'reported',null,'web:gall.dcinside.com:2750143','audit:dcinside:2750143:240200104'),
  (260165153,'카림 벤제마','21 UCL (21 UEFA Champions League)','exact','even',3,'even',3,'scraped_public','Inven 21UCL 벤제마 판매 기록','https://www.inven.co.kr/board/fifaonline4/3146/7845830',1,'reported',null,'web:inven.co.kr:7845830','audit:inven:7845830:260165153'),
  (260205452,'안토니오 뤼디거','21 UCL (21 UEFA Champions League)','exact','even',31,'even',31,'scraped_public','Inven 갱신시간 모음','https://www.inven.co.kr/board/fifaonline4/3146/8149585',1,'reported',null,'web:inven.co.kr:8149585','audit:inven:8149585:260205452'),
  (268013128,'안드리 셰우첸코','LN (LEGENDARY NUMBERS)','exact','odd',57,'odd',57,'scraped_public','Inven LN 셰우첸코 판매 기록','https://www.inven.co.kr/board/fifaonline4/3146/7625736',1,'reported',null,'web:inven.co.kr:7625736','audit:inven:7625736:268013128'),
  (283231677,'마커스 래시포드','HG (Home Grown)','exact','even',22,'even',22,'scraped_public','Inven 갱신시간 공개 정리','https://www.inven.co.kr/board/fifaonline4/3145/52273',1,'reported',null,'web:inven.co.kr:52273','audit:inven:52273:283231677'),
  (284214100,'루드 굴리트','RTN (Returnees)','exact','even',43,'even',43,'scraped_public','Inven RTN 굴리트 공개 기록','https://www.inven.co.kr/board/fifaonline4/3146/8081237',1,'reported',null,'web:inven.co.kr:8081237','audit:inven:8081237:284214100'),
  (289182495,'마르틴 카세레스','CC (CenturyClub)','exact','even',47,'even',47,'scraped_public','이쿠로그 CC 시즌 공개 정리','https://www.yooniku.com/2025/07/fc-cc.html',1,'reported',null,'web:yooniku.com:fc-cc','audit:yooniku:cc:289182495'),
  (291264453,'미키 반더벤','23HW (23 Hard Worker)','exact','odd',40,'odd',40,'scraped_public','이쿠로그 23HW 시즌 공개 정리','https://www.yooniku.com/2025/07/fc-23hw.html',1,'reported',null,'web:yooniku.com:fc-23hw','audit:yooniku:23hw:291264453'),

  -- Contradictory public exact records are deliberately preserved. The app
  -- suppresses unverified community references when one of these conflicts.
  (260228618,'페를랑 멘디','21 UCL (21 UEFA Champions League)','exact','even',55,'even',55,'scraped_public','Inven 갱신시간 모음','https://www.inven.co.kr/board/fifaonline4/3146/8149585',1,'reported',null,'web:inven.co.kr:8149585','audit:conflict:inven:8149585:260228618'),
  (268214100,'루드 굴리트','LN (LEGENDARY NUMBERS)','exact','odd',59,'odd',59,'scraped_public','Inven 이적시장 갱신시간 공개','https://www.inven.co.kr/board/fifaonline4/3146/7790618',1,'reported',null,'web:inven.co.kr:7790618','audit:conflict:inven:7790618:268214100'),
  (289013128,'안드리 셰우첸코','CC (CenturyClub)','exact','even',19,'even',19,'scraped_public','이쿠로그 CC 시즌 공개 정리','https://www.yooniku.com/2025/07/fc-cc.html',1,'reported',null,'web:yooniku.com:fc-cc','audit:conflict:yooniku:cc:289013128'),
  (289020801,'크리스티아누 호날두','CC (CenturyClub)','exact','even',20,'even',20,'scraped_public','Inven 갱신시간 모음','https://www.inven.co.kr/board/fifaonline4/3146/8149585',1,'reported',null,'web:inven.co.kr:8149585','audit:conflict:inven:8149585:289020801'),
  (289191208,'차범근','CC (CenturyClub)','exact','even',54,'even',54,'scraped_public','Inven 갱신시간 모음','https://www.inven.co.kr/board/fifaonline4/3146/8149585',1,'reported',null,'web:inven.co.kr:8149585','audit:conflict:inven:8149585:289191208')
on conflict (source_record_key) do nothing;
