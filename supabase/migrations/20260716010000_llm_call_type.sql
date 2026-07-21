-- llm_usage_logs.call_type — which KIND of LLM call a row is.
--
-- Every module makes two kinds of call and BOTH log under the same module_id: the
-- vision extract (one per document, 5-12s) and the text suggestion for GL mapping
-- (gl_suggestion_service, ap_invoice_service.suggest_for_items). So count(*) grouped
-- by module_id blends them, and avg(duration_ms) averages a slow vision call together
-- with a fast text one into a number that describes neither call.
--
-- Until now the only way to tell them apart was incidental: suggestion calls never
-- pass task_id, extracts always do. That is a fact about current wiring, not intent —
-- and it inverts silently the day someone traces a suggestion back to its document,
-- which is a reasonable thing to want. Make the distinction explicit instead.
--
-- Note: `documents` on the Usage page was never affected — it comes from ocr_tasks,
-- and a suggestion creates no task. This is about the LLM-call/token/cost/latency
-- columns only.
--
-- llm_usage_logs is declaratively partitioned (pg_partman); ALTER on the parent
-- propagates to every partition. Nullable: rows written by an older deploy stay null
-- until the backfill below, and readers treat null as "unknown", never as a kind.
alter table llm_usage_logs add column if not exists call_type varchar(16);

-- Backfill from the incidental discriminator. This is correct for history precisely
-- because no suggestion call has ever passed a task_id — the same fact that made the
-- discriminator work is what makes the backfill trustworthy.
update llm_usage_logs
   set call_type = case when task_id is not null then 'extract' else 'suggest' end
 where call_type is null;
