-- PMS settings belong to Carmen, per BU and per PMS (decision-log #44).
--
-- Carmen's PMS setting screen now sets auto-post and generates the hook's key, through
-- /api/v1/carmen/pms (routers/pms_carmen.py). #/pms is gone. Both are per BU x PMS, the PMS
-- being the hook's InterfaceName, stored lower-case:
--
--   * api_keys.interface_name — a key is for one PMS; a hook naming another is a 403. One
--     live key per BU x PMS: generating a new one revokes the old in the same transaction,
--     and the unique index below is the backstop.
--   * pms_settings keyed (tenant_id, interface_name).
--
-- What was there is not carried over. Every live key is BU-wide and prod never had one, so
-- they are revoked and Carmen generates new ones. The BU-wide auto-post rows are dropped,
-- which puts every PMS back on "wait for a person", the safe side.
--
-- ORDER: ships with 20261015000000 (PR #292): deploy the code first, then `supabase db push`.

alter table api_keys add column if not exists interface_name varchar(40);

update api_keys
   set revoked_at = now(),
       revoked_by = 'migration',
       revoke_reason = 'Keys are per PMS since decision-log #44; Carmen generates a new one.'
 where revoked_at is null;

create unique index if not exists uq_api_keys_live_interface
    on api_keys (tenant_id, interface_name)
    where revoked_at is null;

delete from pms_settings;

alter table pms_settings add column if not exists interface_name varchar(40) not null;
alter table pms_settings drop constraint if exists pms_settings_pkey;
alter table pms_settings add primary key (tenant_id, interface_name);

comment on column pms_settings.interface_name is
    'The PMS (the hook''s InterfaceName, lower-case). Set by Carmen''s PMS setting screen.';
