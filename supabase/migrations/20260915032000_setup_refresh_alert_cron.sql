create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema public;

create table if not exists public.cron_secrets (
  name text primary key,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cron_secrets enable row level security;
revoke all on table public.cron_secrets from anon, authenticated;

insert into public.cron_secrets (name, secret)
values ('push_run', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create table if not exists public.cron_invocations (
  minute_key text primary key,
  created_at timestamptz not null default now()
);

alter table public.cron_invocations enable row level security;
revoke all on table public.cron_invocations from anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fc-help-refresh-alerts';

select cron.schedule(
  'fc-help-refresh-alerts',
  '* * * * *',
  $cron$
  select net.http_get(
    url := 'https://fc-help-chi.vercel.app/api/push/cron',
    headers := jsonb_build_object(
      'x-fc-help-cron-secret',
      (select secret from public.cron_secrets where name = 'push_run')
    )
  );
  $cron$
);
