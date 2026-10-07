# PMS Integration — Carmen → AI (CA-93)

**Audience:** the Carmen developers wiring PMS data into the AI module.
**Status:** phase 1. We accept and store events. Processing them (mapping, posting) is the
next phase, so you can integrate against this today and nothing here should change shape
when processing lands.

When a BU's PMS data arrives in Carmen, Carmen POSTs it to us. That is the whole integration
for now: one URL, and a key per BU that the BU creates itself (§2).

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
  "event_id": "NA-2026-10-06",
  "type": "night_audit",
  "data": { "...": "PMS figures, see §3.1" }
}
```

| Field | Type | Rule |
|---|---|---|
| `event_id` | string, 1–100 chars | **Unique within the BU.** A retry must resend the **same** `event_id`. That is how we recognise a retry. |
| `type` | string, 1–50 chars | What kind of PMS data this is (e.g. `night_audit`). Values are agreed per type before processing is built. |
| `data` | JSON object | The PMS data itself. We store it as you send it. |

- `Content-Type: application/json`, UTF-8.
- **Maximum body size: 1 MB.** That is sized for summaries (about one event per BU per day),
  not transaction dumps. If you need more, tell us before sending it.

### 3.1 What `data` may contain: aggregates only, no guest personal data

Send revenue and account summaries: totals by department, revenue code, payment type, tax and
so on. **Do not send guest names, room-to-guest assignments, passport/ID numbers, contact
details or card numbers.** We do not need them to post accounting entries, and leaving them
out keeps this integration outside PDPA scope for guest data. We delete the stored payload
once an event is processed.

The exact `data` schema per `type` is still open (§6).

## 4. Responses

| Status | Body | Meaning | What Carmen should do |
|---|---|---|---|
| `202` | `{"id": "<uuid>", "duplicate": false}` | Stored | Done |
| `200` | `{"id": "<uuid>", "duplicate": true}` | We already have this `event_id` for this BU. The first copy is kept, and this body is **not** compared with it. | Done. A new `event_id` is the only way to send changed data. |
| `401` | `{"detail": "Invalid API key"}` | Key missing, unknown or revoked, or the BU is disabled | Do not retry. Check the key. |
| `413` | `{"detail": "..."}` | Body over 1 MB | Do not retry as is |
| `422` | `{"detail": [...]}` | Envelope invalid (missing `event_id`, `data` not an object, not JSON …) | Do not retry. Fix the payload. |
| `429` | `{"detail": "..."}` + `Retry-After` | Rate limited (120 requests/min per source IP) | Retry after the delay |
| `5xx` / timeout | — | Our side failed | **Retry with backoff, same `event_id`** |

Any `2xx` means "we have it". Because a retry with the same `event_id` is answered `200` with
the original id, retrying is always safe.

## 5. Try it

```bash
curl -X POST https://carmen-ocr-backend-xntb.onrender.com/api/v1/pms/events \
  -H "Authorization: Bearer cpk_…" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"test-1","type":"night_audit","data":{"total_revenue":12345.67}}'
# → 202 {"id":"…","duplicate":false}; run it again → 200 {"id":"<same>","duplicate":true}
```

## 6. Open questions for Carmen

1. **`data` schema per `type`.** Which PMS outputs exist (night audit, daily revenue, …) and
   what fields each carries. Processing is built against this.
2. **Volume.** Events per BU per day and typical size. The 1 MB cap and the per-IP rate limit
   assume about one summary per BU per day. All BUs on one Carmen host share that IP's limit.
3. **Corrections.** If PMS figures for a day are re-run, does Carmen send a new `event_id`
   (we keep both) or expect a replace?

---

*Internal notes:* keys are rows in `api_keys` with scope `pms:events`, created by the BU at
`#/pms` (session-scoped `/api/v1/pms/keys`) or by an admin at `#/admin/api-keys`. Events land in `pms_events`, unique on `(tenant_id, event_id)`. Code:
`backend/app/routers/pms.py`, `services/shared/api_keys.py`. Decisions:
[email-automation decision log #39 and #40](email-automation/06-decision-log.md).
