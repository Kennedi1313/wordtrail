create table if not exists public.wordtrail_user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{"state":{"words":[],"readingSessions":[],"reviews":[],"activeReadingSession":null},"settings":{"dailyGoal":30}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.wordtrail_user_data enable row level security;

revoke all on public.wordtrail_user_data from anon;
grant select, insert, update on public.wordtrail_user_data to authenticated;

drop policy if exists "Users can read their own Wordtrail data" on public.wordtrail_user_data;
create policy "Users can read their own Wordtrail data"
  on public.wordtrail_user_data for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own Wordtrail data" on public.wordtrail_user_data;
create policy "Users can insert their own Wordtrail data"
  on public.wordtrail_user_data for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own Wordtrail data" on public.wordtrail_user_data;
create policy "Users can update their own Wordtrail data"
  on public.wordtrail_user_data for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
