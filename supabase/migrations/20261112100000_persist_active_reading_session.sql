alter table public.wordtrail_records
  drop constraint if exists wordtrail_records_kind_check;

alter table public.wordtrail_records
  add constraint wordtrail_records_kind_check
  check (kind in ('book', 'session', 'word', 'review', 'active_session', 'settings'));
