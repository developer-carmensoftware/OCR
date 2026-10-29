-- Who resolved a card's input-tax record, and whether it was filed here or keyed by hand.
--
-- CA-111 lets a posted JV's VAT claim be settled after the fact, from the queue, for email
-- documents as well as manual scans, and in one of two ways: this app files the ACTX record
-- (`input_tax_keyed = false`), or somebody says it was already keyed into Carmen by hand and
-- this app makes no call at all (`true`). Carmen has no search on its input-tax register, so
-- the second is a person's word, and the column is what keeps it distinguishable from a
-- record this app actually filed.
--
-- `input_tax_at` keeps its job — NULL with `tax_amt > 0` on a posted card is still "owed" —
-- and now means "resolved" either way.

alter table credit_cards
    add column if not exists input_tax_by varchar(36),
    add column if not exists input_tax_keyed boolean not null default false;

comment on column credit_cards.input_tax_by is
    'Carmen user id who filed the input-tax record here or marked it keyed. NULL = the email job, or resolved before 20261029000000.';
comment on column credit_cards.input_tax_keyed is
    'true = keyed into Carmen by hand and marked here (no Carmen call); false = this app filed it.';
comment on column credit_cards.input_tax_at is
    'When the input-tax record was resolved: filed by this app, or marked keyed in Carmen. NULL with tax_amt > 0 = still owed.';
