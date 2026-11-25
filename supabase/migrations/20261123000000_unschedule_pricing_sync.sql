-- Unschedule pricing-sync from pg_cron.
--
-- Since OpenRouter now returns `usage.cost` directly in the response object,
-- LLM calls are priced verbatim without requiring an 8-hour catalog sync to `model_pricing`.
-- The catalog lookup in `pricing_cache.py` remains as a graceful fallback, but the periodic
-- cron job is no longer needed.

select cron.unschedule(jobname)
from cron.job
where jobname = 'pricing-sync';
