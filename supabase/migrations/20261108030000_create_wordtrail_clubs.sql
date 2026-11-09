create table if not exists public.wordtrail_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  book_title text not null,
  book_author text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.wordtrail_club_members (
  club_id uuid not null references public.wordtrail_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','member')),
  pages_read integer not null default 0 check (pages_read >= 0),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
alter table public.wordtrail_clubs enable row level security;
alter table public.wordtrail_club_members enable row level security;
grant select, insert, update, delete on public.wordtrail_clubs to authenticated;
grant select, insert, update, delete on public.wordtrail_club_members to authenticated;
create or replace function public.is_wordtrail_club_member(target_club uuid, target_user uuid default auth.uid()) returns boolean language sql security definer set search_path = public as $$ select exists (select 1 from public.wordtrail_club_members where club_id = target_club and user_id = target_user) $$;
drop policy if exists "Club members can view clubs" on public.wordtrail_clubs;
drop policy if exists "Users can create clubs" on public.wordtrail_clubs;
drop policy if exists "Admins can update clubs" on public.wordtrail_clubs;
drop policy if exists "Admins can delete clubs" on public.wordtrail_clubs;
drop policy if exists "Members can view club members" on public.wordtrail_club_members;
drop policy if exists "Users can join clubs" on public.wordtrail_club_members;
drop policy if exists "Members can update own progress" on public.wordtrail_club_members;
drop policy if exists "Members can leave clubs" on public.wordtrail_club_members;
create policy "Club members can view clubs" on public.wordtrail_clubs for select to authenticated using (public.is_wordtrail_club_member(id));
create policy "Users can create clubs" on public.wordtrail_clubs for insert to authenticated with check (created_by = (select auth.uid()));
create policy "Admins can update clubs" on public.wordtrail_clubs for update to authenticated using (created_by = (select auth.uid()));
create policy "Admins can delete clubs" on public.wordtrail_clubs for delete to authenticated using (created_by = (select auth.uid()));
create policy "Members can view club members" on public.wordtrail_club_members for select to authenticated using (public.is_wordtrail_club_member(club_id));
create policy "Users can join clubs" on public.wordtrail_club_members for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Members can update own progress" on public.wordtrail_club_members for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Members can leave clubs" on public.wordtrail_club_members for delete to authenticated using (user_id = (select auth.uid()));
create or replace function public.find_wordtrail_club_by_code(code text)
returns setof public.wordtrail_clubs language sql security definer set search_path = public
as $$ select * from public.wordtrail_clubs where invite_code = upper(trim(code)) limit 1 $$;
revoke all on function public.find_wordtrail_club_by_code(text) from public;
grant execute on function public.find_wordtrail_club_by_code(text) to authenticated;

create table if not exists public.wordtrail_club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.wordtrail_clubs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.wordtrail_club_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.wordtrail_club_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.wordtrail_club_posts enable row level security;
alter table public.wordtrail_club_replies enable row level security;
grant select, insert, delete on public.wordtrail_club_posts to authenticated;
grant select, insert, delete on public.wordtrail_club_replies to authenticated;
create or replace function public.is_wordtrail_club_admin(target_club uuid, target_user uuid default auth.uid()) returns boolean language sql security definer set search_path = public as $$ select exists (select 1 from public.wordtrail_club_members where club_id = target_club and user_id = target_user and role = 'admin') $$;
drop policy if exists "Club members can view posts" on public.wordtrail_club_posts;
drop policy if exists "Club members can create posts" on public.wordtrail_club_posts;
drop policy if exists "Authors and admins can delete posts" on public.wordtrail_club_posts;
drop policy if exists "Club members can view replies" on public.wordtrail_club_replies;
drop policy if exists "Club members can create replies" on public.wordtrail_club_replies;
drop policy if exists "Authors and admins can delete replies" on public.wordtrail_club_replies;
create policy "Club members can view posts" on public.wordtrail_club_posts for select to authenticated using (public.is_wordtrail_club_member(club_id));
create policy "Club members can create posts" on public.wordtrail_club_posts for insert to authenticated with check (author_id = (select auth.uid()) and public.is_wordtrail_club_member(club_id));
create policy "Authors and admins can delete posts" on public.wordtrail_club_posts for delete to authenticated using (author_id = (select auth.uid()) or public.is_wordtrail_club_admin(club_id));
create policy "Club members can view replies" on public.wordtrail_club_replies for select to authenticated using (exists (select 1 from public.wordtrail_club_posts p where p.id = post_id and public.is_wordtrail_club_member(p.club_id)));
create policy "Club members can create replies" on public.wordtrail_club_replies for insert to authenticated with check (author_id = (select auth.uid()) and exists (select 1 from public.wordtrail_club_posts p where p.id = post_id and public.is_wordtrail_club_member(p.club_id)));
create policy "Authors and admins can delete replies" on public.wordtrail_club_replies for delete to authenticated using (author_id = (select auth.uid()) or exists (select 1 from public.wordtrail_club_posts p where p.id = post_id and public.is_wordtrail_club_admin(p.club_id)));
