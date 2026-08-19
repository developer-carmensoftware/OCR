# SQL Performance Audit — v1

**Status: measured.** Items 15–20 and 22 of
[`backend/db/queries.sql`](../backend/db/queries.sql) were run against production on
2026-08-19; §3 carries the results and §4 the verdicts. Items 21 and 24, and the §3.4
`EXPLAIN` pass, were **deliberately not run** — §3.2 and §3.3 had already made their answers
moot, and each section below says so in place of leaving a blank that reads as pending work.

| | |
|---|---|
| Audit date | 2026-08-19 |
| DB | Supabase Postgres 17, `ap-southeast-1`, via Supavisor session pooler |
| App | `backend/app`, branch `chore/sql-audit-cleanup` |
| Companion report | [LOAD_TEST_REPORT_V2.md](LOAD_TEST_REPORT_V2.md) — that one measures LLM throughput and connection limits; this one measures SQL |

---

## TL;DR

**The database is idle.** Total SQL execution across all statements is **18.5 minutes over
68 days** — a 0.019% duty cycle — of which roughly a third is application-owned
(**5.7 s/day**). The whole database is ~50 MB; the largest business table holds 342 rows.
Nothing here is a performance problem, and five of the nine hypotheses this audit set out to
test do not appear in the top 20 consumers at all.

What it did find is **waste and drift**: a cron firing 1,440 404s a day for six days, a cron
in production that exists in no migration, an unmanaged table that is now the largest object
in the database, and 3.8 MB of indexes on the hottest-write table that have never been read.

**And one thing the audit was not looking for.** Endpoint latency has tripled since June —
`/admin/tenants` from a 463 ms median to 1,054 ms — but §3.1b shows SQL accounts for at most
3% of that wall time, and §3.1d shows the instance can still answer a request in **1 ms**.
The slowdown is real, it is not the database, and chasing it is application profiling rather
than query tuning. §3.1e records the three leads and the evidence for each so the next
attempt starts from measurements.

| # | Finding | Metric | Measured | Budget | Verdict | Headroom |
|---|---|---|---|---|---|---|
| N1 | `cron.job_run_details` has no retention — largest object in the DB | total size | **17 MB**, never analysed | — | ❌ **FAIL** | grows ~2,880 rows/day |
| F3 | `carmen-webhook-push` fires at a route that does not exist | 404/day | **1,440/day × 6 days** | 0 | ❌ **FAIL** — dead in prod, alive in the repo | n/a |
| N4 | Cron `probe` (`select 1`, every minute) exists in no migration | drift | 1,440 runs/day | 0 | ❌ **FAIL** | half of N1's growth |
| F7 | Indexes the planner never uses | `idx_scan` over 89 d | **105 indexes at 0**; 3.8 MB on `performance_logs` | > 0 | ❌ **FAIL** — but relocated | n/a |
| F6 | `/usage-summary/totals` skips `_assert_date_range()` | *(logic bug)* | n/a | n/a | ❌ **CONFIRMED** from source | n/a |
| F1 | Unbounded `ORDER BY created_at DESC` on 2 partitioned tables | CPU share | **< 0.8%** (not in top 20) | < 5% | ⚠️ **WATCH** | ~**18× current data** |
| N2 | `performance_logs` INSERT is one statement per row, not batched | CPU share | **8.2%** = 1.3 s/day | < 5% | ⚠️ **WATCH** — share high, absolute trivial | scales with traffic |
| F2 | `last_used_q` runs outside the `include_engagement` gate | CPU share | **< 0.8%** | < 5% | ✅ **PASS** | — |
| F4 | Rollups built nightly, read by one service | CPU share | **< 0.8%**; every rollup index cold | < 5% | ✅ **PASS** — waste, not cost | — |
| F5 | `get_tenant_engagement_map` reads a tenant's whole history | mean_exec_time | **< 0.8%** (342 rows) | < 2000 ms | ✅ **PASS** | — |
| F8 | `submitted_at` has no index | CPU share | **< 0.8%** (255 / 41 rows) | < 5% | ✅ **PASS** | — |
| F9 | Nothing in the repo measures SQL | extension present | installed, **68-day window** | installed | ✅ **RESOLVED** by this pack | n/a |

**Must fix now — all DB-side, no application code:** N1 (retention on `cron.job_run_details`),
F3 (unschedule in a migration so `db reset` cannot resurrect it), N4 (drop `probe`),
F7 (drop `ix_performance_logs_endpoint` — provably unusable, see §3.6), F6 (one line).

**Watch, do not touch yet:** F1 — trigger is `performance_logs` passing ~1.5M rows, roughly
**18× today's 84k**. That is a function of adoption, not the calendar: ~35 months at current
traffic, ~3.5 months at 10× adoption. N2 — 8.2% of a very small pie; revisit only if traffic
grows an order of magnitude.

**Closed — the hypothesis was wrong:** F2, F4, F5, F8. All four were predicted from query
shape and are invisible at this data volume. Recorded rather than deleted: the shapes are
still what they are, and this audit's own ranking was wrong about which ones matter.

---

## 1. Method — why these numbers can be trusted

**What was measured, and from where.** Ten read-only queries, kept in
[`backend/db/queries.sql`](../backend/db/queries.sql) items 15–24 so this audit is
reproducible rather than a one-off. Run them from the Supabase SQL Editor, one at a time.

| Metric | Source | Item |
|---|---|---|
| M0 measurability | `pg_extension`, `pg_stat_statements_info` | 15 |
| M1 latency trend per endpoint per week | `performance_logs` | 16 |
| M2 CPU attribution per query | `pg_stat_statements` | 17 |
| M3 table size + growth per partition | `pg_stat_user_tables`, `pg_inherits` | 18 |
| M4 never-used indexes | `pg_stat_user_indexes` | 19 |
| M5 cache hit ratio + sort spill (RAM) | `pg_statio_user_tables`, `pg_stat_statements` | 20 |
| M6 seq-scan ratio | `pg_stat_user_tables` | 21 |
| M7 dead cron / 404 storms | `performance_logs`, `cron.job_run_details` | 22 |
| M8 connection-pool pressure | `pg_stat_activity` | 23 |
| M9 dead tuples / autovacuum lag | `pg_stat_user_tables` | 24 |

Plus `EXPLAIN (ANALYZE, BUFFERS)` run by hand on six suspect queries — recording actual time,
`Buffers: shared hit/read`, `Sort Method` (in-memory quicksort vs **external merge Disk**),
and how many partitions appear in the plan. Those go in §3.4.

**Measurement window.** `performance_logs` has recorded every request since the partitioning
migration on 2026-06-15, so M1 has roughly nine weekly buckets — enough for a slope, not
enough for seasonality. `pg_stat_statements` accumulates from its last reset; item 15b
records that timestamp, and if the window is under one full working day, M2 and M5 are not
reportable.

| Window | Value | Why it matters |
|---|---|---|
| `performance_logs` window | 2026-06-15 → 2026-08-19 | ~9 weekly buckets for M1 |
| `pg_stat_statements` installed | yes (`pg_partman` and `pg_cron` too) | item 15, 2026-08-19 |
| `pg_stat_statements` reset at | 2026-06-11 21:47 UTC | **predates** the 2026-06-15 partitioning migration, so M2 covers the whole life of the current schema |
| `pg_stat_statements` window | **68 days 6 h** | well past the one-working-day minimum |
| Statements tracked | 3,287 | vs a 5,000 default cap — 66% full, no eviction yet, so the top-20 ranking is complete |
| Table/index stats reset at | 2026-05-22 15:13 UTC (**89 days**) | the window that makes M4's `idx_scan = 0` trustworthy |
| `work_mem` / `shared_buffers` | *not read* | Item 20c was dropped once §3.3 showed the whole database is ~50 MB — no sort on this data can approach any plausible `work_mem`. |

**Consequence of a 68-day window:** the `% CPU` column in §3.2 is a 68-day *average*, not a
picture of today. A query introduced last week is under-represented there by construction —
§3.1's weekly trend is the counterweight, and the two must be read together.

**What this audit cannot see** — stated up front so no one reads a gap as a clean bill:

- **Failures before the DB is touched.** A password-protected PDF is rejected by
  `ensure_pdf_openable` before any query runs, so it appears in neither `ocr_tasks` nor these
  metrics.
- **`pg_stat_statements` normalises literals**, so one entry covers every parameterisation of
  a query. A plan that is fast for one tenant and slow for another averages into one row —
  `stddev_ms` in item 17 is the only hint, which is why it is in the output.
- **Counters reset** on DB restart, failover, or a manual reset. Item 15b is the guard.
- **M8 is a snapshot**, not a time series. Taken off-peak it will show an idle pool and prove
  nothing.
- **This is production data at pilot volume.** A `PASS` here means "not a problem at today's
  size", which is exactly why every finding carries a headroom figure instead of a pass/fail
  alone.

---

## 2. Inventory — how much SQL exists

Counted from the source tree, not estimated.

| Category | Count | Where |
|---|---|---|
| SQLAlchemy statements built in Python | **181** | 40 files |
| `.execute()` call sites | **182** | services 129 / routers 44 / auth 3 |
| Files that touch the DB | 63 | `app/services/` densest |
| Raw `text()` uses | 33 | mostly server defaults and DDL helpers, not queries |
| DB-side functions (`fn_*`) | 11 | `*_cron_jobs.sql`, `*_billing_cron.sql` |
| pg_cron jobs | **15** | 2 fire every minute, 2 every ten |
| Tables | **51** | `supabase/schemas/`, 12 files |
| Named indexes | **174** | plus PK / unique constraints |
| Migrations | 62 | `supabase/migrations/` |

Concentrated in five files: `usage_analytics_service.py` (18), `email_settings_service.py`
(16), `credit_order_service.py` (16), `credit_service.py` (12), `summary_service.py` (10).

### 2.1 What the code already does right

Recorded because an audit that only lists faults misrepresents the system.

1. **The four high-volume log tables are partitioned** by month with pg_partman retention
   (12 months; 24 for `audit_logs`), dropping rather than detaching —
   `20260615000001_partition_log_tables.sql`.
2. **Every high-frequency write is buffered.** Performance, audit, and outbound-call logs go
   through an in-memory buffer flushed every 10 s or 500 rows, with a hard cap that drops
   oldest rather than OOM the worker — `middleware/performance.py:30-48`. This turns
   O(n requests) of DB writes into O(1) batches.
3. **The hot path is cached.** Session lookup has a 60 s TTL with a throttled `last_used_at`
   write (`auth/dependencies.py:32-68`); the maintenance flag has a 10 s TTL, so
   `MaintenanceMiddleware` — which runs on every single request — touches the DB at most
   ~12 times per minute for the whole process regardless of user count.
4. **Credit consumption is an atomic `UPDATE … WHERE`**, not read-modify-write
   (`credit_service.py:105-141`): no race, no row lock held across application logic.
5. **No N+1.** A full sweep found no loop issuing a query per row. Cross-table lookups use
   bulk `IN (...)` and merge in Python — the correct shape against a partitioned table.
6. **A 30 s `statement_timeout` is applied on every pool checkout** (`database.py:98-110`),
   so one runaway query cannot hold a connection out of a 10-connection pool indefinitely.
7. **One scalability pass already shipped** — `20260708170000` added a composite partial
   index to `ocr_tasks` matching the real admin query shape.

The wizard hot path costs roughly **6–9 queries and 5 pool checkouts per request**, and
deliberately holds no connection across the LLM call (`routers/ocr.py:76-78`).

---

## 3. Measured results

> Raw numbers only. No interpretation — that belongs in §4.

### 3.1 Latency trend per endpoint per week (M1, item 16) — **measured 2026-08-19**

p50 is the honest column: these admin endpoints see 1–200 calls a week, so p95 and max are
single unlucky requests, not a distribution.

| Endpoint | p50 by week (Jun 15 → Aug 17), ms | Calls/wk |
|---|---|---|
| `/admin/llm-usage` | 359 · 363 · 584 · 684 · 980 · 762 | 1–20 |
| `/admin/performance-logs` | 447 · 533 · 1003 · 942 · 1093 · 1192 | 1–14 |
| `/admin/tenants` | 463 · 495 · 588 · 738 · 774 · 866 · 997 · 1289 · 1072 · 1054 | 1–197 |
| `/admin/usage-summary` | 804 · 870 · 1020 · 938 · 915 · 1235 · 1231 · 1414 · 1121 · 1100 | 1–74 |

**Every one roughly doubled or tripled between mid-June and August.** On its own that is
exactly the failure mode this audit was hunting: cost rising with data rather than traffic.

**It is not that. §3.1b rules the database out arithmetically.**

Slowest endpoints, last 4 weeks:

| Endpoint | Calls | p50 ms | p95 ms | max ms |
|---|---|---|---|---|
| `/credit-card/extract` | 34 | 8,834 | 23,849 | 28,022 |
| `/ap-invoice/suggest` | 10 | 4,799 | 16,091 | 21,787 |
| `/carmen/email-ingest/run` | 320 | 2,594 | 11,684 | **158,204** |
| `/ap-invoice/extract` | 10 | 6,914 | 8,132 | 8,682 |
| `/auth/exchange` | 110 | 1,792 | 5,773 | 10,752 |
| `/auth/usage` | 819 | **1,861** | 5,584 | 15,430 |
| `/carmen/email-ingest/confirmations` | 2,813 | 2,297 | 4,376 | 106,270 |
| `/notifications` | 5,116 | **1,220** | 4,315 | 29,006 |
| `/email-flow/documents` | 1,239 | 1,187 | 4,141 | 9,878 |
| `/admin/usage-summary` | 32 | 1,186 | 4,148 | 6,026 |
| `/admin/tenants` | 105 | 990 | 3,909 | 5,162 |

The LLM endpoints at the top are model latency and are expected. The rows that matter are the
cheap ones: **`/notifications` runs two queries against a table of fewer than 200 rows and
still has a 1,220 ms median. `/auth/usage` reads one balance and one subscription row and has
1,861 ms.** Neither number can come from the work it describes.

### 3.1b Where the latency actually is — the arithmetic

Wall-clock consumed by four cheap endpoints over the last 4 weeks:

| Endpoint | Calls × p50 | Total |
|---|---|---|
| `/carmen/email-ingest/confirmations` | 2,813 × 2,297 ms | 6,461 s |
| `/notifications` | 5,116 × 1,220 ms | 6,242 s |
| `/auth/usage` | 819 × 1,861 ms | 1,524 s |
| `/email-flow/documents` | 1,239 × 1,187 ms | 1,471 s |
| **Total** | | **≈ 15,700 s (4.4 h)** |

Total SQL execution on the entire database over the same 4 weeks, scaled from §3.2's 68-day
figure: 1,107,199 ms × 28 ÷ 68 ≈ **456 s** — and that includes pg_cron, pg_net, the Supavisor
pooler, and a human clicking around Supabase Studio.

**SQL is at most 3% of the wall time on those four endpoints, and realistically under 1%.
Over 99% of the latency is spent somewhere other than the database.**

### 3.1c Hosting context

[`render.yaml`](../render.yaml) declares `plan: free`, `region: singapore`.

- **`region: singapore` matches Supabase `ap-southeast-1`** — app and database are
  co-located, so network round-trip to the database is *not* the explanation.
- **`plan: free` on Render is 0.1 vCPU / 512 MB**, with spin-down after 15 minutes idle —
  which is what the `keep-warm` cron every 10 minutes exists to prevent.

A first draft of this section claimed the 0.1 vCPU produced a fixed ~1 s floor on every
request. **§3.1d disproves that** and the claim is withdrawn. It is kept here rather than
deleted because it was wrong in an instructive way: the p50s *did* cluster around
1,000–1,200 ms, which looked like a floor, and only a direct measurement of the cheapest
possible request distinguished "floor" from "contention".

### 3.1d Control experiment — **measured 2026-08-19**

**Control B — the cheapest requests in the system, last 4 weeks:**

| Endpoint | Calls | p50 ms | min ms | What it does |
|---|---|---|---|---|
| `/api/v1/admin/webhooks/push` | 8,820 | **1** | **1** | 404 — no route, no handler, no dependency |
| `/api/v1/admin/auth/me` | 154 | **9** | 3 | admin JWT decode + a DB read |
| `/api/v1/carmen/gl-prefix` | 65 | 45 | 1 | |
| `/api/v1/carmen/bank-codes` | 98 | 57 | 2 | |
| `/api/v1/carmen/tax-profiles` | 77 | 140 | 1 | |
| `/api/v1/carmen/settings` | 674 | 418 | 2 | |
| `/api/v1/admin/payment-info` | 31 | 465 | **418** | never once faster than 418 ms |

**There is no CPU floor.** The instance answers a request in 1 ms, and answers one that
decodes a JWT and reads the database in 9 ms — which also confirms a single DB round trip
costs single-digit milliseconds. The F3 404 storm turns out to have left behind the perfect
instrument: 8,820 samples of "middleware + routing and nothing else".

**Control A — `/api/v1/maintenance/status`, served from a 10-second in-process cache:**

| Week | Calls | p50 ms | p95 ms |
|---|---|---|---|
| 2026-07-20 | 2,708 | 502 | 1,332 |
| 2026-07-27 | 2,069 | 513 | 2,033 |
| 2026-08-03 | 610 | 526 | 1,426 |
| 2026-08-10 | 874 | 526 | 1,566 |
| 2026-08-17 | 688 | **517** | 1,452 |

**Flat.** Five weeks, 25 ms of drift. So the 2–3× growth in §3.1 is **not** a global
infrastructure trend — it is specific to the admin endpoints.

### 3.1e What is established, and what is not

**Established:**

1. **SQL is not the bottleneck.** ≤3% of wall time by the §3.1b arithmetic, and no
   application query appears in the top 20 CPU consumers.
2. **There is no fixed CPU floor** — 1 ms is achievable on this instance.
3. **The slowdown is endpoint-specific, not global** — the cached control is flat while the
   admin endpoints tripled.
4. **A DB round trip is single-digit milliseconds** (`/admin/auth/me` at 9 ms end to end).

**Not established — the gap between "1 ms is possible" and "500–1,200 ms is typical".**
Three testable leads, none of them SQL, in rough order of promise:

- **Connection churn.** 269,875 `pgbouncer.get_auth()` calls against 84,376 logged requests
  is **~3.2 pooler authentications per HTTP request**. A warm pool should authenticate almost
  never. Something is rebuilding connections — process restarts on the free plan,
  `pool_recycle`, or the fact that a single request opens up to five *separate* sessions.
- **The perf-log flush.** `flush_perf_buffer()` emits 500 individual INSERTs (§3.2 confirms
  one statement per row) every 10 seconds. The DB cost is trivial, but the Python-side work
  of building and compiling 500 statements is CPU that blocks the event loop on 0.1 vCPU.
  Fits the `max_ms` outliers — 29,006 ms on `/notifications`.
- **Per-request concurrency.** An admin page load fires 3–5 requests at once
  (`Overview.tsx` uses `Promise.allSettled` over three); `/maintenance/status` fires alone on
  a timer. Contention on a tenth of a core would slow the former and leave the latter flat —
  which is exactly the observed pattern.

**Answering these is application profiling, not a SQL audit,** and none of it changes this
report's fix list. Recorded here so the next person starts from measurements instead of from
the same wrong guess this section already made once.

### 3.2 CPU attribution — top 20 (M2, item 17) — **measured 2026-08-19**

**Denominator first, because it reframes everything below.** The top entry is 14.1% of all
execution time at 156,115 ms, so total SQL execution across the whole database is
**1,107,199 ms ≈ 18.5 minutes — over a 68-day window.** Against 5,896,800 seconds of
wall clock that is a **0.019% duty cycle**. Percentages in this table are shares of
18.5 minutes, not shares of a busy server.

| % CPU | Calls | Total ms | Mean ms | Stddev ms | Max ms | Query | Owner |
|---|---|---|---|---|---|---|---|
| 14.1 | 269,875 | 156,115 | 0.6 | 2.6 | 244 | `pgbouncer.get_auth($1)` | Supavisor |
| 8.2 | 84,355 | 90,598 | 1.1 | 3.2 | 193 | `INSERT INTO performance_logs (…)` | **app** |
| 7.0 | 1,558 | 77,308 | 49.6 | 25.0 | 120 | `fn_purge_inactive_sessions()` | **app** (hourly cron) |
| 6.9 | 166 | 76,085 | 458.3 | 223.8 | 1,042 | `SELECT e.name, n.nspname … FROM pg_extension …` | Supabase Studio |
| 6.7 | 133 | 74,352 | 559.0 | 372.5 | 1,187 | `SELECT name FROM pg_timezone_names` | Supabase Studio |
| 5.3 | 62,102 | 58,835 | 0.9 | 2.1 | 43 | `INSERT INTO cron.job_run_details (…)` | pg_cron |
| 5.1 | 5,024 | 56,095 | 11.2 | 6.3 | 49 | `net.http_get(url := … system_configs …)` | **app** (keep-warm cron) |
| 5.0 | 1,172 | 54,789 | 46.7 | 18.4 | 160 | `fn_hold_expired_orders()` | **app** (hourly cron) |
| 4.8 | 12,039 | 53,595 | 4.5 | 5.1 | 52 | `net.http_post(url := … system_configs …)` | **app** (per-minute crons) |
| 3.9 | 7,388 | 43,377 | 5.9 | 24.5 | 824 | `UPDATE ocr_sessions SET last_used_at …` | **app** (hot path) |
| 3.1 | 4,526 | 34,786 | 7.7 | 5.0 | 31 | `DISCARD ALL` | Supavisor |
| 2.4 | 28 | 26,436 | 944.1 | 632.0 | 2,059 | `with page as (select c.oid, c.relname …)` | Supabase Studio |
| 2.1 | 36 | 23,088 | 641.3 | 85.2 | 794 | `partman.run_maintenance_proc()` | pg_partman |
| 1.3 | 65 | 14,315 | 220.2 | 78.8 | 411 | `fn_build_daily_summary()` | **app** (nightly cron) |
| 1.2 | 133 | 13,216 | 99.4 | 147.8 | 1,560 | `WITH base_types AS (… RECURSIVE …)` | Supabase Studio |
| 0.9 | 68 | 10,371 | 152.5 | 53.0 | 321 | `with f as (… arg_modes …)` | Supabase Studio |
| 0.9 | 77,514 | 9,644 | 0.1 | 0.6 | 32 | `BEGIN ISOLATION LEVEL READ COMMITTED` | driver |
| 0.9 | 7,697 | 9,551 | 1.2 | 1.6 | 15 | `DELETE FROM net._http_response …` | pg_net |
| 0.8 | 32,651 | 9,403 | 0.3 | 0.7 | 23 | `DELETE FROM net._http_response …` | pg_net |
| 0.8 | 32,651 | 9,034 | 0.3 | 0.9 | 17 | `DELETE FROM net.http_request_queue …` | pg_net |

Top 20 accounts for 81.4%; the remaining 3,267 tracked statements share 18.6% (~206 s).

**Ownership split.** Application-owned ≈ 35% (~391 s ≈ **5.7 s/day**). Supabase Studio
catalog queries ≈ 18% — a human browsing the dashboard, and by mean latency (458–944 ms) the
slowest thing running. Pooler, pg_cron, pg_net, and driver overhead ≈ 46%.

**Not present in the top 20 — i.e. each below 0.8%:** every query named in F1, F2, F4, F5,
and F8. None of the five hypothesised hot spots is measurable at current volume.

### 3.3 Table size and growth rate (M3, item 18) — **measured 2026-08-19**

| Table | Est. rows | Heap | Indexes | Total | % index |
|---|---|---|---|---|---|
| `cron.job_run_details` | 0 *(never analysed)* | 15 MB | 1,384 kB | **17 MB** | 8 |
| `performance_logs_p20260701` | 57,151 | 10,080 kB | 6,640 kB | 16 MB | 40 |
| `performance_logs_p20260801` | 19,075 | 2,664 kB | 2,632 kB | 5,296 kB | 50 |
| `performance_logs_p20260601` | 8,150 | 1,344 kB | 1,160 kB | 2,504 kB | 46 |
| `outbound_call_logs_p20260701` | 1,941 | 624 kB | 264 kB | 888 kB | 30 |
| `job_runs` | 3,087 | 392 kB | 352 kB | 744 kB | 47 |
| `llm_usage_logs_p20260701` | 268 | 144 kB | 280 kB | 424 kB | 66 |
| `credit_cards` | 255 | 176 kB | 192 kB | 368 kB | 52 |
| `ocr_tasks` | 342 | 128 kB | 160 kB | 288 kB | 56 |
| `ap_invoices` | 41 | 48 kB | 128 kB | 176 kB | 73 |
| `correction_feedback` | 18 | 16 kB | 160 kB | 176 kB | **91** |
| `audit_logs_p20260801` | 33 | 16 kB | 144 kB | 160 kB | **90** |

**The entire database is roughly 50 MB.** Every business table is under 400 kB; the biggest
application table by row count is `performance_logs`, which is the app describing itself.
`credit_cards` holds 255 rows, `ocr_tasks` 342, `ap_invoices` 41. This working set fits in
shared_buffers many times over, which is the answer to the RAM question before item 20 is
even run.

**`performance_logs` growth:** June (half month) 8,150 → July 57,151 (1,843/day) → August
19,075 in 19 days (1,004/day). Traffic roughly halved into August.

**High `% index` on the small tables** (`correction_feedback` 91%, `audit_logs_p20260801`
90%, `ap_invoices` 73%) is the index-bloat pattern F7 predicted — but on tables measured in
kilobytes, so it is a tidiness finding, not a cost one.

### 3.4 `EXPLAIN (ANALYZE, BUFFERS)` — **not run, and why**

The plan called for six `EXPLAIN` passes to confirm F1, F2, F4, F5 and F8 were doing what
their query shapes suggested. §3.2 removed the reason: **none of those queries reaches 0.8%
of a 68-day total that is itself 18.5 minutes.** An `EXPLAIN` would have shown a seq scan
over 255 rows and proved only that the planner is right to take one.

The one thing `EXPLAIN` was uniquely needed for — telling a scan regime from an index regime,
which §5's headroom formula depends on — is answered instead by §3.3: at 84k rows in the
largest partition and 342 in the largest business table, every one of these is scan-bound
today and stays so until the volumes in §5.

Re-run this section when a query in §4 moves from PASS or WATCH to FAIL. It is the right
instrument for that question and the wrong one for "is 342 rows slow".

### 3.5 RAM — **answered by §3.3, not measured separately**

Budgets B5 (cache hit ≥ 99%) and B6 (zero temp spill) exist to detect a working set that has
outgrown memory. §3.3 settles it without a second query: **the entire database is ~50 MB**,
every business table is under 400 kB, and the largest single object is a 17 MB pg_cron log
that this change is about to shrink. There is no `shared_buffers` setting on any Supabase
tier where that fails to be fully cached.

The corroborating evidence is already in §3.2: `/admin/auth/me` completes a JWT decode **and**
a database read in 9 ms end to end, which does not happen against disk.

Run item 20 when §3.3 shows a table entering the hundreds of MB. Measuring cache hit ratio on
a 50 MB database answers a question nobody asked.

### 3.6 Never-used indexes (M4, item 19) — **measured 2026-08-19**

Excludes UNIQUE and PRIMARY. Window: 89 days (table stats reset 2026-05-22), long enough for
`idx_scan = 0` to mean something. **105 indexes have never been scanned.**

Almost all are 16 kB stubs on near-empty tables — real but worth nothing. The bytes are
concentrated in one place:

| Table | Index | `idx_scan` | Size |
|---|---|---|---|
| `performance_logs_p20260701` | `…_tenant_id_created_at_idx` | 0 | 1,728 kB |
| `performance_logs_p20260801` | `…_tenant_id_created_at_idx` | 0 | 792 kB |
| `performance_logs_p20260701` | `…_endpoint_idx` | 0 | 760 kB |
| `performance_logs_p20260801` | `…_endpoint_idx` | 0 | 232 kB |
| `performance_logs_p20260801` | `…_carmen_user_id_idx` | 0 | 216 kB |
| `performance_logs_p20260601` | `…_endpoint_idx` | 0 | 136 kB |
| *(99 more)* | mostly `ix_*_created_at` / `ix_*_deleted_at` | 0 | 16 kB each |

**≈3.8 MB of the 10.4 MB of `performance_logs` index bytes has never been read** — 37% — on
the one table taking 84,000 inserts. That is where F7's cost actually lives; the
`deleted_at` columns predicted from the ORM mixins are all present in the list but weigh
16 kB apiece.

Three entries deserve naming individually:

- **`ix_performance_logs_endpoint` can never be used by the code that motivated it.** The
  `/performance-logs` handler filters with `PerformanceLog.endpoint.contains(endpoint)`
  ([`monitoring.py:178`](../backend/app/routers/admin/monitoring.py)), which compiles to
  `LIKE '%x%'` — a leading wildcard, which a btree cannot serve. `idx_scan = 0` is not a
  volume artefact here; it is arithmetic. Safe to drop on evidence *and* on reasoning.
- **`ix_ocr_tasks_created_module_tenant_active` — the index added by the July scalability
  pass (`20260708170000`) to fix admin analytics — has never been scanned.** At 342 rows the
  planner takes a seq scan every time. Keep it (it is correctly shaped for volume that has
  not arrived), but record it: that pass was as speculative as this audit's own hypotheses.
- **Every index on `daily_usage_summary` and `daily_model_cost` is unused**, corroborating F4
  from a second direction: the rollups are written nightly and effectively not read.
  `quotas` / `quota_usage` indexes are likewise cold — those tables are already retired and
  scheduled for drop.

### 3.6b Cron reality vs. the repo (item 22b) — **measured 2026-08-19**

Production runs **14** cron jobs. Two of them disagree with the repo — in opposite
directions.

| Job | Schedule | In repo | In prod | 24 h ok / failed |
|---|---|---|---|---|
| `probe` | `* * * * *` — runs `select 1` | **no** — appears in no migration | **yes** | 1,440 / 0 |
| `carmen-webhook-push` | `* * * * *` | **yes** — still scheduled by `20260811000000` | **no** — unscheduled by hand on 08-17 | — |
| `cancel-expired-orders` | `7 * * * *` | scheduled then unscheduled by `20260701071021` | no | — *(correctly retired, not drift)* |
| `email-confirm` | `* * * * *` | yes | yes | 1,440 / 0 |
| `email-ingest` | `*/10 * * * *` | yes | yes | 144 / 0 |
| `keep-warm` | `*/10 * * * *` | yes | yes | 144 / 0 |
| `hold-expired-orders` | `7 * * * *` | yes | yes | 24 / 0 |
| `session-purge` | `0 * * * *` | yes | yes | 24 / 0 |
| `pricing-sync` | `0 */8 * * *` | yes | yes | 3 / 0 |
| `daily-summary` / `daily-model-cost` / `anomaly-detection` / `anomaly-alerts-purge` / `partman-maintain` / `lapse-subscriptions` | nightly | yes | yes | 1 / 0 each |
| `monthly-summary` | `32 1 1 * *` | yes | yes | 0 / 0 (monthly — correct) |

Zero failures across every job in 24 h.

### 3.6c The F3 404 storm — measured, and already over (item 22)

| Day | Endpoint | Status | Hits |
|---|---|---|---|
| 2026-08-11 | `/api/v1/admin/webhooks/push` | 404 | 1,232 |
| 2026-08-12 | " | 404 | 1,440 |
| 2026-08-13 | " | 404 | 1,439 |
| 2026-08-14 | " | 404 | 1,440 |
| 2026-08-15 | " | 404 | 1,440 |
| 2026-08-16 | " | 404 | 1,440 |
| 2026-08-17 | " | 404 | 389 *(stops ~06:30)* |
| 2026-08-18 → 19 | " | — | **0** |
| 2026-08-17 | `/api/v1/carmen/email-ingest/confirmations` | 404 | 73 *(cron scheduled ahead of the deploy)* |
| 2026-08-07 / 08-10 | `/api/v1/carmen/settings` | 401 / 422 / 429 | 84–87 / 21–56 / 21 |

Exactly 1,440 per day — one per minute, as predicted — for six days, ≈8,860 junk rows in
`performance_logs`. It stopped because someone unscheduled the job in production on 08-17,
which is why `carmen-webhook-push` is absent from §3.6b.

### 3.7 Seq-scan ratio and bloat (M6 / M9) — **not run, and why**

Item 21 filters to tables over 10,000 rows, because below that a seq scan is usually the
*correct* plan and flagging one is noise. §3.3 shows only the `performance_logs` partitions
clear that bar — and its two candidate indexes are exactly what §3.6 already examined by a
sharper route (`idx_scan = 0` over 89 days, plus the leading-wildcard argument that no
scan-ratio statistic could have produced).

Item 24 (dead tuples, autovacuum lag) targets bloat making scans quietly more expensive over
time. At these table sizes a fully bloated table still fits in memory several times over.

Both belong in the next reading, when §3.3's numbers are an order of magnitude larger.

---

## 4. Findings

Ordered by **measured** CPU share once §3 is filled — not by the hypothesis ranking below.
A finding that measures clean keeps its row with a `PASS` verdict; deleting it would leave a
report that only ever agrees with itself.

Verdicts: **PASS** in budget and ≥ 12 months headroom · **WATCH** in budget but < 12 months
· **FAIL** over budget.

### F1 — Two admin endpoints list partitioned log tables with no date filter

**Hypothesis.** `/llm-usage` ([`routers/admin/usage.py:79-94`](../backend/app/routers/admin/usage.py))
and `/performance-logs` ([`routers/admin/monitoring.py:159-186`](../backend/app/routers/admin/monitoring.py))
default `from`/`to` to `None`, and neither frontend page sends them
([`LLMLogsPage.tsx:77`](../frontend/src/pages/admin/LLMLogsPage.tsx),
[`PerformancePage.tsx:82`](../frontend/src/pages/admin/PerformancePage.tsx)). With no
predicate on the partition key there is no pruning; and because every index on both tables
leads with `tenant_id` rather than `created_at`
(`20260615000001_partition_log_tables.sql:46-51`, `:129-131`), there is no ordered path for
`MergeAppend` to stop early either — so `ORDER BY created_at DESC LIMIT N` should degrade to
scan-all-partitions-then-sort. `/llm-usage` additionally offers `order_by` of `cost_usd`,
`duration_ms`, and `total_tokens`, none of which are indexed at all.

**Measured.** Below 0.8% of DB CPU — absent from the §3.2 top 20. `/performance-logs` p50 is 1,192 ms, but §3.1b attributes at most 3% of that to SQL. · **Verdict.** ⚠️ **WATCH** — the shape is exactly as described and costs nothing at 84k rows. · **Headroom.** ~1.5M rows ≈ **18× today's data** (§5).

**Fix if FAIL.** Default the window server-side (30 days for `/llm-usage`, 7 for
`/performance-logs`), matching what `/user-usage` already does at
[`usage.py:189-192`](../backend/app/routers/admin/usage.py). That restores pruning without
adding a write-path index. Only if the sort itself is still the cost, add
`create index … on performance_logs (created_at desc)` on the partitioned parent — it
propagates to all partitions and turns the scan into an early-stopping `MergeAppend`.

### F2 — `last_used_q` runs outside the gate meant to contain it

**Hypothesis.** [`routers/admin/tenants.py:90-102`](../backend/app/routers/admin/tenants.py)
runs `SELECT tenant_id, max(created_at) … GROUP BY tenant_id` against `llm_usage_logs` with
no time bound. Postgres has no per-group index skip-scan, so this walks each tenant's index
range across every partition. The comment at `:57-61` explains that `include_engagement` is
off by default precisely because `TenantSelector` calls this endpoint from five other admin
pages just to populate a `<select>` — but this query, the most expensive one in the handler,
sits outside that gate. CLAUDE.md also records that the Tenants page renders a task-derived
`last_use` instead, so the value may be unused.

**Measured.** Below 0.8% — absent from the top 20. `llm_usage_logs` holds 268 rows in its largest partition, so the unbounded `max()` per group walks almost nothing. · **Verdict.** ✅ **PASS** — hypothesis was right about the shape, wrong about the cost. · **Headroom.** not the binding constraint at any volume §5 projects.

**Fix if FAIL.** Move it inside `if include_engagement:` and add a 90-day floor so the
partition prune applies. Two lines.

### F3 — A per-minute cron fires at a route that does not exist

**Hypothesis.** `20260811000000_carmen_notify_webhook.sql:48` schedules `carmen-webhook-push`
at `* * * * *` posting to `/api/v1/admin/webhooks/push`. Grepping `backend/app` and
`frontend/src` for `webhooks/push`, `webhook_unread`, and an `#/admin/webhooks` route returns
zero hits — the handler exists only on an unmerged branch; the migration was restored to
unblock `supabase db push` (commit `e72558b`). Expected cost: 1,440 pg_net round-trips,
1,440 404s, and 1,440 junk `performance_logs` rows per day — the last of which inflates every
other query in this audit.

**Measured.** Exactly **1,440 404s/day for six days** (§3.6c), and `carmen-webhook-push` is absent from production's cron list while still scheduled in the repo (§3.6b). · **Verdict.** ❌ **FAIL** — confirmed in both halves: the storm happened, and the repo can still restart it.

**Fix.** `select cron.unschedule('carmen-webhook-push') …` in a new migration, with a comment
to re-schedule when the webhook branch merges. Leave the table and the `tenants.webhook_*`
columns in place; they cost nothing.

### F4 — The nightly rollup is built but not read

**Hypothesis.** `daily_usage_summary`, `daily_model_cost`, and `monthly_usage_summary` are
populated by three cron jobs, but the only reader is `anomaly_service`. The admin Usage and
Overview pages re-aggregate raw `llm_usage_logs` and `ocr_tasks` on every load
([`usage_analytics_service.py:31-133`](../backend/app/services/usage_analytics_service.py) —
four queries, grouping on `cast(created_at as date)`, which no index can serve). A 92-day
range cap bounds it today.

**Measured.** Below 0.8%, and §3.6 corroborates from the other side — **every index on `daily_usage_summary` and `daily_model_cost` has `idx_scan = 0`.** · **Verdict.** ✅ **PASS** — real waste (three nightly jobs feeding one reader), no measurable cost. · **Headroom.** the 92-day range cap keeps the raw path bounded.

**Fix if FAIL.** Point the page at the rollup. Deliberately *not* the first move: it changes
semantics, since today's data is incomplete until the 01:17 UTC job runs. This is the
upgrade path that already exists, to be spent when the raw query stops being affordable.

### F5 — `get_tenant_engagement_map` reads a tenant's entire history

**Hypothesis.** [`usage_analytics_service.py:573-646`](../backend/app/services/usage_analytics_service.py)
aggregates `ocr_tasks` with no time bound, on a table that is never purged (five-year
retention). `ix_ocr_tasks_created_module_tenant_active` leads with `created_at`, so this
query cannot use it and falls back to `ix_ocr_tasks_tenant_id`. Metrics like `active_weeks`
and `first_use` genuinely need full history — so this is a growing cost, not a bug.

**Measured.** Below 0.8%. `ocr_tasks` holds **342 rows**, so "a tenant's entire history" is a few dozen rows. · **Verdict.** ✅ **PASS**. · **Headroom.** ~1M rows (§5) — the cost grows forever because the table is never purged, just from a very low base.

**Fix if FAIL.** Cache the map rather than restrict it; the metric's definition requires the
full range.

### F6 — `/usage-summary/totals` never checks its date range — **CONFIRMED, no measurement needed**

`_assert_date_range()` caps `/usage-summary` at 92 days
([`usage.py:56`](../backend/app/routers/admin/usage.py)) but its sibling `/totals` at
`:62-76` never calls it. `?from=2020-01-01` is accepted, no partition is pruned, and four
aggregates run across the full retention window. A logic bug, visible in the source; the
measurement pack cannot make it more or less true.

**Fix.** One line: call `_assert_date_range(from_date, to_date)` in the `/totals` handler.

### F7 — Indexes the planner has no reason to use

**Hypothesis.** `SoftDeleteMixin` sets `index=True` on `deleted_at` and `WriterMixin` on
`created_by` for every business table
([`models/mixins.py:21-31`](../backend/app/models/mixins.py) →
`supabase/schemas/50_business.sql:55,85,116`). `deleted_at` is only ever queried as
`IS NULL`, which matches ~100% of rows, so the planner should always prefer a scan. That
leaves `credit_cards` carrying 11 indexes and `ap_invoices` 7 on tables written once per
document.

**Measured.** **105 indexes with `idx_scan = 0` over an 89-day window.** The predicted `deleted_at` / `created_by` stubs are all present — at 16 kB each. The bytes are on `performance_logs`: 3.8 MB of 10.4 MB never read (§3.6). · **Verdict.** ❌ **FAIL**, but relocated — right conclusion, wrong table.

**Fix if FAIL.** Drop **only** the indexes item 19 reports with `idx_scan = 0`, and update
`mixins.py` in the same change so the ORM stops disagreeing with the database. Never drop
anything not on that list.

### F8 — `submitted_at` is unindexed

**Hypothesis.** `get_usage_summary` and `get_usage_totals` filter
`submitted_at BETWEEN …` on `credit_cards` and `ap_invoices`
([`usage_analytics_service.py:98-119`](../backend/app/services/usage_analytics_service.py)),
but neither column is indexed — `uq_credit_cards_submitted_doc` is
`(tenant_id, bank_code, doc_no)` and does not serve a range on `submitted_at`. Both tables
are small enough today that a seq scan is likely the correct plan.

**Measured.** Below 0.8%. `credit_cards` holds 255 rows and `ap_invoices` 41, where a seq scan is the correct plan. · **Verdict.** ✅ **PASS**. · **Headroom.** ~100k rows.

**Fix if FAIL.** One index per table, when M3 shows either passing roughly 100k rows.

### F9 — Nothing measures SQL

**Hypothesis.** `pg_stat_statements` appears nowhere in the repo and is not declared in
`supabase/schemas/00_extensions.sql` (Supabase enables it by default — item 15 confirms).
What exists is `performance_logs`, which measures **HTTP latency**: when an admin page takes
eight seconds it says the endpoint was slow, never which query spent the time. That gap is
why this document's conclusions could not be reached by reading code alone.

**Measured.** `pg_stat_statements` was installed the whole time with a **68-day window** and 3,287 tracked statements — nobody had ever read it. · **Verdict.** ✅ **RESOLVED** — this report is the first use of it, and every number above came from data that already existed.

**Fix.** Items 15–24 of `backend/db/queries.sql` are the fix — a repeatable pack, not a
dashboard. Re-run them next quarter and diff.

---

### The three findings nobody hypothesised

F1–F9 came from reading code, and the four that mattered least were the ones ranked highest.
These three came from the measurements themselves and were not on anyone's list — which is
the argument for running the pack rather than reasoning about the schema.

### N1 — `cron.job_run_details` is the largest object in the database and has no retention

**Measured.** **17 MB**, larger than every business table combined, on an instance whose
biggest business table holds 342 rows (§3.3). `n_live_tup = 0` — autoanalyze has never run
on it, so the planner has no statistics for it at all. 62,102 inserts over the 68-day window,
and with two per-minute jobs now scheduled it accrues ~2,880 rows/day. **27,290 rows already
sit outside a 14-day window** (§6.0). · **Verdict.** ❌ **FAIL** — the only finding in this
report with an unbounded growth curve. · **Headroom.** none; it only grows.

pg_cron does not purge its own history and nothing else was going to. Missed by code review
for the obvious reason: it is not our table and appears in no migration, no model, and no
query in the repo.

**Fix.** `fn_purge_cron_history()` + a `cron-history-purge` job at 03:40 UTC, 14-day window.
Chosen over 7 because `admin/email_ingest.py::_cron_health` reads this table — though only
for `max(start_time)` and the newest status, so any window longer than a job's period is
safe, and every `email-*` job fires at least every 10 minutes.

### N2 — the perf-log buffer batches transactions, not statements

**Measured.** **84,355 INSERT statements for 84,376 rows** (§3.2 and §3.3 cross-check to
within 21 rows, the ones still in the buffer). `db.add_all()` emits one statement per row, so
a 500-row flush is 500 round trips inside a single commit — 8.2% of DB CPU, the largest
application-owned share in the report. · **Verdict.** ⚠️ **WATCH** — high share, trivial
absolute: 90.6 s over 68 days is **~1.3 s/day**. · **Headroom.** scales with request volume,
not with stored data.

`middleware/performance.py` claimed this path was "O(1) batch per 10s". True of transactions,
false of statements. **The comment has been corrected; the code has not been changed.**

What is *not* settled is the Python side: building and compiling 500 statements is CPU that
blocks the event loop on 0.1 vCPU, which fits the `max_ms` outliers in §3.1 (29,006 ms on
`/notifications`). That makes collapsing the flush into one multi-row INSERT the first thing
to try **if** the §3.1e investigation is picked up — and something to measure before and
after, rather than to assume.

### N4 — a cron job in production that exists in no migration

**Measured.** `probe`, `* * * * *`, command `select 1`, owner `postgres`, 1,440 successful
runs in 24 h (§3.6b). `grep -rni probe supabase/` returns nothing. · **Verdict.** ❌ **FAIL**
— drift, not cost.

Almost certainly left behind by the SQL-Editor workaround for forcing a pg_cron launcher
reload, which is a documented recurring trap on this project. It burns no measurable CPU and
writes 1,440 rows/day into N1 — **half that table's growth** — which is what lets N1's
retention window be as short as it is.

**Fix.** `cron.unschedule('probe')`, in the same migration.

---

## 5. Capacity — how much room is left

Headroom is the number that turns "this looks risky" into a date.

```text
headroom_months = (30,000 ms ÷ current mean_exec_time − 1) ÷ monthly growth rate
```

**Stated assumption:** full-scan queries cost *linearly* in row count. True for a seq scan
plus sort; **false** the moment the planner switches to an index. §3.4 explains why the regime
is known here without an `EXPLAIN` pass — at these volumes everything is scan-bound. Any
headroom figure quoted without this caveat is not a measurement.

30,000 ms is the hard ceiling: the `statement_timeout` set on every pool checkout
(`database.py:98-110`). Past it the query does not get slow, it fails.

| Query | Today | Growth | Breaches its 1,500 ms budget | Breaches 30 s |
|---|---|---|---|---|
| F1 — `/performance-logs` unbounded `ORDER BY … LIMIT 300` | 84,376 rows; p50 1,192 ms, mostly not SQL (§3.1b) | ~30–57k rows/month, and falling | **~1.5M rows ≈ 18× today** | ~30M rows ≈ 350× |
| F5 — `get_tenant_engagement_map`, no time bound | `ocr_tasks` 342 rows, never purged (5-yr retention) | tracks documents scanned | ~1M rows | not reachable this decade |
| F8 — `submitted_at` seq scan | `credit_cards` 255, `ap_invoices` 41 | tracks documents posted | ~100k rows | not reachable |

**Read the fourth column as a multiplier, not a date.** At today's ~1,000 requests/day F1 is
~35 months away; at 10× adoption it is ~3.5 months. Every row here is a function of how many
business units are onboarded, not of the calendar. That is the number to watch, and
`queries.sql` item 18 is how to watch it.

---

## 6. Fixes

Every ❌ from the TL;DR, and nothing else. Note what is *absent*: no query was rewritten, no
index was added, no endpoint was re-tuned — because no query measured slow. This is a
housekeeping list, which is the correct outcome for a database running at 0.019% duty cycle.

Each row records the before/after of **the same metric** that condemned it. A fix that cannot
show its number in the column that justified it does not belong here.

All four DB changes ship in one migration,
`supabase/migrations/20260819000000_audit_cleanup.sql`.

| # | Change | Metric | Before | After (verify post-push) |
|---|---|---|---|---|
| N1 | `fn_purge_cron_history()` + `cron-history-purge` daily at 03:40 UTC — 14-day retention | table size | 17 MB, ~2,880 rows/day | ≪ 17 MB after first run |
| F3 | `cron.unschedule('carmen-webhook-push')` in a migration | repo/prod drift | scheduled in repo, absent in prod | absent in both |
| N4 | `cron.unschedule('probe')` | runs/day | 1,440 × `select 1` | 0 |
| F7 | `drop index ix_performance_logs_endpoint` (parent — cascades to partitions) | index bytes never read | 1,128 kB across 3 partitions | index gone |
| F6 | `_assert_date_range()` in the `/usage-summary/totals` handler | *(logic)* | unbounded range accepted | `400` on a >92-day range |
| N2 | Comment corrected in `middleware/performance.py` — no code change | *(accuracy)* | claimed `O(1)` writes | states O(1) *transactions*, O(n) statements |

**F6 arrived with the test the cap never had.** `_assert_date_range` was untested on
*either* endpoint; `test_A2_rejects_date_range_over_92_days` in
`backend/tests/unit/test_admin_usage.py` was confirmed to fail with the guard removed and
pass with it restored, so it is checking the fix rather than the mock.

### 6.0 Pre-push safety checks — **run 2026-08-19, all clear**

Three read-only checks stood between the migration and production. Each one guards a way the
migration could have been silently wrong rather than loudly broken.

| Check | Result | What it rules out |
|---|---|---|
| pg_partman template indexes on `performance_logs` | **no rows** | Dropping the parent index is sufficient — partman holds no template index that would hand `endpoint` back to every new monthly partition. |
| `cron.job_run_details` rows older than 14 days | **27,290** | The table is reachable by the migration role, and this is N1's "before" number: the first 03:40 run has 27,290 rows to reclaim. |
| `ix_performance_logs_endpoint` parent check | `indrelid = performance_logs` | It is an index on the partitioned parent, so `drop index` cascades to every partition instead of leaving orphans behind. |

### 6.1 Why these four DB changes and not others

- **N1 is the only one with a growth curve.** `cron.job_run_details` is already the largest
  object in the database and pg_cron does not purge it. Nothing else on this list gets worse
  with time.
- **F3 is fixed in production but not in the repo** — the job was unscheduled by hand on
  2026-08-17, while `20260811000000_carmen_notify_webhook.sql` still schedules it. Any
  `db reset`, or a fresh environment, resurrects the 404 storm. The migration is the fix;
  production needs no action.
- **N4 costs nothing in CPU** (`select 1`) and everything in bookkeeping: it is half of N1's
  row growth, and it is a cron in production that no migration explains.
- **F7 is narrowed to one index on purpose.** `ix_performance_logs_endpoint` is safe to drop
  on *reasoning*, not just on `idx_scan = 0`: the only handler that filters on that column
  uses `.contains()` → `LIKE '%x%'`, which no btree can serve. The larger
  `(tenant_id, created_at)` indexes are also cold, but the Performance page does have a
  tenant selector, so cold-for-89-days is weaker evidence there. **Left in place.** The
  16 kB `deleted_at` / `created_by` stubs are left too — 105 of them are worth ~1.7 MB
  combined, and each drop is a migration line plus an ORM change for no measurable return.

### 6.2 Deliberately not done

- **F1's date-range default.** It measures WATCH, not FAIL. Revisit when `performance_logs`
  passes ~1.5M rows (§5), not on a date.
- **N2's multi-row INSERT.** 8.2% of CPU share, 1.3 s/day in absolute terms. The
  `middleware/performance.py` comment claiming O(1) batching is accurate about transactions
  and optimistic about statements; the honest fix is to correct the comment, not the code.
- **Replacing the per-checkout `SET statement_timeout`.** `DISCARD ALL` appearing 4,526 times
  in §3.2 confirms empirically what `database.py` documents — Supavisor resets session GUCs.
  It also implies `ALTER ROLE … SET statement_timeout` *would* survive, since `DISCARD ALL`
  resets to session-start values including role defaults. Worth a ten-minute test someday;
  the `SET` does not appear in the top 20, so there is nothing to win today.

---

## Appendix — reproducing this report

1. Open the Supabase SQL Editor for the production project. **Not** psql, and **not** an
   ad-hoc Python script while `uvicorn` is running: Supavisor caps this project at 15 server
   connections and the app pool reserves 10 — the documented `EMAXCONNSESSION` failure mode
   ([LOAD_TEST_REPORT_V2.md](LOAD_TEST_REPORT_V2.md) §6.1).
2. Run [`backend/db/queries.sql`](../backend/db/queries.sql) item **15** first. If
   `ext_installed = 0`, enable `pg_stat_statements` and wait one full working day before
   continuing — items 17 and 20 read counters that start empty.
3. Run items **16–24**, one at a time, pasting each result into the matching §3 table.
4. Run item **23** during peak hours. Off-peak it shows an idle pool and proves nothing.
5. `EXPLAIN (ANALYZE, BUFFERS)` the six queries in §3.4 by hand.
6. Fill §4's *Measured* / *Verdict* / *Headroom*, then §5, then the TL;DR — in that order.
   Writing the TL;DR first is how a report ends up arguing for a conclusion it reached before
   measuring.

Every statement in the pack is read-only. Keep it that way: `pg_stat_statements_reset()`
would destroy the baseline the next audit needs to compare against.
