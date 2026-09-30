alter table public.refresh_reports
  drop constraint if exists refresh_reports_user_id_fkey;

alter table public.refresh_reports
  add constraint refresh_reports_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
