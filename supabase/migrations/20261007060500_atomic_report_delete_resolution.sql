create or replace function public.admin_resolve_report_with_delete(
  p_report_id uuid,
  p_resolved_by uuid,
  p_resolution_note text default '신고 대상 콘텐츠 삭제'
)
returns table (
  report_id uuid,
  target_type text,
  target_id text,
  status text,
  resolved_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_report public.content_reports%rowtype;
  v_deleted integer := 0;
  v_resolved_at timestamptz := clock_timestamp();
  v_note text;
begin
  if not exists (
    select 1
    from public.admin_users
    where user_id = p_resolved_by
  ) then
    raise exception 'admin permission required' using errcode = '42501';
  end if;

  select *
  into v_report
  from public.content_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  v_note := left(
    coalesce(nullif(trim(coalesce(p_resolution_note, '')), ''), '신고 대상 콘텐츠 삭제'),
    500
  );

  case v_report.target_type
    when 'community_post' then
      delete from public.community_posts where id = v_report.target_id::uuid;
    when 'community_comment' then
      delete from public.community_comments where id = v_report.target_id::bigint;
    when 'squad_post' then
      delete from public.squad_posts where id = v_report.target_id::uuid;
    when 'squad_comment' then
      delete from public.squad_comments where id = v_report.target_id::bigint;
    else
      raise exception 'unsupported report target type' using errcode = '22023';
  end case;

  get diagnostics v_deleted = row_count;

  if v_deleted <> 1 then
    raise exception 'report target not found' using errcode = 'P0002';
  end if;

  update public.content_reports
  set
    status = 'resolved',
    resolution_note = v_note,
    resolved_at = v_resolved_at,
    resolved_by = p_resolved_by
  where id = p_report_id;

  return query
  select
    v_report.id,
    v_report.target_type,
    v_report.target_id,
    'resolved'::text,
    v_resolved_at;
end;
$$;

revoke all on function public.admin_resolve_report_with_delete(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_resolve_report_with_delete(uuid, uuid, text)
  to service_role;
