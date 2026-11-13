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
| [#44](../email-automation/06-decision-log.md#44-carmens-pms-setting-screen-owns-the-pms-settings-per-bu-and-pms-2026-10-16) | 2026-10-16 | CA-93 | **Carmen's PMS setting screen sets auto-post and generates the hook key, per BU × PMS**, through `/api/v1/carmen/pms`. One live key per BU × PMS; a new one revokes the old. A hook naming another PMS is a 403. Every Carmen write stores the proven token as the BU's credential (amended by #45). The first write creates a missing BU, with the signup credits; a read never does. No consent popup for a PMS-only BU (accepted). `#/pms` is deleted | Yes, except a working credential is now kept (#45). Merged 2026-10-20 |
| [#45](../email-automation/06-decision-log.md#45-a-carmen-pms-write-keeps-a-working-credential-2026-10-20) | 2026-10-20 | CA-93 | A Carmen write on `/api/v1/carmen/pms` **keeps a held credential that still works** (`credential.adopt_token`) and stores its own token only when none is held, the same one is, or the held one is refused. Deliberate token saves (`PUT /settings/token`, the menu link) still replace it | Yes |
| [#47](../email-automation/06-decision-log.md#47-the-pms-review-is-carmens-mapping-table-and-approve-is-the-yes-2026-10-28) | 2026-10-28 | CA-119 | The review is **one table laid out as Carmen's mapping screen** (Code, Description, DeptCode, AccCode, AccDesc): new rows first with pickers, Carmen's rows read-only, one per key, no amounts. **No *Checked* tick**: Approve opens once every new row has an account. AI tag and Undo kept; the AI's reason and *Unsure* dropped | Yes |
| [#51](../email-automation/06-decision-log.md#51-pms-processing-reads-carmens-interface-list-and-derives-the-rest-2026-11-03) | 2026-11-03 | CA-119 | The Setting GET never came. Processing reads Carmen's **`interfaceThirdParties`** (active interfaces × sections) and **derives the rest**: code `{InterfaceName}.{InterfaceType}`, key = the mapping table's own columns, rows = the one `FileData` list carrying them all, counter left to Carmen's engine. A PMS it cannot key fails `unreadable_day`, never a guess | Yes |

| [#52](../email-automation/06-decision-log.md#52-carmens-post-checks-the-mapping-for-every-pms-built-2026-11-06) | 2026-11-06 | CA-119 | **Built** (PR #346, merged 2026-11-06). Carmen's post is the completeness check, for every PMS. #51's reader stays as a preview where it can key the day (Comanche). Otherwise the day posts (auto-post on) or waits for Approve (off), and Carmen's answer decides: `-500` parks `pms_mapping_incomplete`. PartnerApi days are opened by our sweep for PMSs whose `interfaceThirdParties` row says `From: PartnerApi`. Proven end to end on Cloudbeds: a real JV, voided | Yes, reader and "map in Carmen" amended by #53. Carmen: K open; L not needed; M closed |
| [#53](../email-automation/06-decision-log.md#53-every-pms-is-reviewable-2026-11-06) | 2026-11-06 | CA-119 | **Every PMS is reviewable.** One generic reader: a key column reads its own field, else that name less a `PREFIX_` (HotelTime `HT_Code ← Code`), else blank (`Department`, Cloudbeds' `Channel`); a list named after another section (`Statistic`) is skipped; a tie goes to the list with `Amount`. Checked against Carmen's own keys (HotelTime 46/46, Cloudbeds 78/78). On Carmen's `-500`, its table's rows with no account join the day's rows, with the AI's picks, to map in our review | Yes, reader replaced by #54 |
| [#54](../email-automation/06-decision-log.md#54-carmens-preview-keys-the-day-our-reader-is-gone-2026-11-10) | 2026-11-10 | CA-119 | **Carmen's preview keys the day.** The day's rows come from `interfacePreviewPostGL`: Carmen's engine reads the day by the INI and keys it as a post would, for any PMS. It equals #53's reader on five dev days, which is deleted, so FileData is no longer read. If the preview fails, the day parks with no rows and the `-500` fallback stays. The AI sees no amounts, and `amount` leaves the review API. `scripts/qa/pms_probe.py` checks a PMS before it goes live | Yes |
| [#55](../email-automation/06-decision-log.md#55-the-sweep-opens-every-pmss-day-from-0600-the-hook-only-brings-it-sooner-2026-11-12) | 2026-11-12 | CA-119 | **The sweep opens every PMS's day, from 06:00 ICT.** Yesterday's day is opened for each BU × PMS with a live key that `interfaceThirdParties` names as posting REVENUE to GL, whatever its `From` (#52 opened only PartnerApi, after 08:00). The hook only brings a day sooner, so the loop no longer waits on it; a day Carmen never gets fails after 24 hours (Not posted). Limits: only yesterday; a PartnerApi day at 06:00 may predate the night audit | Yes |
| [#56](../email-automation/06-decision-log.md#56-revoking-a-pmss-key-switches-it-off-its-open-days-close-its-auto-post-goes-off-2026-11-12) | 2026-11-12 | CA-119 | **Revoking a PMS's key switches it off.** From Carmen's `DELETE /keys` or `#/admin/api-keys`, `switch_off` closes the PMS's open days (`rejected`/`pms_switched_off`, under Not posted; a day being approved is left to finish) and turns its auto-post off. Processing closes any day it meets without a live key, and the requeue skips such a PMS, so nothing posts by itself after a switch-off. Replacing a key is not a switch-off | Yes |
| [#57](../email-automation/06-decision-log.md#57-the-ais-pick-a-department-forbids-keeps-its-account-blank-rows-are-asked-again-2026-11-13) | 2026-11-13 | CA-119 | **The AI's forbidden pair keeps its account; blank rows are asked again.** A pick whose department's `DefaultAccount` forbids the account moves to the department the BU's own table uses with it, else GEN (all 31 blank rows on QA were this). Rows still blank are asked once more with why. The sweep asks again for parked days' blank rows hourly, at most 3 times. PMS only, no UI change, nothing posts | Yes |
| [#58](../email-automation/06-decision-log.md#58-a-day-is-one-row-whatever-its-pms-names-casing-2026-11-13) | 2026-11-13 | CA-119 | **A day is one row whatever its PMS name's casing.** The sweep stores Carmen's list's spelling (`Hoteltime`), a hook its own (`HotelTime`): `store_day` now skips the insert when the day exists in any casing, and a repeat hook finds it the same way (`lower(event_id)`). Replaces #44's "Carmen sends one casing" | Yes |

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
   case-insensitively by Carmen. That is Carmen's rule, and since #51 it is where our code
   comes from: the setting itself is never read.
4. **The counter account** (`DeptCode`/`AccCode` in the post) was required on 2026-10-15.
   Carmen planned, after 2026-10-19, to fill it from its own config when it is not sent.
   Since #51 we never send it, and the setting read it was one reason for is gone: #51
   derives the rest from `interfaceThirdParties`, the mapping table and the day.

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
