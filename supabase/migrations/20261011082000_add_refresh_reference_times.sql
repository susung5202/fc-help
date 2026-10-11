
create table if not exists public.refresh_reference_times (
  player_spid bigint primary key,
  hour_type text not null check (hour_type in ('odd','even','every')),
  refresh_minute integer not null check (refresh_minute between 0 and 59),
  source_name text not null,
  source_url text not null,
  source_published_at timestamptz,
  confidence text not null default 'community_reference'
    check (confidence in ('community_reference','verified','estimated')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.refresh_reference_times enable row level security;

drop policy if exists refresh_reference_times_public_read on public.refresh_reference_times;
create policy refresh_reference_times_public_read
on public.refresh_reference_times
for select
to anon, authenticated
using (true);

revoke all on table public.refresh_reference_times from anon, authenticated;
grant select on table public.refresh_reference_times to anon, authenticated;
grant all on table public.refresh_reference_times to service_role;

-- Reference data is seeded in later migrations only when reuse permission is clear.
