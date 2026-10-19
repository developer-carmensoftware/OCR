# Decision Log (PMS)

**The canonical entries are in
[`../email-automation/06-decision-log.md`](../email-automation/06-decision-log.md), #39–#43.**
PMS shares that log's numbering, because the decisions cross over: one Carmen credential, one
queue, one auto-post rule. Code and `CLAUDE.md` cite them as "decision-log #NN". Add new PMS
decisions there, as #45 onwards, and add a line here.

This page is the index, plus what was superseded and why.

## Index

| # | Date | Ticket | Decision | Still true? |
|---|---|---|---|---|
| [#39](../email-automation/06-decision-log.md#39-carmen-calls-into-us-for-pms-data-with-a-key-we-issue-2026-10-07) | 2026-10-07 | CA-93 | Carmen calls **into** us at `/api/v1/pms/events`, with a per-BU bearer key we issue. The key is the tenant. sha256 only, no HMAC. Keys do not expire. Revoking a key is the off switch | Yes, with the key now per BU **and** PMS (#44). Its envelope `{event_id, type, data}` and "data in the body" were replaced by #41 |
| [#40](../email-automation/06-decision-log.md#40-a-bu-creates-its-own-pms-key-from-carmens-menu-2026-10-07) | 2026-10-07 | CA-117 | The BU creates its own key at `#/pms`, opened only from Carmen's menu by SSO. Carmen gates who sees the menu, and we keep no roles. At most 2 active keys. English only | **No. Replaced by #44**: `#/pms` is gone, and Carmen's PMS setting screen generates the keys. "Carmen gates, we keep no roles" still holds |
| [#41](../email-automation/06-decision-log.md#41-carmens-hook-names-a-data-bank-day-we-read-the-data-back-2026-10-08) | 2026-10-08 | CA-93 | The hook is Carmen's own: `{InterfaceType, InterfaceName, DocType, DocDate}`, naming a Data Bank day that we read back. One row per BU × day. Lenient on sender defaults, strict on the date. 16 KB cap | Yes |
| [#42](../email-automation/06-decision-log.md#42-a-pms-day-is-a-jv-in-the-same-review-queue-2026-10-09) | 2026-10-09 | CA-119 | A PMS day is one row in the AI JV Automation queue, with the email review's rules. **One Carmen credential per BU**, shared with email. No charge. A repeat hook re-reads an unposted day. The hook kicks processing, and a cron sweeps what is left | The queue, credential, charge, repeat and durability parts: **yes**. Its posting half (our JV, `/gljv`, `pms_code_mappings`, `jv_prefix`): **replaced by #43** |
| [#43](../email-automation/06-decision-log.md#43-carmens-engine-posts-a-pms-day-by-carmens-own-config-2026-10-14) | 2026-10-14 | CA-119 | **No rules of our own.** Carmen's engine (`interfacePostGL/REVENUE`) posts by Carmen's per-PMS config. The mapping lives in Carmen's table, and Approve writes it back **whole**. REVENUE only, JSON-object layouts only | Yes. This is PR #292 |
| [#44](../email-automation/06-decision-log.md#44-carmens-pms-setting-screen-owns-the-pms-settings-per-bu-and-pms-2026-10-16) | 2026-10-16 | CA-93 | **Carmen's PMS setting screen sets auto-post and generates the hook key, per BU × PMS**, through `/api/v1/carmen/pms`. One live key per BU × PMS; a new one revokes the old. A hook naming another PMS is a 403. Every Carmen write stores the proven token as the BU's credential. The first write creates a missing BU, with the signup credits; a read never does. No consent popup for a PMS-only BU (accepted). `#/pms` is deleted | Yes. Stacked on PR #292 |

Two decisions from the email log apply here unchanged: **#24** (auto-post posts only what is
ready to post: a flagged day waits under either setting) and **#34/#35/#38** (the settings
screen is ours, Carmen only links to it, and the link's token is the credential).

## Decided since #43, not yet written into the log

Settled on 2026-10-15, on Carmen's Discord, and in the user's own notes.
**Add them to the canonical log when #292 merges.**

1. **The menu token does not expire.** Carmen agreed. CA-116 Q3 (token lifetime) is no longer
   a request. Still worth confirming with Carmen: minting a new token must not revoke the old
   one, because on 2026-10-09 a stored token died within hours ("SecurityToken has Expired").
2. **Mapping GET under `/api/interface`: done by Carmen.**
   `GET /api/interface/interfacePost/mapping/{code}/{type}/GL` answers 200 with the menu
   token, the same DataTable as the JWT route. Our `get_pms_mapping` needed no change.
3. **The setting's code is `{InterfaceName}.{InterfaceType}`** (e.g. `Comanche.PMS`), matched
   case-insensitively by Carmen. That is Carmen's rule; we still take the code from the
   setting we read.
4. **The counter account** (`DeptCode`/`AccCode` in the post) is required today. Carmen plans,
   after 2026-10-19, to fill it from its own config when it is not sent. That would make the
   counter optional **in the post**. It does not remove our need to read the setting: we also
   read the INI for where the rows are (`JsonKeys`), what keys the mapping (`Mapping_MapCode`),
   and `IsActive`.

## What was superseded

### Path A — our own JV (2026-10-09 → 10-14, PR #286/#287, on `main`)

| Path A did | Why it went |
|---|---|
| Signed each amount ourselves: × +1, Guest Ledger × −1, positive = credit (`services/pms/day.py`) | The sign rule is **per PMS** in Carmen's INI. Comanche signs `Amount` one way, Hotelogix and Custom the other, and GuestLine, Opera and HotelTime carry a D/C field. Our rule balanced 73/74 days only because it *is* Comanche's. Taking the side from the account's `Nature` balanced 0/74 |
| Checked the balance; an unbalanced day always parked | The engine decides sides and totals, and refuses what it cannot post, in its own words |
| Built the JV and posted it through our `/gljv` (`services/pms/posting.py`) | Carmen told us each PMS interface's post API handles its own +/−. Its engine made JV 36 for 2024-09-01, **equal to ours line for line** (14/14 accounts). The user's rule followed: no rules of our own, so a change in Carmen's config can never drift from a copy of ours |
| Kept our own mapping, `pms_code_mappings`, keyed `Revenue\|100`, `VAT\|*`, `SVC\|*` | A second copy of Carmen's mapping drifts from it. Carmen's own screen and engine use Carmen's table |
| `pms_settings.jv_prefix`; no prefix meant nothing posted | The prefix is the setting's `JvType` in Carmen |
| Wrote JvhSeq to `jv_no` | The engine returns no number |

Migration `20261015000000` drops `pms_code_mappings` and `jv_prefix`, and sends every unposted
day back to be read by path B.

### Envelope `{event_id, type, data}` (2026-10-07 → 10-08)

#39 assumed Carmen would push the figures in the body, with its own event id. Carmen's real
hook names a Data Bank day and carries nothing, so #41 took it as is. That removed the PII
question from the hook, but it created the need for a Carmen credential per BU (#42).

### A separate PMS page, and a "new codes across days" box (rejected 2026-10-09)

The user rejected both while reviewing the mock-up (CA-119, comment 11864). PMS days became
rows in the existing queue, beside the email documents. Across days, `recheck` clears a code
on every parked day once one day's approve maps it.
