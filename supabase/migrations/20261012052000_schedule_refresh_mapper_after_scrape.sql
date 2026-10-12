select cron.unschedule(jobid)
from cron.job
where jobname = 'fc-help-refresh-observation-spid-map';

select cron.schedule(
  'fc-help-refresh-observation-spid-map',
  '29 18 * * *',
  $cron$
  select net.http_get(
    url := 'https://fchelp.xyz/api/refresh/map-observations/cron',
    headers := jsonb_build_object(
      'x-fc-help-cron-secret',
      (select secret from public.cron_secrets where name = 'push_run')
    ),
    timeout_milliseconds := 55000
  );
  $cron$
);
