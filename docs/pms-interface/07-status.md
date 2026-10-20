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
| [CA-119](https://carmen-ac.atlassian.net/browse/CA-119) | In Progress | Processing: hook → JV, billing gate, payload retention | Path A merged (#286, #287) and live on QA. **Path B built: Draft PR #292**, blocked on Carmen's setting GET. Retention purge not built |
| [CA-116](https://carmen-ac.atlassian.net/browse/CA-116) | To Do | [Carmen + us] Agree on the data schema, volume and corrections | Most of it settled (#41, #43). **One blocker left: the setting GET.** See [Carmen asks](#what-carmen-still-owes) |
| [CA-115](https://carmen-ac.atlassian.net/browse/CA-115) | To Do | [Carmen] Menu link to `#/pms`, a key field in PMS settings, sending hooks | **The hook is sent:** on dev, a Data Bank Add fired our hook about 10 s later (sandbox, 2026-10-14; it carried no valid key, so it got 401). One hook from `carmencloud` arrived on 2026-10-09. **Changed by #44:** no menu link any more. Carmen's PMS setting screen calls our Settings API (auto-post, Generate key) and sends the key it gets back. Contract: [`PMS_INTEGRATION.md` §6](../PMS_INTEGRATION.md#6-settings-api--your-pms-setting-screen) |
| [CA-118](https://carmen-ac.atlassian.net/browse/CA-118) | To Do | Release CA-93 to prod | Phase 1 is on QA only. Open: the prod release scope (prod has lacked migrations since 2026-09-02), `TRUST_PROXY` on QA, and now path B's deploy-then-push order |
| [CA-120](https://carmen-ac.atlassian.net/browse/CA-120) | To Do | The first real end to end with Carmen | Blocked on CA-115 and CA-118 (and CA-119 path B). A simulated pre-run passed on 2026-10-07 |

Dependency chain: CA-113 → CA-117 → CA-118 → CA-120 ← CA-115; CA-116 → CA-119 → CA-120.

## What blocks the merge

**`GET /api/interface/interfacePost/Setting/GL` (or `Setting/{code}/GL`) answers 404 with the
menu token.** The route exists only for Carmen's web JWT, which we never hold. Without it,
processing cannot learn:
- which setting posts the day (its `Code`), and whether it is `IsActive`;
- the REVENUE section's INI: where the rows are (`JsonKeys`), what keys the mapping table
  (`Mapping_MapCode`), and the amount field;
- the counter account, which the post requires today.

So every day stops at `carmen_config_unreadable`. Hard-coding the counter (`GEN/1021001`)
would not unblock anything, because the INI is still unread.

On 2026-10-15 Carmen's developer said the setting GET looked hard to add. If Carmen will not
add it, the user has to choose between two options:
- keep each PMS's layout on our side, which bends #43's "no rules of our own";
- or Carmen exposes the INI some other way.

Our code calls `{interface}/interfacePost/Setting/GL` already (`carmen._PMS_CONFIG_PATH`), so
the day Carmen adds it, nothing changes here.

## What Carmen still owes

| # | Ask | State |
|---|---|---|
| A | **The setting GET under `/api/interface`** (above) | **Open. The blocker** |
| — | The mapping GET under `/api/interface` | **Done** 2026-10-15 |
| B | A token that lasts for unattended calls | **Settled** 2026-10-15: the menu token does not expire. Still to confirm: minting a new token does not revoke the old one |
| C | `Inf.PMS.DataBank` View for the menu user, per BU | Configuration, not code. `carmencloud`'s menu user got 403 (2026-10-14) |
| D | The JV number in `interfacePostGL`'s answer | **In progress (Carmen agreed 2026-10-20; we wait).** Today a post answers `{"Result":true,"Code":1,"RecordCount":1,"UserMessage":"Posting complete."}` with no number, so the queue has no Open JV (`/glJv/{seq}/show`), and the menu token gets 401 on `glJv/search`, so we cannot look it up. Asked for `JvhSeq` + `Prefix` + `JvhNo` on `Result:true`, and a list when one post makes several JVs (a `DateFrom`–`DateTo` range) |
| E | What a repeat hook means: Add vs AddOrUpdate | Partly seen: Carmen fires the hook on a Data Bank **Add** (sandbox, 2026-10-14). AddOrUpdate unknown. We re-read any unposted day either way |
| F | Is the gross Summary line intended? (2 × Guest Ledger to the counter) | Open. The nets per account equal the old rule |
| G | The counter when not sent: "not sent" means omitted, or `""`? | Carmen plans to fill it from its config after 2026-10-19. Ask which form it takes |
| — | Data Bank test row Id 146 (breaks `POST …/PMS/search/…` with a 500) | Asked 2026-10-08. Unknown whether it was deleted. We don't call search |
| H | **The PMS setting screen calls our Settings API** (#44): auto-post and Generate key per BU × PMS, sending the non-expiring token, and `pms` exactly as the hook's `InterfaceName` | Open. Replaces CA-115's menu link. From Carmen's **server** (CORS admits only our app), within 20 calls a minute per source IP. Contract: [`PMS_INTEGRATION.md` §6](../PMS_INTEGRATION.md#6-settings-api--your-pms-setting-screen) |
| I | **A list of the PMS kinds** (the same for every BU): which send a hook with a Data Bank day, and which Carmen's own post API fetches | Open (Carmen offered it, 2026-10-16). The second kind gets its own plan once it exists |
| J | **Tell users on the PMS setting screen that the AI reads the day's figures** to suggest accounts | Open. A PMS-only BU never sees our consent popup any more (accepted, decision-log #44) |

Questions from path A that path B made moot: which posting path (Carmen's engine),
debit/credit by `TransactionType` (Carmen's config), and Draft vs Normal (the engine's own JVs
are Normal).

## What we still owe

- **Merge #292 once A lands**, in this order: deploy, then `db push`
  ([05-operations.md](05-operations.md#releasing-path-b-pr-292)). Add the batched release note
  and bump `VERSION` (MINOR). `feat/pms-carmen-settings` (#44) is stacked on it and merges
  with it: its migration `20261016000000` revokes every key, so Carmen's screen (H) must be
  ready to generate new ones.
- **The JV number, once Carmen ships D:** `post_day` (`services/pms/process.py`) returns the
  answer's `JvhSeq`, and `_process` and `review.approve` write it to `pms_events.jv_no` instead
  of `None`. The queue's Open JV already reads `jv_no`, so the UI needs no change. Add a
  `test_pms_process.py` case for the new answer shape.
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
  - every AI pick is ticked or replaced before Approve;
  - JV 1142 posted and voided on `test.PMS` (2026-10-14).
- **CA-116.** Comments stop on 2026-10-09. Missing:
  - the 2026-10-14 findings: the sides are per PMS in Carmen's INI; JV 36 equals our rule; the
    PUT replaces the table; the post's answer codes;
  - the 2026-10-15 Discord answers: the mapping GET was added, the token does not expire, the
    counter plan;
  - the one ask left: the setting GET.
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
