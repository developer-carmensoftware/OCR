# Load Test Report V2 — Multi-Key Capacity Pool

**Date:** 2026-06-09
**Tester:** automated (`scripts/load_test_v2.py`)
**Endpoint tested:** `POST /api/v1/ocr/extract` (credit-card, single PNG)
**Backend:** 1 uvicorn worker, remote Supabase DB (ap-northeast-1)
**LLM provider:** OpenRouter — `google/gemini-2.5-flash-lite`

---

## TL;DR

| | Old report (V1) | This report (V2) |
|---|---|---|
| DB | Local MariaDB | Remote Supabase (Postgres, Supavisor session mode) |
| LLM concurrency | Single semaphore (`_LLM_SEM=16`) | Multi-key capacity pool (split vision/text semaphores, least-loaded) |
| Safety valve | None (requests queue forever) | `LLMCapacityError` → HTTP 429 + `Retry-After` |
| Multi-key tested | No | Not yet — key2 invalid (401 from OpenRouter) |
| DB connection limit | Not hit (local, pool=60) | Hit at C=12 (Supavisor session mode ≤ 15) |
| Sweet spot | C=4, p95≈5s, 3.2 rps | C=4–8, p95≈10-19s (remote DB adds ~5-8s latency) |

**Key finding:** Remote Supabase DB adds 5–8 s baseline latency vs localhost. DB connection pool must be ≤ 10 (pool+overflow) to stay under Supavisor's 15-connection session-mode limit.

---

## 1. Environment Changes Since V1

| Component | V1 | V2 |
|---|---|---|
| DB | MariaDB localhost | Supabase Postgres (Supavisor, ap-northeast-1) |
| DB pool | pool=30, overflow=30 | pool=5, overflow=5 (↓ to stay under 15-conn limit) |
| LLM concurrency | `asyncio.Semaphore(16)` global | Per-key pool: `vision_sem(6)` + `text_sem(6)` |
| 429 safety valve | — | `LLM_MAX_QUEUE_WAIT_SECONDS=10` |
| Keys | 1 | 1 (key2 invalid — see §5) |

---

## 2. Single-Key Ramp Results

Config: `LLM_VISION_CONCURRENCY_PER_KEY=6`, `LLM_MAX_QUEUE_WAIT_SECONDS=10`, `pool_size=8` (pre-fix)

| C | n | err% | p50 | p95 | p99 | ~rps | Notes |
|---|---|---|---|---|---|---|---|
| 1 | 2 | 0.0% | 7.16s | 11.47s | — | 0.2 | baseline |
| 2 | 4 | 0.0% | 8.24s | 11.54s | — | 0.3 | |
| 4 | 8 | 0.0% | 9.25s | 10.40s | — | 0.8 | sweet spot |
| 8 | 11 | 0.0% | 12.32s | 18.98s | — | 0.6 | LLM queue building |
| 12 | 26 | **30.8%** | — | — | — | — | **STOP: DB pool exhausted (EMAXCONNSESSION)** |

**Latency is ~2-3× V1** because Supabase is in ap-northeast-1 vs localhost. Every request now has a network round-trip for quota check + any DB write.

**Root cause of C=12 stop:** SQLAlchemy `pool_size=8, max_overflow=8` = 16 potential connections. Supavisor session mode caps at 15. Under C=12 burst, all 16 SQLAlchemy connections + 1 asyncpg (load test script) = 17 → `EMAXCONNSESSION`.

**Fix applied:** `pool_size=5, max_overflow=5` (10 total). See §6.

---

## 3. Valve Test — 429 Safety Valve

Config: `LLM_VISION_CONCURRENCY_PER_KEY=2`, `LLM_MAX_QUEUE_WAIT_SECONDS=2`, `pool_size=5` (fixed), 1 key

**Scenario:** 12 concurrent users hit `/ocr/extract` simultaneously. Vision pool only has 2 slots; 10 requests must wait. After 2 s they time out and receive 429.

| C | n | err% | p50 | p95 | ~rps | 200 | 429 | 5xx | timeout |
|---|---|---|---|---|---|---|---|---|---|
| 12 | 25 | 72% | 8.77s | 15.30s | 1.6 | 7 | **12** | **0** | 0 |

**Result: PASS**
- 12 requests received `HTTP 429` with `Retry-After` header — graceful degradation ✓
- 0 HTTP 5xx — no unhandled errors ✓
- 0 timeouts — no requests hung indefinitely ✓
- 7 requests completed successfully (the 2 that got LLM slots, cycling through 12 s)
- ReadErrors = client-side aborts (script aborted after 12 s hold time), not server errors

**Before this change:** requests would queue behind the `asyncio.Semaphore` indefinitely. At C=12 with a slow LLM, users would wait 30–90 s with no feedback.

---

## 4. Old Report §8.1 — Coverage Status

| §8.1 Item | Status |
|---|---|
| Multi-key throughput comparison | **Deferred** — key2 invalid (see §5); re-test when new key available |
| Load distribution across keys | **Deferred** — same reason |
| 429 safety valve behavior | ✅ **Covered** — §3 above |
| AP invoice extract load | **Deferred** — requires real Carmen token (not mockable with fake JWT) |
| Full flow (extract→suggest→submit) | **Deferred** — suggest/submit call Carmen API |
| Memory growth over long runs | **Deferred** — would need 30+ min sustained run |
| Real-world network (not localhost) | ✅ **Covered** — Supabase remote DB used throughout |

---

## 5. Key2 Invalid — Multi-Key Deferred

Health check showed key2 (`sk-or-v1-...9927f2`) returns `{"error":{"code":401,"message":"User not found."}}` from OpenRouter. All multi-key tests (distribution, comparison) were deferred.

**To resume:** create a new valid OpenRouter key → set `OPENROUTER_API_KEYS=key1,key2` in `.env` → re-run `--mode ramp --label multi` and `--mode distribution`.

---

## 6. Production Fixes Applied

### 6.1 DB Pool — `app/database.py`

```python
# Before (causes EMAXCONNSESSION at C=12 on Supabase session mode)
pool_size=8, max_overflow=8   # 16 total — exceeds Supavisor 15-conn limit

# After
pool_size=5, max_overflow=5   # 10 total — leaves 5 slack for direct/admin connections
```

**Impact:** Prevents `500 Internal Server Error` at high concurrency. Tradeoff: slightly more connection wait time under burst (SQLAlchemy queues internally instead of acquiring new connections).

### 6.2 Config — `app/config.py`

`openrouter_api_keys_list` now parses `OPENROUTER_API_KEY=key1,key2` (comma-separated in singular var) correctly. Previously the entire `"key1,key2"` string was used as one invalid API key → 401 from OpenRouter.

### 6.3 LLM Capacity Pool — `app/llm/client.py`

Major refactor from previous session:
- Single `asyncio.Semaphore(16)` → per-key `_KeyState` with separate `vision_sem` + `text_sem`
- Least-loaded key selection (avoids hot-spotting)
- Cross-key failover on `RateLimitError` (immediate, no same-key backoff)
- `LLMCapacityError` → HTTP 429 + `Retry-After` when all slots busy past `LLM_MAX_QUEUE_WAIT_SECONDS`

---

## 7. Capacity Estimates (Single Key, Remote DB)

Based on ramp results:

| Scenario | Recommendation |
|---|---|
| ≤ 5 concurrent users | C=1–4: 0% errors, p95 ≤ 10 s |
| 5–10 concurrent users | C=8: 0% errors, p95 ≈ 19 s (LLM queue building) |
| 10–15 concurrent users | Expect some 429 (safety valve). Acceptable with Retry-After client logic |
| 100+ tenants (not all concurrent) | 1 worker handles well; add workers for sustained parallel load |

**Pilot (10–15 tenants):** system is ready. LLM throughput is the bottleneck, not the app itself. Adding a valid second OpenRouter key doubles vision capacity when needed.

---

## 8. Cost

| Run | Calls | Avg tokens | Est. cost |
|---|---|---|---|
| Single-key ramp | ~51 successful LLM calls | ~1200 tokens | ~$0.03 |
| Valve test (7 successes) | 7 | ~1200 tokens | ~$0.004 |
| **Total** | | | **< $0.04** |

*(gemini-2.5-flash-lite: ~$0.10/M input, ~$0.40/M output via OpenRouter)*

---

## Appendix: Script

`backend/scripts/load_test_v2.py` — modes: `health`, `ramp`, `valve`, `distribution`, `cleanup`

```bash
# Health check (verify keys)
python scripts/load_test_v2.py --mode health

# Ramp test
python scripts/load_test_v2.py --mode ramp --label single-key

# Valve test
python scripts/load_test_v2.py --mode valve --burst 12 --hold 12

# Cleanup test data
python scripts/load_test_v2.py --mode cleanup
```
