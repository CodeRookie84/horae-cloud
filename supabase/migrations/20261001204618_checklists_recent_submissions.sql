-- Checklists as the APP loads them: classic checklists' `submissions` history
-- (stored inside checklists.description JSON) trimmed to the last p_days plus
-- each person's latest submission, so a phone doesn't re-download every
-- submission ever made. Nothing is deleted — the table keeps the full history,
-- every write path reads the full row, and admin reports/CSV fetch the table
-- directly (store.getChecklists({ allHistory: true })).
--
-- SECURITY INVOKER: runs as the caller, so the checklists RLS policies apply
-- exactly as for a plain select. SOP read-receipts and quizzes are untouched.

create or replace function public.checklists_recent(
  p_tenant_ids text[],
  p_since timestamptz default null,
  p_days int default 90
)
returns setof public.checklists
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  r public.checklists;
  d jsonb;
  kept jsonb;
  cutoff text := to_char((now() - make_interval(days => p_days)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS');
begin
  for r in
    select * from public.checklists c
    where c.tenant_id = any(p_tenant_ids)
      and (p_since is null or c.updated_at > p_since)
  loop
    if r.description like '{%' and r.description like '%"submissions"%' then
      begin
        d := r.description::jsonb;
        if coalesce(d->>'type', '') not in ('sop', 'quiz')
           and jsonb_typeof(d->'submissions') = 'array' then
          select coalesce(jsonb_agg(s.sub order by s.ord), '[]'::jsonb) into kept
          from (
            select sub, ord,
                   row_number() over (partition by sub->'submittedBy'->>'userId'
                                      order by sub->>'submittedAt' desc) as rn
            from jsonb_array_elements(d->'submissions') with ordinality as e(sub, ord)
          ) s
          where s.rn = 1 or (s.sub->>'submittedAt') >= cutoff;
          if jsonb_array_length(kept) < jsonb_array_length(d->'submissions') then
            r.description := jsonb_set(d, '{submissions}', kept)::text;
          end if;
        end if;
      exception when others then
        null; -- unparseable description: return the row unchanged
      end;
    end if;
    return next r;
  end loop;
end;
$$;

grant execute on function public.checklists_recent(text[], timestamptz, int) to authenticated;
