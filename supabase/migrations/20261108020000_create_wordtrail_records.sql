create table if not exists public.wordtrail_records (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('book', 'session', 'word', 'review', 'settings')),
  record_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, record_id)
);

alter table public.wordtrail_records enable row level security;
grant select, insert, update, delete on public.wordtrail_records to authenticated;

drop policy if exists "Users can read their own Wordtrail records" on public.wordtrail_records;
create policy "Users can read their own Wordtrail records" on public.wordtrail_records for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their own Wordtrail records" on public.wordtrail_records;
create policy "Users can insert their own Wordtrail records" on public.wordtrail_records for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own Wordtrail records" on public.wordtrail_records;
create policy "Users can update their own Wordtrail records" on public.wordtrail_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own Wordtrail records" on public.wordtrail_records;
create policy "Users can delete their own Wordtrail records" on public.wordtrail_records for delete to authenticated using ((select auth.uid()) = user_id);
