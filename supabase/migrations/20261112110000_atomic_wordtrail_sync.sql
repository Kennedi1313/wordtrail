create or replace function public.apply_wordtrail_record_changes(changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  change jsonb;
  operation text;
  record_kind text;
  record_key text;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) > 5000 then
    raise exception 'invalid change batch' using errcode = '22023';
  end if;

  for change in select value from jsonb_array_elements(changes)
  loop
    operation := change->>'operation';
    record_kind := change->>'kind';
    record_key := change->>'record_id';

    if operation = 'delete_word' then
      delete from public.wordtrail_records
      where user_id = actor_id
        and kind = 'word'
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
        where user_id = actor_id
          and kind = 'word'
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
end;
$$;

revoke all on function public.apply_wordtrail_record_changes(jsonb) from public;
grant execute on function public.apply_wordtrail_record_changes(jsonb) to authenticated;
