-- Reuse the existing moderation inbox for reports of incorrect refresh-time submissions.
alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;

alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type = any(array[
    'community_post', 'community_comment', 'squad_post', 'squad_comment', 'refresh_report'
  ]::text[]));

-- Administrator-only removal of a specific reported refresh-time submission.
-- This resolves the moderation report in the same transaction.
create or replace function public.remove_reported_refresh_time(
  p_moderation_report_id uuid,
  p_resolution_note text default '잘못된 갱신시간 제보 삭제'
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  report_record record;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.admin_users a where a.user_id = (select auth.uid())
  ) then
    raise exception '관리자만 처리할 수 있습니다.' using errcode = '42501';
  end if;

  select id, target_type, target_id into report_record
  from public.content_reports
  where id = p_moderation_report_id
  for update;

  if not found or report_record.target_type <> 'refresh_report' then
    raise exception '올바른 갱신시간 신고가 아닙니다.' using errcode = 'P0002';
  end if;

  if report_record.target_id !~ '^[0-9]{1,19}$' then
    raise exception '올바르지 않은 제보 번호입니다.' using errcode = '22023';
  end if;

  delete from public.refresh_reports
  where id = report_record.target_id::bigint;

  if not found then
    raise exception '제보가 이미 삭제되었거나 존재하지 않습니다.' using errcode = 'P0002';
  end if;

  update public.content_reports
    set status = 'resolved',
        resolution_note = left(coalesce(nullif(btrim(p_resolution_note), ''), '잘못된 갱신시간 제보 삭제'), 500),
        resolved_at = now(),
        resolved_by = (select auth.uid())
    where id = p_moderation_report_id;

  return true;
end;
$$;

revoke all on function public.remove_reported_refresh_time(uuid,text) from public, anon;
grant execute on function public.remove_reported_refresh_time(uuid,text) to authenticated;
