-- Membership changes must go through authenticated, atomic RPCs.
drop policy if exists "Users can create clubs" on public.wordtrail_clubs;
drop policy if exists "Users can join clubs" on public.wordtrail_club_members;
drop policy if exists "Members can update own progress" on public.wordtrail_club_members;

create policy "Members can update own progress"
  on public.wordtrail_club_members
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke insert on public.wordtrail_clubs from authenticated;
revoke insert on public.wordtrail_club_members from authenticated;
revoke update on public.wordtrail_club_members from authenticated;
grant update (pages_read, reading_profile)
  on public.wordtrail_club_members to authenticated;

create or replace function public.create_wordtrail_club(club_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  normalized_name text := btrim(club_name);
  invite_token text;
  new_club public.wordtrail_clubs;
  new_member public.wordtrail_club_members;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if normalized_name is null or length(normalized_name) < 1 or length(normalized_name) > 80 then
    raise exception 'club name must be between 1 and 80 characters' using errcode = '22023';
  end if;

  loop
    invite_token := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    begin
      insert into public.wordtrail_clubs (name, invite_code, book_title, created_by)
      values (normalized_name, invite_token, 'Ainda não definido', actor_id)
      returning * into new_club;
      exit;
    exception when unique_violation then
      -- A concurrent creator may have selected the same short code; generate another.
      null;
    end;
  end loop;

  insert into public.wordtrail_club_members (club_id, user_id, role)
  values (new_club.id, actor_id, 'admin')
  returning * into new_member;

  return jsonb_build_object('club', to_jsonb(new_club), 'member', to_jsonb(new_member));
end;
$$;

create or replace function public.join_wordtrail_club(invite_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_club public.wordtrail_clubs;
  target_member public.wordtrail_club_members;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into target_club
  from public.wordtrail_clubs
  where invite_code = upper(btrim(invite_token))
  limit 1;
  if not found then
    raise exception 'club not found' using errcode = 'P0002';
  end if;

  insert into public.wordtrail_club_members (club_id, user_id, role)
  values (target_club.id, actor_id, 'member')
  on conflict (club_id, user_id) do nothing;

  select * into target_member
  from public.wordtrail_club_members
  where club_id = target_club.id and user_id = actor_id;

  return jsonb_build_object('club', to_jsonb(target_club), 'member', to_jsonb(target_member));
end;
$$;

revoke all on function public.create_wordtrail_club(text) from public;
revoke all on function public.join_wordtrail_club(text) from public;
grant execute on function public.create_wordtrail_club(text) to authenticated;
grant execute on function public.join_wordtrail_club(text) to authenticated;

drop function if exists public.find_wordtrail_club_by_code(text);

alter table public.wordtrail_club_posts
  add constraint wordtrail_club_posts_title_length
    check (length(btrim(title)) between 1 and 120) not valid,
  add constraint wordtrail_club_posts_body_length
    check (length(btrim(body)) between 1 and 5000) not valid;

alter table public.wordtrail_club_replies
  add constraint wordtrail_club_replies_body_length
    check (length(btrim(body)) between 1 and 3000) not valid;
