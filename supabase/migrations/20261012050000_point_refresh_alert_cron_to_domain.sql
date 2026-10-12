select cron.unschedule(jobid)
from cron.job
where jobname = 'fc-help-refresh-alerts';

select cron.schedule(
  'fc-help-refresh-alerts',
  '* * * * *',
  $cron$
  select net.http_get(
    url := 'https://fchelp.xyz/api/push/cron',
    headers := jsonb_build_object(
      'x-fc-help-cron-secret',
      (select secret from public.cron_secrets where name = 'push_run')
    ),
    timeout_milliseconds := 30000
  );
  $cron$
);
