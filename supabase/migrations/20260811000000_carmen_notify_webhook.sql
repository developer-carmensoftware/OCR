-- Carmen webhook — "does this BU have something to look at in the AI app?"
--
-- Carmen doesn't want an event stream; it wants one bool pushed whenever it changes,
-- so it can show a badge without polling us. Because the payload is a *current state*
-- rather than an *event*, a failed push costs nothing — the next minute's sweep sends
-- whatever is true then. That is why there is no outbox, no attempt counter, no retry
-- schedule: the watermark columns on tenants ARE the retry mechanism.
--
-- Auth is the BU's own Carmen token (already stored in email_ingest_settings from
-- PUT /settings/token, §2.6) replayed as Authorization — no shared secret to exchange
-- with Carmen. Consequence: only BUs with a stored token (i.e. Email Automation
-- enabled) ever receive a push. See docs/CARMEN_INTEGRATION.md §3.

create table if not exists webhook_endpoints (
    id         uuid        primary key default gen_random_uuid(),
    -- Carmen hostname this endpoint serves, lowercase. '*' = fallback for any host
    -- without its own row, since Carmen will hand us one staging URL before per-host
    -- URLs exist.
    host       varchar(255) not null unique,
    url        varchar(500) not null,
    is_active  boolean      not null default true,
    created_at timestamptz  not null default now(),
    updated_at timestamptz  not null default now(),
    created_by varchar(100),
    updated_by varchar(100)
);

comment on table webhook_endpoints is
    'Where to push the Carmen notification-pending flag. host=''*'' is the fallback '
    'endpoint used when no host-specific row exists. Managed from #/admin/webhooks.';

-- The watermark: what we last told Carmen, so the sweep only pushes on change.
alter table tenants
    add column if not exists webhook_unread boolean,
    add column if not exists webhook_pushed_at timestamptz;

comment on column tenants.webhook_unread is
    'Last has_unread value pushed to Carmen for this tenant. Null = never pushed. '
    'Updated only on a successful (2xx) push — a failed push leaves this alone so the '
    'next sweep retries with whatever is true by then. This IS the retry mechanism.';

comment on column tenants.webhook_pushed_at is
    'When webhook_unread was last successfully pushed. Display only (admin status page).';

-- ── Schedule (UTC) ──────────────────────────────────────────────────────────────
select cron.unschedule('carmen-webhook-push') from cron.job where jobname = 'carmen-webhook-push';

select cron.schedule('carmen-webhook-push', '* * * * *', $$
select net.http_post(
    url     := (select value #>> '{}' from system_configs where key_name = 'app.base_url' limit 1)
               || '/api/v1/admin/webhooks/push',
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                        where name = 'internal_job_token' limit 1)),
    body    := '{}'::jsonb);
$$);
