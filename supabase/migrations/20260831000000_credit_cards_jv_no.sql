-- The JV number Carmen hands back when a manual scan posts.
--
-- Until now it was read off the response and thrown away: the wizard showed it once and
-- nothing kept it. The activity table (#/CreditCardOCR) lists manual scans beside email
-- documents, and an email row links its JV into Carmen — a manual row cannot without this.
--
-- Additive, nullable, no backfill. Manual scans posted before this migration render "—",
-- which is honest: we genuinely do not know their JV number any more.
alter table credit_cards add column if not exists jv_no varchar(50);
