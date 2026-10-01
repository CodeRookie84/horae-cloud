-- App data retention (agreed with the owner 2026-10-02). Operational pg_cron
-- job — DB state, not a schema migration. Apply with:
--   supabase db query --linked -f supabase/cron/app_data_retention.sql
-- cron.schedule is idempotent by job name, so re-running just updates the job.
--
--   notifications (in-app feed)      deleted after 90 days (app loads 30)
--   push_receipts                    deleted after 30 days (dispatcher reads 3)
--   classic checklist submissions    trimmed after 90 days from the JSON blob in
--                                    checklists.description, ALWAYS keeping each
--                                    person's latest one (so a finished one-time
--                                    checklist never flips back to "not done").
--                                    SOP read-receipts and quizzes are untouched.
--   kept forever: checklist_runs (food-safety audit record), tasks, notices,
--                 trainings/attempts, KOT, projects.
-- WhatsApp logs have their own 7-day job: see wa_keepwarm_and_log_pruning.sql.
-- Runs daily at 03:30 UTC (09:00 IST).
select cron.schedule(
  'prune-app-data',
  '30 3 * * *',
  $job$
    delete from public.notifications where created_at  < now() - interval '90 days';
    delete from public.push_receipts where received_at < now() - interval '30 days';

    do $trim$
    declare r record; d jsonb; kept jsonb;
    begin
      for r in select id, description from public.checklists
               where description like '{%' and description like '%"submissions"%' loop
        begin
          d := r.description::jsonb;
        exception when others then
          continue; -- not valid JSON: leave the row alone
        end;
        if coalesce(d->>'type', '') in ('sop', 'quiz')
           or jsonb_typeof(d->'submissions') is distinct from 'array' then
          continue;
        end if;
        select coalesce(jsonb_agg(s.sub order by s.ord), '[]'::jsonb) into kept
        from (
          select sub, ord,
                 row_number() over (partition by sub->'submittedBy'->>'userId'
                                    order by sub->>'submittedAt' desc) as rn
          from jsonb_array_elements(d->'submissions') with ordinality as e(sub, ord)
        ) s
        where s.rn = 1
           or (s.sub->>'submittedAt') >= to_char((now() - interval '90 days') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS');
        if jsonb_array_length(kept) < jsonb_array_length(d->'submissions') then
          update public.checklists set description = jsonb_set(d, '{submissions}', kept)::text
          where id = r.id;
        end if;
      end loop;
    end
    $trim$;
  $job$
);
