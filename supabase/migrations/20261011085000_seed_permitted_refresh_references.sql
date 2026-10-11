-- Remove the previous full-table community import because reuse permission
-- for bulk redistribution was not established.
delete from public.refresh_reference_times
where source_url = 'https://www.inven.co.kr/board/fifaonline4/3146/8440151';

-- This source explicitly states that the refresh-time list may be reposted.
-- Keep these values as community_reference until FC Help independently verifies them.
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
  (268191208, 'odd',  57, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (289191208, 'even', 55, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (101191208, 'even',  7, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (258200104, 'even', 13, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (289200104, 'odd',   2, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (273200104, 'even', 15, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (240200104, 'even', 34, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (273020801, 'even',  5, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (240020801, 'even',  0, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (267020801, 'even',  3, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (289020801, 'even', 21, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (256020801, 'even',  6, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (250020801, 'even', 20, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (268214100, 'odd',  58, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (284214100, 'even', 43, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (101214100, 'even',  2, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (268013128, 'odd',  57, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (289013128, 'even', 18, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전'),
  (101013128, 'even',  1, '에펨코리아 잠봉 공개 정리', 'https://www.fmkorea.com/6340976670', '2023-10-31T14:34:00+09:00', 'community_reference', '원 작성자가 재사용 허용을 명시한 공개 참고값 · FC Help 독립 검증 전')
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
