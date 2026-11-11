# Status and Jira

Read from Jira on **2026-10-16**. The parent is
[CA-93 "PMS interface with AI module"](https://carmen-ac.atlassian.net/browse/CA-93) (Task, In
Progress), and the original thread is on Carmen's Discord (linked from CA-93).

**Jira was last updated on 2026-10-09.** Since then, path B (decision-log #43) was decided,
built and pre-tested (2026-10-14/15), and Carmen answered three of the open questions on
Discord (2026-10-15). None of that is in Jira yet. [What Jira is missing](#what-jira-is-missing)
lists it.

## The tickets

| Ticket | Jira status | What | Where it really stands (2026-10-16) |
|---|---|---|---|
| [CA-113](https://carmen-ac.atlassian.net/browse/CA-113) | Done | At most 2 active keys per BU | Shipped, then **replaced by #44**: one live key per BU × PMS (`feat/pms-carmen-settings`) |
| [CA-114](https://carmen-ac.atlassian.net/browse/CA-114) | Done | Prefactor: shared key dialogs; pin a page to English | Shipped, then **undone by #44**: the dialogs are back in `features/admin`, `FixedLanguage` is deleted |
| [CA-117](https://carmen-ac.atlassian.net/browse/CA-117) | Done | `#/pms`, the BU's self-service keys page, opened from Carmen's menu by SSO | Shipped, then **deleted by #44**: Carmen's PMS setting screen sets keys and auto-post through `/api/v1/carmen/pms` |
| [CA-121](https://carmen-ac.atlassian.net/browse/CA-121) | Done | An SSO link opened in an already-open tab kept the previous BU | Fixed |
| [CA-119](https://carmen-ac.atlassian.net/browse/CA-119) | In Progress | Processing: hook → JV, billing gate, payload retention | Path B merged (#292, #293) and on QA. **Unblocked 2026-11-03 (decision-log #51):** processing reads `interfaceThirdParties` in place of the setting GET. Retention purge not built |
| [CA-116](https://carmen-ac.atlassian.net/browse/CA-116) | To Do | [Carmen + us] Agree on the data schema, volume and corrections | Most of it settled (#41, #43, #51). Ask A answered by `interfaceThirdParties` (2026-11-03), and ask I by its `From` (CarmenApi / PartnerApi / null). See [Carmen asks](#what-carmen-still-owes) |
| [CA-115](https://carmen-ac.atlassian.net/browse/CA-115) | To Do | [Carmen] Menu link to `#/pms`, a key field in PMS settings, sending hooks | **The hook is sent:** on dev, a Data Bank Add fired our hook about 10 s later (sandbox, 2026-10-14; it carried no valid key, so it got 401). One hook from `carmencloud` arrived on 2026-10-09. **Changed by #44:** no menu link any more. Carmen's PMS setting screen calls our Settings API (auto-post, Generate key) and sends the key it gets back. Contract: [`PMS_INTEGRATION.md` §6](../PMS_INTEGRATION.md#6-settings-api--your-pms-setting-screen) |
| [CA-118](https://carmen-ac.atlassian.net/browse/CA-118) | To Do | Release CA-93 to prod | Phase 1 is on QA only. Open: the prod release scope (prod has lacked migrations since 2026-09-02), `TRUST_PROXY` on QA, and now path B's deploy-then-push order |
| [CA-120](https://carmen-ac.atlassian.net/browse/CA-120) | To Do | The first real end to end with Carmen | Blocked on CA-115 and CA-118 (and CA-119 path B). A simulated pre-run passed on 2026-10-07 |

Dependency chain: CA-113 → CA-117 → CA-118 → CA-120 ← CA-115; CA-116 → CA-119 → CA-120.

## Ask A, answered another way (2026-11-03)

**Until 2026-11-03 every day stopped at `carmen_config_unreadable`:**
`GET /api/interface/interfacePost/Setting/GL` (or `Setting/{code}/GL`) answers 404 with the menu
token, and the route still does not exist under `/api/interface` (Swagger 3.241).

Carmen added `GET /api/interface/interfaceThirdParties` instead: the BU's interfaces and their
sections, without the INI or the counter. Decision-log #51 derives the rest:

- **Which setting, and whether it is active:** the list's row for the hook's PMS × GL ×
  REVENUE, with the code `{InterfaceName}.{InterfaceType}`.
- **What keys the mapping:** the mapping table's own `Columns`.
- **Where the rows are:** the one `FileData` list that carries those columns.
- **The counter account:** not sent. Carmen's engine reads it from its setting.

Read live on dev, 2026-11-03: `Comanche.PMS`, key `[Code, Description]`, `Transaction`; 2025-10-20
gives 32 rows, 21 new keys against Carmen's 33-row table.

## What Carmen still owes

| # | Ask | State |
|---|---|---|
| A | **The setting GET under `/api/interface`** | **Answered another way** 2026-11-03: `interfaceThirdParties` plus decision-log #51 |
| — | The mapping GET under `/api/interface` | **Done** 2026-10-15 |
| B | A token that lasts for unattended calls | **Settled** 2026-10-15: the menu token does not expire. Still to confirm: minting a new token does not revoke the old one |
| C | `Inf.PMS.DataBank` View for the menu user, per BU | Configuration, not code. `carmencloud`'s menu user got 403 (2026-10-14) |
| D | The JV number in `interfacePostGL`'s answer | **Answered 2026-11-03.** `ViewPostResult` gained `Id: integer[]` (Swagger 3.241), not `JvhSeq`/`JvhNo`. Empty at 11:52 and 13:30; **filled by 15:13** (E2E P-03: `Id: [1598]` for JV 1598, since voided). Our side: stored in `jv_no` (branch `feat/pms-jv-number`), so the queue's Open JV works. The voucher number (`JvhNo`) is not in it |
| E | What a repeat hook means: Add vs AddOrUpdate | Partly seen: Carmen fires the hook on a Data Bank **Add** (sandbox, 2026-10-14). AddOrUpdate unknown. We re-read any unposted day either way |
| F | Is the gross Summary line intended? (2 × Guest Ledger to the counter) | Open. The nets per account equal the old rule |
| G | The counter when not sent: "not sent" means omitted, or `""`? | We **omit** it (decision-log #51). To prove on `test.PMS` that the engine then fills it; if it answers "Account code is empty", the post retries once with `GEN/1021001` (the user's fallback, built only if needed) |
| — | Data Bank test row Id 146 (breaks `POST …/PMS/search/…` with a 500) | Asked 2026-10-08. Unknown whether it was deleted. We don't call search |
| H | **The PMS setting screen calls our Settings API** (#44): auto-post and Generate key per BU × PMS, sending the non-expiring token, and `pms` exactly as the hook's `InterfaceName` | Open. Replaces CA-115's menu link. From Carmen's **server** (CORS admits only our app), within 20 calls a minute per source IP. Contract: [`PMS_INTEGRATION.md` §6](../PMS_INTEGRATION.md#6-settings-api--your-pms-setting-screen) |
| I | **A list of the PMS kinds**: which send a hook with a Data Bank day, and which Carmen's own post API fetches | **Answered 2026-11-03** by `interfaceThirdParties`'s `From`: `CarmenApi` = the third party sends the day into Carmen (our hook flow); `PartnerApi` = Carmen fetches it from the third party (no Data Bank, no hook: **to build**, decision-log #52, waits on ask L); `null` = a user imports the file (does it land in the Data Bank and fire the hook? ask) |
| J | **Tell users on the PMS setting screen that the AI reads the day's figures** to suggest accounts | Open. A PMS-only BU never sees our consent popup any more (accepted, decision-log #44) |
| K | **Comanche.PMS refuses to post**: every Comanche day answers `Result:false` *"Line No. 30,31 has no DrCr value."*, with or without a counter (2024-07-01 and 2025-10-20, 2026-11-03). The same data (lines 30–31: 933 Refund 35,000.00, Guest Ledger 101,452.80) posts fine on `test.PMS`. **Narrowed 2026-11-09:** the two settings are identical (Revenue INI, balance account `GEN/1021001`, `PostType: Summary`, every other field), and 2024-07-01 posted through `test.PMS` (JV 1612, 18 lines, voided) but was refused again through `Comanche.PMS` after Approve with the AI's accounts. That pointed at Comanche's mapping table, but **2026-11-11 rules the table out.** Comanche.PMS was given test.PMS's exact table: first Comanche's own table less its 991 rows plus test.PMS's accounts, then test.PMS's whole 32-row table. The same day was still refused with the same words. test.PMS, with that same table, posted the day within minutes (JV 1617, 18 lines, Dr = Cr = 319,343.88, voided). So the INI, the balance account, the table and the Data Bank row are all the same, and only the setting's name differs: Carmen's engine treats `Comanche.PMS` differently, and our data cannot fix it. Comanche's table was put back to its 33 rows after each try | **Open: Carmen's to fix. Blocks every real Comanche post.** Evidence for Carmen: the four posts of 2024-07-01 (Data Bank Id 1) on 2026-11-11. Our side records Carmen's words on the day (`carmen_rejected`) and keeps it in the queue |
| L | **List the missing keys when a post is refused for mapping** (decision-log #52): the `-500` answer names each key the mapping table lacks, in that table's own column names, e.g. `"Missing":[{"HT_Code":"4100001","HT_Description":"001 - Room Charge (Auto)","Department":""}]`. Also asked: what a post answers for a date with no data, and whether a PartnerApi post takes a date range with no `id`. (Replaces the dry-run asked on 2026-11-05.) | **Not needed (decision-log #53).** A `-500` post makes Carmen's engine write the day's missing keys into the mapping table itself, with no account. Seen on HotelTime (46 rows) and Cloudbeds (78 rows for 10-26, exactly its `Transaction` keys; 28 more for 10-29, only the new ones). So the missing keys can be read back from Carmen's table without L. The two side questions are answered: no data → `-400 "No Data Found on …"` (`day_not_ready`), and a post without `id` goes by date |
| M | **`interfaceThirdParties` answers 500** on dev since 2026-11-05: *"The best overloaded method match for 'string.IsNullOrWhiteSpace(string)' has some invalid arguments"* (it answered on 2026-11-03) | **Closed 2026-11-06:** it answers 200 again. Its 8 rows are Comanche, Hoteltime and Cloudbeds (REVENUE and STATISTIC, all CarmenApi) and Blueledgers (Inventory, PartnerApi) |
| N | **HotelTime.PMS's balance account is not in carmencloud's chart.** Every HotelTime post answers `ErrorList: "Invalid account codes 1115001"`, even with all 43 keys of 2026-10-06 mapped to valid accounts (E2E N-04, 2026-11-06). **The cause** (setting read with a web JWT, 2026-11-09): the Revenue section's balance account (the counter line, "Select Balance Account") is `GEN/1115001`, with `PostType: Summary`, so every JV gets a balance line on an account carmencloud's chart lacks. It is not the `[Code]` section, as first guessed. `1115001` is also an `HT_Code` value, which made it look like a mapping row. Cloudbeds' balance account `GEN/1115020` is not in the chart either, but its PostType is not Summary, so no balance line is made and it posts fine (JV 1610). Comanche and test.PMS use `GEN/1021001`. Both settings look cloned from a customer whose chart has these accounts | **Closed 2026-11-09: dev test data, not code.** HotelTime's balance account was set to `GEN/1010001` (CASH ON HAND) on Carmen dev. Approving 2026-10-06 in our review with the AI's accounts for its 42 new rows then posted JV 1613 (balanced at 102,433.36, with its balance line on `GEN/1010001`), voided at once. The mapping table was put back as it was. Cloudbeds' `1115020` still needs the same fix before its PostType ever becomes Summary |
| O | **Let the menu token read each PMS's Revenue PostType and balance account** (DeptCode, AccCode, AccDesc), e.g. as fields on the `interfaceThirdParties` rows. Today only a web JWT reads `interfacePost/Setting` (the menu token gets 404 under `/api/interface` and 401 outside) | **To ask (low priority).** Then the review can show where Carmen balances the day and warn, before Approve, when that account is not in the BU's chart. That would have explained N on screen |
| P | **Carmen's preview of a post**: `POST /api/interface/interfacePreviewPostGL/{postType}` (menu token; its twin `/api/interfacePostGL/previewPostGL/{postType}` takes a web JWT), with the same body as `interfacePostGL`. Swagger 3.241 says it answers `ViewPostResult` | **Works on dev since 2026-11-10** (it answered 500 on 2026-11-09 and the morning of 2026-11-10). It answers not `ViewPostResult` but a .NET DataTable named `Mapping`: the mapping table's columns, one row per line of the day keyed as Carmen's engine reads it, with the account the table gives that key (`AccCode` null = unmapped). On five days (test.PMS and Comanche.PMS 2024-07-01, Hoteltime.PMS 2026-10-06, Comanche.PMS 2024-09-01, Cloudbeds.PMS 2026-10-26) its keys equal our reader's (`carmen_config.rows_of`) in value and order, and its unmapped rows equal our new keys (21, 42, 78). `id` is optional (`[0]`, the real Data Bank id, or none all read the day by date), it takes about 0.6 s, it made no JV and wrote nothing into the mapping table, and a closed period answers its error. It does not answer amounts, Dr/Cr, the balance line, an already-posted day (it answers rows), or the post's own refusals (asks K, N): those still come only from the post. **Used since decision-log #54** (PR #357): processing takes the day's rows from it, and our own reader is gone |

Questions from path A that path B made moot: which posting path (Carmen's engine),
debit/credit by `TransactionType` (Carmen's config), and Draft vs Normal (the engine's own JVs
are Normal).

## HotelTime, the second PMS (2026-11-06)

Dev's Data Bank holds HotelTime days 2026-10-01 to 10-06 (Ids 176 to 171).
- **The day:** rows in `Revenue`, with fields `Code`, `Description`, `SegmentName`,
  `AccountNature` (D/C) and `Amount`. `Amount` is a number, missing on some rows; 3 rows have no
  `Code`.
- **The mapping table** `HotelTime.PMS`: columns `HT_Code`, `HT_Description`, `Department`,
  `DeptCode`, `AccCode`, `AccDesc`. It was empty on dev until 2026-11-06. Then Carmen's own
  `-500`s wrote 46 rows with no account, which are kept as evidence for ask L.
- **#51's reader:** `unreadable_day`, because the names differ.
- **Our reader since #53:** keys it as `HT_Code ← Code`, `HT_Description ← Description` and
  `Department` blank. That gives exactly the 46 keys Carmen's engine wrote. The review shows
  HotelTime's own table, its new rows and the AI's picks.
- **The key, by experiment** (PUT variants, then post; table restored to empty, no JV):
  `HT_Code←Code`, `HT_Description←Description`, `Department←""`. Rows with no `Code` are keyed
  `HT_Code` "".
  - With the right keys the post stops at `ErrorList: "Invalid account codes 1115001"`.
    `Code` holds the hotel's own account numbers, which carmencloud's chart lacks: Carmen
    config or test data.
  - An empty table answers `-500 "Mapping is incomplete."`, naming no key.
- **Led to decision-log #52:** Carmen's post is the completeness check, and #51's reader is a
  preview.

## Cloudbeds, the third PMS (2026-11-06)

Dev's Data Bank holds Cloudbeds days 2026-10-26 to 10-29 (Ids 184, 182, 180, 178).
- **The day:** two lists.
  - `Transaction` has 86–91 rows, with `Code`, `Description`, `MarketSegmentCode`/`Desc`,
    `BookingSourceCode`/`Desc`, `MealPeriod`, `Amount`, `TransactionType` (debit/credit),
    `AccountCode` and `DepartmentCode`.
  - `Statistic` has 8 rows (room counts).
- **The mapping table** `Cloudbeds.PMS`: columns `Description`, `MarketSegmentDesc`, `DeptCode`,
  `AccCode`, `AccDesc`. It is empty on dev.
  - Since Carmen's first `-500` on it (2026-11-06), it also declares a key column `Channel`.
    The column stays after the table is emptied, the rows Carmen writes leave it null, and no
    list of the day carries it.
- **Our reader:** before #53, no preview, because both lists carry `Description` and
  `MarketSegmentDesc`.
  - **Since #53** it reads `Transaction`: `Statistic` is another section in Carmen's list, and
    `Channel` is blank.
  - That gives 78 keys, as Carmen wrote them. The review shows Cloudbeds' own table with the
    AI's picks.
- **End to end before #53** (E2E group CB, BU `pms-pc`, 2026-10-26):
  1. The hook parks the day "Ready to post", with no AI call.
  2. Approve gets `-500`, and the day parks `pms_mapping_incomplete`.
  3. Carmen writes the day's **78 `Transaction` keys**, not `Statistic`'s, as rows with no account.
  4. Those rows are mapped to GEN/1021001, as a person would in Carmen's screen.
  5. Approve again, and **Carmen posts JV 1608**: source `CLBS`, 86 lines, Dr = Cr = 79,450.47.
     The queue shows the JV, Open JV links to it, and it was voided at once. JV 1607 from the
     first run was voided the same way.
  6. A second day (10-29, auto-post on) gets `-500`, and Carmen adds only its 28 new keys.
  7. The table is emptied again; Carmen accepts an empty `PUT`.
- **So:** Carmen's engine posts Cloudbeds as it is, with nothing built per PMS.
  - Since #53 the reviewer maps the new keys in our review instead of Carmen's screen.
  - A `-500` the reader did not foresee brings Carmen's own missing keys into the review.

## What we still owe

- **Ship decision-log #51:** deploy the backend (`-xntb`). No migration. Days stuck at
  `carmen_config_unreadable` wake on the next daily token check and park for review. The
  release note and `VERSION` (MINOR) stay batched.
- ~~**The JV number, once Carmen ships D.**~~ Done on branch `feat/pms-jv-number`: `post_day`
  returns `Id[0]`, and `_process` and `review.approve` write it to `pms_events.jv_no`; the
  queue's Open JV needed no change. `JvhNo` (the voucher number) is still not in the answer.
- **The PMS kind that Carmen's post API fetches**, once Carmen's list (I) exists.
- **CA-118:** decide the prod release scope; set `TRUST_PROXY=true` + `TRUSTED_PROXY_HOPS=1`
  on `-xntb`.
- **CA-119 leftovers:** a retention period and purge for `pms_events`; token health for
  PMS-only BUs; wrap `mapping.masters` errors in approve (`500` → `503`).

## What Jira is missing

Things to add to the tickets. Nothing below has been posted yet.

- **CA-119.** The description still describes path A:
  - "map its codes … saved per BU" and "check the balance";
  - the acceptance item "`#/pms` sets the JV prefix";
  - `/gljv` as the posting path.

  Path B replaces all of these (decision-log #43, Draft PR #292). New acceptance items:
  - Approve writes Carmen's table back whole, then the engine posts;
  - Approve opens once every new row has an account; the AI's picks need no separate tick
    (decision-log #47);
  - JV 1142 posted and voided on `test.PMS` (2026-10-14).
- **CA-116.** Comments stop on 2026-10-09. Missing:
  - the 2026-10-14 findings: the sides are per PMS in Carmen's INI; JV 36 equals our rule; the
    PUT replaces the table; the post's answer codes;
  - the 2026-10-15 Discord answers: the mapping GET was added, the token does not expire, the
    counter plan;
  - ask A, answered by `interfaceThirdParties` (decision-log #51); ask I, answered by its `From`.
- **CA-120.** Two acceptance criteria are stale:
  - "picks a JV prefix on `#/pms`" no longer exists;
  - "a JV that Carmen shows with source PMS": the engine's JVs carry Carmen's own source and
    type (JV 1141 was IC / CMRV).
- **CA-118.** Should name path B's order (deploy, then `db push` of `20261015000000`), and
  that #292 joins the release.
- **CA-93.** The 2026-10-09 status table should get a 2026-10-16 row.
- **CA-115.** The menu link to `#/pms` and the pasted key field are gone (#44). It becomes:
  Carmen's PMS setting screen calls `/api/v1/carmen/pms` (auto-post, Generate key) and sends the
  key it gets back on every hook of that PMS.
- **CA-117 / CA-113.** Note that #44 replaced them: no `#/pms`, one key per BU × PMS.
