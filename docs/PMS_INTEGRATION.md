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
| `InterfaceType` | string | Must be `PMS` on this endpoint. |
| `InterfaceName` | string, 1–40 chars, no `/` | The PMS, as in the Data Bank (e.g. `Comanche`). |
| `DocType` | string, 1–30 chars, no `/` | As in the Data Bank (e.g. `Daily`). |
| `DocDate` | date | `2026-10-07`. The Data Bank form `2026-10-07T00:00:00` is accepted too; the time is ignored. |

- **Field names are exactly as above,** PascalCase. `interfaceType` is not recognised and is answered `422`.
- **The body must be valid JSON.** A trailing comma, as in the first sample we were sent, is answered `422`.
- **`Content-Type: application/json`,** UTF-8. Maximum body size is 16 KB.
- **The hook carries no PMS data,** so no guest data travels through it. The figures stay in the Data Bank until we read them.

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
| `429` | `{"detail": "..."}` + `Retry-After` | Rate limited (120 requests/min per source IP) | Retry after the delay |
| `5xx` / timeout | — | Our side failed | **Retry with backoff, same body** |

Any `2xx` means "we have it". A retry of the same body is answered `200` with the same id, so
retrying is always safe.

## 5. Try it

```bash
curl -X POST https://carmen-ocr-backend-xntb.onrender.com/api/v1/pms/events \
  -H "Authorization: Bearer cpk_…" \
  -H "Content-Type: application/json" \
  -d '{"InterfaceType":"PMS","InterfaceName":"Comanche","DocType":"Daily","DocDate":"2026-10-07"}'
# → 202 {"id":"…","duplicate":false}; run it again → 200 {"id":"<same>","duplicate":true}
```

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
