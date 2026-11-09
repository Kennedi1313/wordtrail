alter table public.wordtrail_club_members
  add column if not exists reading_profile jsonb not null default '{}'::jsonb;
