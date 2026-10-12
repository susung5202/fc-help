alter table public.refresh_observations
add column if not exists source_record_key text;

update public.refresh_observations
set source_record_key = observer_key
where source_type = 'scraped_public'
  and source_record_key is null
  and observer_key is not null;

create unique index if not exists refresh_observations_source_record_key_uidx
on public.refresh_observations (source_record_key);

select cron.unschedule(jobid)
from cron.job
where jobname = 'fc-help-public-refresh-scrape';

select cron.schedule(
  'fc-help-public-refresh-scrape',
  '27 18 * * *',
  $cron$
  select net.http_get(
    url := 'https://fchelp.xyz/api/refresh/scrape-public/cron',
    headers := jsonb_build_object(
      'x-fc-help-cron-secret',
      (select secret from public.cron_secrets where name = 'push_run')
    )
  );
  $cron$
);
