# PMS Integration — Carmen → AI (CA-93)

**Audience:** the Carmen developers wiring PMS data into the AI module.
**Status:** phase 1. We accept and record the hook. Processing it is the next phase:
reading the day from Carmen's Data Bank, mapping and posting. You can integrate against
this today.

When a day of PMS data lands in Carmen's Data Bank, Carmen sends us a short hook that names
that day. It carries no PMS data: we read the day back from the Data Bank ourselves
(`GET /api/interface/PMS/{InterfaceName}/{DocType}/Date/{DocDate}`). That is the whole
integration for now: one URL, and a key per BU that the BU creates itself (§2).

---

## 1. Endpoint

```text
POST {base}/api/v1/pms/events
```

| Environment | `{base}` |
|---|---|
| QA / dev | `https://carmen-ocr-backend-xntb.onrender.com` |
| Production | sent together with the production keys |

The URL is the same for every BU. The key tells us which BU an event belongs to; the body
never names one.

## 2. Authentication — one key per BU, created by the BU

```text
Authorization: Bearer cpk_…
```

The BU creates its own key from the AI menu in Carmen, and pastes it into Carmen's PMS
settings. Nobody hand-picks the BU: the menu link signs the user in through the same SSO as
our other screens, and the key belongs to exactly that (host, BU).

**What Carmen builds:**

1. **A menu item** that opens

   ```text
   https://<ocr-app>/#/pms?token=<user's Carmen token>&bu=<bu>&user=<user>&uri=<your origin>
   ```

   with the same parameters as the email-settings link. Show it only to users your own
   permission model allows; we check no roles of our own (decision #34). The page lists the
   BU's keys and lets the user create and revoke them.
2. **A field in PMS settings** where the BU pastes the key. Send it on every event.

**Rules:**

- A key is shown once, on creation, and we keep only a hash. If it is lost, create a new one
  and revoke the old one.
- `Bearer ` is optional. A bare `Authorization: cpk_…` works too.
- Keys do not expire. **Rotation:** create a second key, paste it into Carmen, then revoke
  the first. Both work during the switch, so nothing is dropped.
- **At most 2 active keys per BU** (enough for a rotation). A third is refused until one is
  revoked.
- **Revocation is immediate** and is how a BU is switched off. A revoked key gets `401`.
- Server-to-server only, over HTTPS. Never put the key in a browser or a URL.
- Our admins can also see and revoke any BU's keys (`#/admin/api-keys`), for support.

## 3. Request body

```json
{
  "InterfaceType": "PMS",
  "InterfaceName": "Comanche",
  "DocType": "Daily",
  "DocDate": "2026-10-07"
}
```

| Field | Type | Rule |
|---|---|---|
| `InterfaceType` | string | `PMS` on this endpoint (`pms` also works). |
| `InterfaceName` | string, 1–40 chars, no `/` | The PMS, as in the Data Bank (e.g. `Comanche`). |
| `DocType` | string, 1–30 chars, no `/` | As in the Data Bank (e.g. `Daily`). |
| `DocDate` | **ISO date string** | `"2026-10-07"`. A datetime such as `"2026-10-07T00:00:00"`, `…+07:00` or `…Z` also works; we take the date part. |

**What we accept, so your client's defaults do not matter:**
- field names in any case: `InterfaceType`, `interfaceType` (.NET `PostAsJsonAsync`), `interfacetype`;
- extra fields, which we ignore;
- any `Content-Type`, since we parse the body as JSON regardless, with or without a UTF-8 BOM;
- `Authorization: Bearer …`, `bearer …` or the bare key.

**What we refuse with `422`, because a guess could record the wrong day:**
- **`DocDate` that is not an ISO date string.** A number such as `20261007`, `"07/10/2026"` and
  `"2026-10-7"` are all refused: they are ambiguous, or would be read as a timestamp.
- **Invalid JSON.** That includes a trailing comma, as in the first sample we were sent.
- **An array.** Send one hook per day.
- **An `InterfaceType` other than `PMS`, or a `/` in `InterfaceName`/`DocType`.**

The hook carries no PMS data, so no guest data travels through it; the figures stay in the
Data Bank until we read them. The maximum body size is 16 KB.

**One BU, one day, one row.** The four fields identify a Data Bank day. A second hook for the
same BU and day lands on the same row: we answer `200` and record when we last heard of it.

## 4. Responses

| Status | Body | Meaning | What Carmen should do |
|---|---|---|---|
| `202` | `{"id": "<uuid>", "duplicate": false}` | A new day for this BU, recorded | Done |
| `200` | `{"id": "<uuid>", "duplicate": true}` | This BU and day were already recorded; we noted the repeat | Done |
| `401` | `{"detail": "Invalid API key"}` | Key missing, unknown or revoked, or the BU is disabled | Do not retry. Check the key. |
| `413` | `{"detail": "..."}` | Body over 16 KB | Do not retry as is |
| `422` | `{"detail": [...]}` | Body invalid: not JSON, a field missing or misnamed, `DocDate` not a date, `InterfaceType` not `PMS` | Do not retry. Fix the body. |
| `429` | `{"detail": "Too many requests — please slow down."}` + `Retry-After: 60` | More than 120 requests a minute from one source IP | Wait `Retry-After` seconds, then resend the same body |
| `5xx` / timeout | — | Our side failed | **Retry with backoff, same body** |

Any `2xx` means "we have it". A retry of the same body is answered `200` with the same id, so
retrying is always safe.

**Pacing.** The limit is 120 requests per minute per source IP, shared by every BU your server
sends for. For a backfill (many days or many BUs at once), stay under 2 requests a second.

**A `422` names the field.** Real bodies:

```json
{"detail":[{"type":"missing","loc":["DocDate"],"msg":"Field required", ...}]}
{"detail":[{"type":"value_error","loc":["DocDate"],"msg":"Value error, DocDate must be an ISO date string, e.g. \"2026-10-07\"","input":20261021, ...}]}
{"detail":[{"type":"literal_error","loc":["InterfaceType"],"msg":"Input should be 'PMS'","input":"POS", ...}]}
{"detail":[{"type":"json_invalid","loc":[],"msg":"Invalid JSON: trailing comma at line 1 column 97", ...}]}
```

## 5. Test checklist: run these before going live

These use the QA URL and the key the BU created at `#/pms`. Replace `cpk_…`, and use a
**`DocDate` you have not used before** for step 1. Every step must give exactly the status shown.

```bash
URL=https://carmen-ocr-backend-xntb.onrender.com/api/v1/pms/events
KEY=cpk_…
BODY='{"InterfaceType":"PMS","InterfaceName":"Comanche","DocType":"Daily","DocDate":"2026-10-07"}'

# 1. A new day                       → 202 {"id":"<uuid>","duplicate":false}
curl -s -w ' %{http_code}\n' -X POST $URL -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$BODY"
# 2. The same day again              → 200 {"id":"<same uuid>","duplicate":true}
curl -s -w ' %{http_code}\n' -X POST $URL -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$BODY"
# 3. A wrong key                     → 401 {"detail":"Invalid API key"}
curl -s -w ' %{http_code}\n' -X POST $URL -H "Authorization: Bearer cpk_wrong" -H "Content-Type: application/json" -d "$BODY"
# 4. DocDate missing                 → 422 … "loc":["DocDate"] …
curl -s -w ' %{http_code}\n' -X POST $URL -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"InterfaceType":"PMS","InterfaceName":"Comanche","DocType":"Daily"}'
# 5. After the BU revokes the key at #/pms, step 1 with a new day → 401
```

Then send from **your own code** (not curl) for one real day, and check step 1 and step 2 give
202 and 200. Your HTTP client's defaults (content type, name casing, BOM) are covered by §3.

## 6. Open questions for Carmen

Tracked in CA-116, with what we found on the dev Data Bank:

1. **What the AI does with the day,** and through which path it posts:
   - `/gljv`;
   - Carmen's `interfacePostGL`;
   - `interfacePostAR/CarmenAI`.
2. **The token we use to read the Data Bank and post,** per BU, with no user session.
3. **What a repeat hook means.** Is the hook sent on Add *and* on AddOrUpdate? Is a second
   hook for the same day a changed day that we should process again?
4. **Which `InterfaceType`/`DocType`** will hook us first.

---

*Internal notes:* keys are rows in `api_keys` with scope `pms:events`, created by the BU at
`#/pms` (session-scoped `/api/v1/pms/keys`) or by an admin at `#/admin/api-keys`. Hooks land in
`pms_events`, unique on `(tenant_id, event_id)`. There `event_id` holds the day's key
(`PMS/Comanche/Daily/2026-10-07`), `payload` holds the hook as sent, and a repeat moves
`updated_at`. Code:
`backend/app/routers/pms.py`, `services/shared/api_keys.py`. Decisions:
[email-automation decision log #39 and #40](email-automation/06-decision-log.md).
