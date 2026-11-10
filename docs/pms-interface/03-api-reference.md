# API Reference

The hook's contract for Carmen (body rules, what we accept and refuse, a curl checklist) is
[`../PMS_INTEGRATION.md`](../PMS_INTEGRATION.md). This page covers every route on our side, and
every Carmen route we call.

## Endpoints

### `/api/v1/pms` — `backend/app/routers/pms.py`

| Method | Path | Auth | Purpose | Success |
|---|---|---|---|---|
| `POST` | `/events` | **API key** (`pms:events`) of that BU and PMS | Carmen's hook: one row per BU × day, then `kick` | `202` new · `200` repeat · `403` another PMS's key |
| `POST` | `/process/run` | **internal job token** or an admin JWT with `configs:write` (`require_maintenance_auth`) | The retry sweep; pg_cron every 10 min | `200` summary |
| `GET` | `/days/{day_id}` | session JWT | One parked day, as the review modal reads it | `200` `PmsDayOut` |
| `POST` | `/days/{day_id}/approve` | session JWT | Write the new rows' accounts into Carmen, then have Carmen post | `200` `PmsApproveOut` |
| `POST` | `/days/{day_id}/reject` | session JWT | Retire the day without a JV | `204` |

Every session route sees only the session's tenant. For a day of another BU, the answer is the
same `404` as for one that does not exist.

### `/api/v1/carmen/pms` — `backend/app/routers/pms_carmen.py` (decision-log #44)

Carmen's PMS setting screen, one per BU and PMS. The contract for Carmen is
[`PMS_INTEGRATION.md` §6](../PMS_INTEGRATION.md#6-settings-api--your-pms-setting-screen).

| Method | Path | Body / query | Purpose | Success |
|---|---|---|---|---|
| `GET` | `/settings` | `?uri&bu&pms` | This PMS's settings. A BU that never opened the app reads the defaults; nothing is created | `200` |
| `PUT` | `/settings` | `{uri, bu, pms, auto_post}` | Replace this PMS's auto-post switch | `200` |
| `POST` | `/keys` | `{uri, bu, pms}` | A new hook key; the previous one is revoked. **`api_key` is in this response only** | `201` |
| `DELETE` | `/keys` | `?uri&bu&pms` | Revoke this PMS's live key (the off switch) | `204` · `404` none |

All four answer `{pms, auto_post, key: {prefix, created_at, last_used_at} | null, has_credential}`
(`PmsCarmenSettingsOut`), except `DELETE`. `pms` is lower-cased on the way in.

- **Auth** is the email Settings API's `_caller`: `Authorization: <Carmen token>` (no scheme),
  proven against `uri` by `_resolve`, or `Bearer <admin JWT>` with `configs:write`. The same
  rate limits apply (20/min per IP, 300/min overall, before any outbound call).
- **`_resolve(create=True)`** on PUT and POST: a (host, bu) with no tenant is created by
  `auth.ensure_tenant` after `validate_uri` + `validate_token`, with the signup credits.
  Never on the admin path, and never on DELETE.
- **`_resolve_for_read`** on GET: an unknown (host, bu) on the Carmen path is proven with
  `validate_uri` + `validate_token` and answers
  `{pms, auto_post: false, key: null, has_credential: false}`. Nothing is written.
- **Every Carmen write** (PUT, POST) runs `credential.adopt_token` with the caller's token (kept
  out if the BU's held credential still works, #45), then
  `process.wake_waiting` and `kick` for each day it wakes. The admin path stores nothing.

### Elsewhere

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/credit-card/activity` | session JWT | The queue. PMS days come as rows with `source: "pms"` (`activity._pms_row`) |
| `GET` · `DELETE` | `/api/v1/admin/api-keys[/{key_id}]` | admin JWT, `api_keys` read / revoke | Support's view: every BU's keys and their PMS, revoke. No issuing (#44) |

## Auth model

| Caller | Credential | Resolves to |
|---|---|---|
| Carmen's hook | `Authorization: Bearer cpk_…`. `bearer` in any case, or the bare key | `sha256(key)` → a live `api_keys` row with scope `pms:events`, on a live, active tenant → `tenant_id`. Any miss is `401 Invalid API key`, which never says which check failed. Stamps `last_used_at` and `last_used_ip`. Then the body's `InterfaceName`, lower-cased, must equal the key's `interface_name`: else `403` |
| Carmen's PMS setting screen | `Authorization: <Carmen token>` + `uri`, `bu`, `pms` | the (host, bu) tenant, after the token is proven against `uri`; created if missing |
| pg_cron | `Bearer <INTERNAL_JOB_TOKEN>` | machine; constant-time compare |
| The BU's user (review) | our session JWT from `/auth/exchange` | `session.tenant_id`; `carmen_user_id` is recorded as `reviewed_by` |
| **We → Carmen** | the BU's stored menu token, as a raw `Authorization` header | Carmen's `/api/interface/*` only |

`_pms_key` also sets `request.state.tenant_id`. `PerformanceMiddleware` decodes only our JWTs,
so without it a hook's `performance_logs` row would have no tenant.

## `POST /events`

The body rules are in [`PMS_INTEGRATION.md` §3](../PMS_INTEGRATION.md#3-request-body). Order of
checks:

1. **The key**, before the body is read (`401`). The body is read inside the handler, not
   through a Pydantic parameter, because FastAPI reads those before any dependency runs.
2. **Body size ≤ 16 KB** (`413`).
3. **A leading UTF-8 BOM is stripped**, and then `PmsEventIn` runs (`422`, naming the field).
4. **The PMS**: `InterfaceName`, lower-cased, must be the key's `interface_name` (`403`,
   naming the key's PMS). Nothing is stored.
5. **Insert, or touch the existing row.**

| Status | Body |
|---|---|
| `202` | `{"id": "<uuid>", "duplicate": false}` |
| `200` | `{"id": "<same uuid>", "duplicate": true}`. When the day is not posted and no reviewer holds it, it is also reset to `received` and processed again |
| `401` | `{"detail": "Invalid API key"}` + `WWW-Authenticate: Bearer` |
| `403` | `{"detail": "This key is for PMS 'comanche'"}` |
| `413` | `{"detail": "Event body exceeds 16 KB"}` |
| `422` | `{"detail": [{"loc": ["DocDate"], …}]}` (FastAPI's standard shape) |
| `429` | rate limit, 120/min per source IP, `Retry-After: 60` |

## `GET /days/{id}` → `PmsDayOut`

```jsonc
{
  "id": "…",
  "interface": "Comanche", "doc_type": "Daily", "doc_date": "2024-09-05",
  "reason_code": null,          // set when the pipeline stopped it (carmen_rejected, …)
  "error_message": null,        // Carmen's own words, for those
  "setting_code": "Comanche.PMS", "post_type": "REVENUE",
  "key_columns": ["Code", "Description"],
  "rows": [                     // every row of the day, in Carmen's preview order; Carmen's account where it has one
    {"key": "[\"100\",\"Room Charge\"]", "values": {"Code": "100", "Description": "Room Charge"},
     "dept": "101", "acc": "4010001", "name": "Room Revenue"}
  ],
  "mapped_count": 23,
  "new_codes": [                // one per new key; the AI's pick when it made a usable one
    {"key": "[\"729\",\"…\"]", "label": "729 · …", "values": {…},
     "dept": "101", "acc": "4010006", "confidence": "low", "why": "…"}
  ]
}
```

`key` is opaque to the client: send it back unchanged as the key of `mappings`. There is no
`amount`: Carmen's preview carries none (decision-log #54). The review screen does not read
`confidence`/`why` (decision-log #47); they stay in the response as the day's record. **There is no side and no total.** `404` when the day is not
`pending_review` for this BU, or has no payload.

## `POST /days/{id}/approve`

```json
{"mappings": {"[\"729\",\"…\"]": {"dept": "101", "acc": "4010006"}}}
```

| Status | When | The day |
|---|---|---|
| `200` `{"jv_no": null, "already_posted": false}` | posted by Carmen's engine | `posted` |
| `200` `{"jv_no": null, "already_posted": true}` | Carmen had already posted it (`Code -200`) | `posted`, `reason_code = already_posted` |
| `400` | no credential stored · a new row without dept + acc · a dept or account not in Carmen's chart, or a pair the dept forbids (the message names the row) · Carmen's engine refused (`Carmen didn't post the day: Mapping is incomplete.`, a closed period, …) | stays parked |
| `404` | not this BU's, or gone | — |
| `409` | another reviewer holds the claim, or it was already handled | — |
| `503` | Carmen's mapping could not be read (**nothing was written**), Carmen did not save the accounts, or the post could not reach Carmen | stays parked |

A key that Carmen's table has meanwhile mapped (by its own screen) keeps Carmen's account, and
the pick sent for it is ignored. `jv_no` is the JV's seq from the engine's answer `Id`
(ask D); `null` when Carmen had already posted the day.

## `POST /days/{id}/reject`

`{"reason": "optional, ≤ 500"}` → `204`. The day becomes `rejected` / `rejected_by_reviewer`,
and its payload is cleared. `404` and `409` work as for approve. If Carmen re-sends the day,
it is read again.

## Carmen endpoints we call

All under `{carmen_uri}/Carmen.API/api/interface`, with the BU's menu token.

| Call | Function | Answer we rely on | State, 2026-11-03 |
|---|---|---|---|
| `GET /{type}/{name}/{docType}/Date/{docDate}` | `carmen.get_databank_day` | a list of `ViewDataBank` rows (`Id`, `FileData`, `LastModified`, …), or an empty body | works. Needs `Inf.PMS.DataBank` View on the menu user (403 otherwise) |
| `GET /interfaceThirdParties` | `carmen.get_interfaces` | the BU's interfaces × sections: `[{InterfaceType, InterfaceName, PostToModule, DocType, PostType, From}]`, e.g. `{"PMS", "Comanche", "GL", "REVENUE", "Json", "CarmenApi"}` | **works since 2026-11-03** (Carmen added it in place of the setting GET, which is still 404 with the menu token). Carmen's register of third-party integrations, not the BU's settings. `From` says how the third party's data reaches Carmen (the user, 2026-11-03): `CarmenApi` = the third party sends it into Carmen (the Data Bank, then our hook); `PartnerApi` = Carmen fetches it from the third party itself; `null` = a user imports the file (decision-log #51) |
| `GET /interfacePost/mapping/{code}/{postType}/GL` | `carmen.get_pms_mapping` | a .NET DataTable: `{"Columns": [{ColumnName}…], "Rows": [{Code, Description, DeptCode, AccCode, AccDesc, …}]}`. `Columns` less the account columns is the mapping key. A setting Carmen lacks answers `303` `Code -400 "Configuration is missing"`, which we raise | **works since 2026-10-15** (Carmen added it; 33 rows for Comanche) |
| `PUT /interfacePost/mapping/{code}/{postType}/GL` | `carmen.put_pms_mapping` | body `[{<key columns>, DeptCode, AccCode}]`. **Replaces the whole table** | works with the menu token (sandbox, 2026-10-14) |
| `POST /interfacePreviewPostGL/{postType}` | `carmen.preview_pms_gl` | the post's body. Answers a .NET DataTable named `Mapping`, not the `ViewPostResult` Swagger names: the mapping table's columns, one row per line of the day keyed as the engine reads it, and the account each key has (null = none). No amounts, sides or refusals. `id` is optional (by date). `303` `-400 "No Data Found"` when there is no data; HTTP 500 for a closed period. It makes no JV and does not write the table | **works since 2026-11-10** (ask P; 500 on 11-09). Equal to our old reader on five dev days. The day's rows since decision-log #54 |
| `POST /interfacePostGL/{postType}` | `carmen.post_pms_gl` | see below | works with the menu token |
| account codes, departments | `carmen.get_account_codes`, `get_departments` | the BU's chart, for the AI and the approve checks | works |

**`interfacePostGL/REVENUE`.** Body:
`{"Code": "Comanche.PMS", "DateFrom": d, "DateTo": d, "id": [databankId]}`. No `DeptCode`/`AccCode`:
the counter account is Carmen's setting, and the engine reads it from there (decision-log #51).

| Carmen answers | Means | We record |
|---|---|---|
| `200` `{"Result": true, "Code": 1, "Id": [1599]}` | posted. `Id` holds the JV's seq (ask D, since 2026-11-03; one day, one JV) | `posted`, `jv_no` = `Id[0]` |
| `303` `{"Code": -200, "UserMessage": "Already Posted."}` | posted before (its own Post button, or an earlier approve) | `posted` + `already_posted` |
| `303` `{"Code": -500, "UserMessage": "Mapping is incomplete."}` | a row has no account | parked `carmen_rejected` (pipeline) · `400` (approve) |
| `303` `{"Code": -400, "UserMessage": "Configuration is missing"}` | no `Code` sent | the same |
| `200` `{"Result": false, "ErrorList": […]}` | e.g. "Account code is empty" if the engine cannot find the counter | the same. **Only `Result: true` counts as posted** |
| `401` / `403` | the token is dead, or lacks a permission | `carmen_unauthorized` / `carmen_forbidden` |

The 303s come back as values, not errors: `_json_or_raise` raises only at ≥ 400.

We measured these on Carmen's `test.PMS` sandbox on 2026-10-14 and 10-15, and voided the JVs afterwards.
`Code` is required. On 2026-10-15 the counter was too; since then Carmen fills it from its
setting when it is not sent (proven 2026-11-03: JV 1594 on `test.PMS`). `id` is optional: a date
range alone also posts.
