# Requirements

## Problem statement

Each night audit, a hotel's PMS writes the day's revenue, payments and ledgers into Carmen's
Data Bank. Carmen already has an engine that posts that day as one JV. It follows the BU's PMS
setting, which holds the file layout, the debit/credit rule and the counter account. It also
uses the BU's mapping table, which gives each PMS row a department and account.

The engine posts nothing while any row of the day is missing from the mapping table
(`Code -500 "Mapping is incomplete."`), and the table falls behind every time the PMS gains a
code: a new outlet, a package, a rebate, a renamed description. On dev, Carmen's Comanche
table placed every row of only **1 day out of 73**. Today an accountant finds the missing rows
and picks accounts in Carmen's screen, then presses Post. That work starts again whenever a
new code appears.

The PMS interface does that work. The AI suggests accounts for the rows the table cannot
place, a person confirms them once, and Carmen's own engine posts the day. A code approved
once is in Carmen's table for every later day, so after the first weeks most days need
nobody.

## Actors

| Actor | What they do |
|---|---|
| **The PMS** (Comanche, …) | Writes each day into Carmen's Data Bank. It never talks to us. |
| **Carmen** (the system) | Sends the hook. Serves the Data Bank, the PMS setting and the mapping table. Posts the day with its engine. Owns the PMS setting screen, which sets auto-post and generates the hook key through our Settings API. |
| **BU user** | On Carmen's PMS setting screen, generates the key and chooses auto-post, per PMS. Reviews parked days in the queue. Carmen decides who sees the screen (decision-log #34, #44). |
| **Our support / admin** | Sees every BU's keys, their PMS, and when each was last used, at `#/admin/api-keys`. Can revoke them, not generate them. |
| **pg_cron** | Calls `/api/v1/pms/process/run` every 10 minutes for whatever the hook did not finish. |

## Functional requirements

**Receiving**
- **FR-1** Accept Carmen's hook `{InterfaceType, InterfaceName, DocType, DocDate}` at
  `POST /api/v1/pms/events`. The key of that BU and PMS authenticates it (a key of another PMS
  is a `403`), and it is stored as **one row per BU × day**. Answer `202` for a new day and `200 {duplicate: true}` for the same day again.
  Never record a guessed day: `DocDate` must be an ISO date string. The full contract is
  [`PMS_INTEGRATION.md`](../PMS_INTEGRATION.md) §3–§4.
- **FR-2** Answer the hook without waiting for processing: storing the day **starts**
  processing in the background (`process.kick`).

**Keys and credential**
- **FR-3** Carmen's PMS setting screen generates and revokes a BU's key for one PMS through
  `/api/v1/carmen/pms/keys` (decision-log #44). A key's plaintext is returned once. **One live
  key per BU × PMS**: a new one revokes the old. Revoking a key switches that PMS off.
- **FR-4** Every write from that screen stores the user's Carmen token as the BU's one
  credential, after proving it against Carmen. It is the same credential email automation
  posts with. Storing it wakes the days that were waiting for one. The first write for a BU
  that never opened the app creates its tenant, with the signup credits. A read of such a BU
  answers the defaults and creates nothing.

**Processing a day**
- **FR-5** Read the BU's PMS setting for the hook's `InterfaceName`, its active `REVENUE`
  section, and that section's INI. Read the day from the Data Bank, choosing the newest row
  when there is more than one. Then read the mapping table.
- **FR-6** Find the day's **new keys**: those with no account in the table. Ask the LLM once
  for an account per new key. Show it the BU's existing mapped rows as examples, and keep
  only codes that exist in the BU's chart (`_validate_codes`).
- **FR-7** **Park** the day for review when any new key exists, whether or not the AI picked an
  account for it, or when the BU's `auto_post` for that PMS is off. Otherwise, ask Carmen's engine to post
  it.
- **FR-8** Retry what may pass (no credential yet, Carmen down, the day not in the Data Bank
  yet), up to 3 attempts, then show the day as failed. A newer credential wakes a failed day.

**Review**
- **FR-9** A parked day is one row in `#/CreditCardOCR`, and its review is at
  `#/CreditCardOCR/review?pms=<id>`. The review lists the new rows with the AI's pick, its
  confidence and its reason. The rows Carmen already maps are folded underneath.
- **FR-10** **Every AI pick needs a person before Approve**: a tick on *Checked*, or a
  different account. An AI account goes into Carmen's table for every later day.
- **FR-11** Approve reads Carmen's table fresh and checks each pick against the chart: the
  department exists, the account exists, and the department allows the account. It then
  writes the table back **whole** with the new rows, and asks the engine to post. When
  Carmen refuses, the day stays parked with Carmen's own words on screen.
- **FR-12** After an Approve, re-check the BU's other parked days of the same interface: a
  row approved on one day is no longer new on the others.
- **FR-13** Reject retires a day with an optional reason. Carmen re-sending the day brings it
  back.

**Repeats**
- **FR-14** A repeat hook re-reads a day that has not posted (Carmen re-sends after a night
  audit is re-run). It never touches a posted day, or a day a reviewer is acting on right now.

## Non-functional requirements

| Area | Requirement | How |
|---|---|---|
| Tenancy | A key can write only into its own BU | The key row carries `tenant_id`; the body names no BU |
| Idempotence | A retried hook, a retried approve and a second worker all do nothing twice | `unique (tenant_id, event_id)`; claims on `processed_at` and `posting_started_at`; the engine refuses a posted day (`-200`) |
| Durability | No day is lost to a restart | The row is committed before `kick`; the sweep re-runs `received` days |
| Data minimisation | Keep no PMS figures once a day is done | `review_payload` is cleared on every terminal transition; the Data Bank keeps the day |
| Privacy | The day's rows go to the LLM only as aggregates, under the no-training rule | The hook carries no data; the Data Bank holds aggregates by code; every LLM call sends `data_collection: deny` |
| Abuse | A bad sender cannot flood us | 16 KB body cap; 120 requests a minute per source IP |
| Secrets | A leaked database row cannot be used as a key | Only `sha256(key)` is stored; the Carmen token is Fernet-encrypted |
| Consent | No AI consent popup for a PMS-only BU (accepted, decision-log #44) | The rows sent are aggregates by code, every call is `data_collection: deny`, and nothing gates on `consent_logs`. Carmen is asked to state the AI use on its PMS setting screen (07-status ask J) |

## Business rules

- **No rules of our own** (decision-log #43). Debit and credit, the balance, the counter line
  and the JV prefix all come from Carmen's PMS setting. We read the setting **only** to find
  the rows and their mapping keys.
- **REVENUE only.** One day posts as one JV. The setting's other sections (Statistic,
  MarketSegment) are ignored.
- **Only a JSON-object file layout is read** (Comanche, HotelTime). A CSV, fixed-width or other
  layout fails as `unsupported_pms_format` and is never guessed.
- **The mapping key is what the setting says it is.** For Comanche it is `[Code][Description]`,
  so a tax row is its own key, and so is a renamed description. Path A keyed on `Code` alone
  to survive renames. Path B follows Carmen.
- **`auto_post` is per BU × PMS and defaults to off.** Carmen's PMS setting screen sets it. A day with a new row waits for a person under
  either setting (the email rule, decision-log #24).
- **No charge.** No document is consumed. The `pms_interface` module row exists only because
  `llm_usage_logs.module_id` is a foreign key.
- **Carmen gates the screen; we check nothing twice.** We have no role check. Any token Carmen
  accepts may manage that BU's keys and settings, and approve its days.
- **PMSs that Carmen's post API fetches itself** (no Data Bank, no hook) are not handled yet.
  Carmen will list the PMS kinds, which are the same for every BU (decision-log #44).

## Out of scope (for now)

- InterfaceTypes other than `PMS` (Carmen's Data Bank also has `INV`, `POS` and `HRM`, with
  the same API shape). The hook refuses them with `422`.
- Setting sections other than REVENUE.
- Editing a mapping after it was approved. Carmen's own mapping screen does that.
- A JV number on the posted row. Carmen's engine does not return one (CA-116).
- A retention purge for old `pms_events` rows: the period is undecided.
- A daily token-health check for a BU that uses PMS but not email automation.
- Billing or an entitlement gate.
