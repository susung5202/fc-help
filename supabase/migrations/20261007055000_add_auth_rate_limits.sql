create schema if not exists private;

create table if not exists private.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null
);

create index if not exists api_rate_limits_expires_at_idx
  on private.api_rate_limits (expires_at);

create or replace function public.consume_api_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ts timestamptz := clock_timestamp();
  current_count integer;
  current_start timestamptz;
  window_interval interval;
begin
  if p_key is null or length(p_key) < 1 or length(p_key) > 200 then
    raise exception 'invalid rate limit key';
  end if;
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid rate limit limit';
  end if;
  if p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'invalid rate limit window';
  end if;

  window_interval := make_interval(secs => p_window_seconds);

  delete from private.api_rate_limits
  where ctid in (
    select ctid
    from private.api_rate_limits
    where expires_at < now_ts - interval '1 day'
    limit 50
  );

  insert into private.api_rate_limits as rl (
    bucket_key,
    window_started_at,
    request_count,
    expires_at
  )
  values (
    p_key,
    now_ts,
    1,
    now_ts + window_interval
  )
  on conflict (bucket_key) do update
  set
    request_count = case
      when rl.window_started_at + window_interval <= now_ts then 1
      else rl.request_count + 1
    end,
    window_started_at = case
      when rl.window_started_at + window_interval <= now_ts then now_ts
      else rl.window_started_at
    end,
    expires_at = case
      when rl.window_started_at + window_interval <= now_ts then now_ts + window_interval
      else rl.window_started_at + window_interval
    end
  returning rl.request_count, rl.window_started_at
  into current_count, current_start;

  allowed := current_count <= p_limit;
  remaining := greatest(p_limit - current_count, 0);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from ((current_start + window_interval) - now_ts)))::integer
    )
  end;

  return next;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

revoke all on table private.api_rate_limits from public, anon, authenticated;
