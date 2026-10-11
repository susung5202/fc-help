-- Expand the explicitly reusable community reference set.
-- Source author explicitly permits reposting. Values remain community_reference
-- until FC Help independently verifies the transaction-volume refresh base time.

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
values
  (280231866, 'odd',  20, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '22UCL 로드리 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (260165153, 'even',  3, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '21UCL 카림 벤제마 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (260205452, 'even', 31, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '21UCL 안토니오 뤼디거 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (260228618, 'odd',   8, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '21UCL 페를랑 멘디 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (260212622, 'even', 42, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '21UCL 요주아 키미히 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (252214100, 'even',  5, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', 'CAP 루드 굴리트 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (283231677, 'even', 22, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', 'HG 마커스 래시포드 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (291264453, 'odd',  40, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '23HW 미키 반더벤 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (289182495, 'even', 47, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', 'CC 마르틴 카세레스 · 원 작성자 재사용 허용 · FC Help 독립 검증 전'),
  (101037576, 'even',  6, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', 'ICON 호나우두 · 원 작성자 재사용 허용 · FC Help 독립 검증 전')
on conflict (player_spid) do update
set
  hour_type = excluded.hour_type,
  refresh_minute = excluded.refresh_minute,
  source_name = excluded.source_name,
  source_url = excluded.source_url,
  source_published_at = excluded.source_published_at,
  confidence = excluded.confidence,
  note = excluded.note,
  updated_at = now();
