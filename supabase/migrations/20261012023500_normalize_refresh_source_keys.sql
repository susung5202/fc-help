update public.refresh_observations
set source_record_key =
  'fconlab:' ||
  substring(source_url from '/refresh/seasons/([^/?#]+)') ||
  ':' ||
  lower(regexp_replace(player_name, '[^0-9A-Za-z가-힣]+', '', 'g')),
  updated_at = now()
where source_type = 'scraped_public'
  and source_url like 'https://fconlab.com/refresh/seasons/%';
