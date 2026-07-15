-- Routing evidence for LLM calls: record WHICH privacy directive we sent (data_policy)
-- and WHICH provider OpenRouter actually routed to (provider), per call. This is the
-- auditable proof behind the no-train claim — links 1 & 2 of the chain (our side + where
-- it routed). We deliberately do NOT store request bodies/images (no-storage guarantee);
-- only the tiny non-sensitive directive + resolved provider name.
--
-- outbound_call_logs is declaratively partitioned (pg_partman); ALTER on the parent
-- propagates to all partitions. Columns are nullable — non-LLM (Carmen) calls leave them null.
alter table outbound_call_logs add column if not exists provider    varchar(60);
alter table outbound_call_logs add column if not exists data_policy varchar(120);
