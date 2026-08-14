-- Per-bank document description.
--
-- `description` is one string per BU, and it is copied verbatim onto both Carmen
-- documents a statement produces: JvhDescription on the JV and InvhDesc on the
-- input-tax record. A BU that receives statements from several banks has no way to
-- say "SCB settlements read like this, KTC fee invoices like that" — every document
-- carries the same sentence.
--
-- A JSON map keyed by bank code rather than a config row per bank: the GL mappings
-- hang off config_id, so splitting the row would also split every mapping a BU has
-- already confirmed, and re-open them all for the AI to guess again. This changes
-- one string and nothing else. `description` stays the fallback, so a BU that never
-- sets a per-bank value behaves exactly as before.

ALTER TABLE bu_accounting_configs
    ADD COLUMN IF NOT EXISTS bank_descriptions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN bu_accounting_configs.bank_descriptions IS
    'bank_code -> document description, e.g. {"SCB":"SCB settlement"}. Falls back to description when a bank has no entry.';
