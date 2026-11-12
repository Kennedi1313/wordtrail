create table public.wordtrail_sync_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 0 check (version >= 0)
);

revoke insert, update, delete on public.wordtrail_records from authenticated;

alter table public.wordtrail_sync_versions enable row level security;
grant select on public.wordtrail_sync_versions to authenticated;
create policy "Users can read their own sync version"
  on public.wordtrail_sync_versions for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.wordtrail_sync_versions from anon, authenticated;
grant select on public.wordtrail_sync_versions to authenticated;

drop function public.apply_wordtrail_record_changes(jsonb);

create function public.apply_wordtrail_record_changes(expected_version bigint, changes jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  current_version bigint;
  change jsonb;
  operation text;
  record_kind text;
  record_key text;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if expected_version is null or changes is null or jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) > 5000 then
    raise exception 'invalid change batch' using errcode = '22023';
  end if;

  insert into public.wordtrail_sync_versions (user_id, version)
  values (actor_id, 0) on conflict (user_id) do nothing;
  select version into current_version
  from public.wordtrail_sync_versions where user_id = actor_id for update;
  if current_version <> expected_version then
    raise exception 'sync version conflict' using errcode = '40001';
  end if;

  for change in select value from jsonb_array_elements(changes)
  loop
    operation := change->>'operation';
    record_kind := change->>'kind';
    record_key := change->>'record_id';

    if operation = 'delete_word' then
      delete from public.wordtrail_records
      where user_id = actor_id and kind = 'word'
        and data->>'normalized' = lower(btrim(change->>'normalized'));
    elsif operation = 'delete' then
      if record_kind not in ('book', 'session', 'active_session', 'review', 'settings', 'word') or record_key is null then
        raise exception 'invalid delete change' using errcode = '22023';
      end if;
      delete from public.wordtrail_records
      where user_id = actor_id and kind = record_kind and record_id = record_key;
    elsif operation = 'upsert' then
      if record_kind not in ('book', 'session', 'active_session', 'review', 'settings', 'word')
         or record_key is null or change->'data' is null then
        raise exception 'invalid upsert change' using errcode = '22023';
      end if;
      if record_kind = 'word' then
        delete from public.wordtrail_records
        where user_id = actor_id and kind = 'word'
          and data->>'normalized' = lower(btrim(change->'data'->>'normalized'))
          and record_id <> record_key;
      end if;
      insert into public.wordtrail_records (user_id, kind, record_id, data, updated_at)
      values (actor_id, record_kind, record_key, change->'data', now())
      on conflict (user_id, kind, record_id)
      do update set data = excluded.data, updated_at = excluded.updated_at;
    else
      raise exception 'unknown change operation' using errcode = '22023';
    end if;
  end loop;

  update public.wordtrail_sync_versions set version = current_version + 1 where user_id = actor_id;
  return current_version + 1;
end;
$$;

revoke all on function public.apply_wordtrail_record_changes(bigint, jsonb) from public;
grant execute on function public.apply_wordtrail_record_changes(bigint, jsonb) to authenticated;
