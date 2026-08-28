r"""IMAP transport for email ingestion — reading the mailbox, nothing about documents.

Split out of `email_ingest_service.py`, which had grown past 1,700 lines with 600 of
them being MIME decoding and IMAP plumbing that the posting pipeline only calls into.
Nothing here touches the database, a session, or a tenant: it turns a mailbox into
`dict`s and puts `\Seen` flags back. `email_ingest_service` owns everything that
decides what a document means and what it costs.

Blocking on purpose — `imaplib` has no async API, so the pipeline runs these in a
thread (`asyncio.to_thread`).
"""

from __future__ import annotations

import email
import imaplib
import io
import logging
import re
import time
import zipfile
from datetime import UTC, datetime, timedelta
from email.header import decode_header, make_header
from email.message import Message
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = (".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic")

# Socket timeout for every IMAP call — see `_connect`. Generous enough for a slow FETCH
# of a 5 MB attachment, short enough that a dead mailbox frees the thread this minute
# rather than never.
IMAP_TIMEOUT_SECONDS = 60

# A legitimate bank mail carries one report, occasionally a few. The cap is against a
# forwarded chain whose signature logos are each their own MIME part — `imap_batch_size`
# limits messages per poll, not attachments per message.
MAX_ATTACHMENTS_PER_MESSAGE = 10

# Google sends one confirmation per forward. More than a handful unseen at once means
# something other than a customer finishing a setup, and it is not this job's problem.
MAX_CONFIRMATIONS_PER_SWEEP = 5

# Envelope headers only. **Never `To:`** — on an auto-forward that is still the
# customer's own address, so reading it would pass a hand-sent test and route every
# real auto-forward nowhere. `Delivered-To` is Gmail's; the other two are for relays
# that do not set it. A multi-hop forward produces several, hence all values, in order.
_DELIVERY_HEADERS = ("Delivered-To", "X-Original-To", "Envelope-To")

# `Received: … for <addr>` records the envelope recipient at the hop that accepted the
# mail, and it is the fallback because **`Delivered-To` is not guaranteed**: measured
# against the live dev mailbox on 2026-08-06, Gmail omits `Delivered-To` entirely when
# sender and recipient are the same account — the mail is accepted at submission
# (`ESMTPSA`) and never traverses the inbound MX hop that stamps it — while the `for`
# clause carried the tagged address verbatim. Genuine external mail had both.
#
# Same trust level as `Delivered-To`: written by a mail server, not by whoever composed
# the message, which is the distinction that keeps `To:` out. An upstream sender can
# fabricate either one, and gains nothing by it — the tag is the capability, so anyone
# who knows one can simply address the mail to it.
_RECEIVED_FOR = re.compile(r"\bfor\s+<([^>]+)>")


# ── IMAP (blocking, run in a thread) ──────────────────────────────────────────


def _decode(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except (UnicodeDecodeError, LookupError, ValueError):
        return value


def _unzip(archive_name: str, blob: bytes, room: int) -> list[tuple[str, bytes]]:
    """The documents inside a bank's zip, as if each had been attached on its own.

    Banks deliver this way — the measured example is one `.zip` holding the e-tax
    invoice PDF, a summary PDF and a CSV. Opening it here rather than deeper in the
    pipeline is what keeps the rest of the feature unchanged: the BU's
    `filename_patterns` then match the *inner* names, so the customer decides which of
    them is a document worth a credit, exactly as they do for a direct attachment.

    Only the archive is opened; a zip inside the zip is left alone (ponytail: no bank
    has been seen doing that, and recursion is where zip bombs live).
    """
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    out: list[tuple[str, bytes]] = []
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            for info in archive.infolist():
                if len(out) >= room:
                    break
                # Zip entries carry paths; the rules match on a filename.
                name = info.filename.replace("\\", "/").rsplit("/", 1)[-1]
                if info.is_dir() or not name.lower().endswith(ALLOWED_EXTENSIONS):
                    continue
                # Declared size, checked before reading: this is the zip-bomb guard, and
                # it is the same ceiling the mail itself is held to.
                if info.file_size > max_bytes:
                    logger.warning("[email] %s in %s exceeds the size cap", name, archive_name)
                    continue
                try:
                    data = archive.read(info)
                except (RuntimeError, zipfile.BadZipFile, OSError) as exc:
                    # Encrypted member, most likely. No tenant is resolved this early, so
                    # the BU's configured passwords are not available here.
                    logger.warning("[email] Could not read %s in %s: %s", name, archive_name, exc)
                    continue
                if data:
                    out.append((name, data))
    except (zipfile.BadZipFile, OSError) as exc:
        logger.warning("[email] %s is not a readable zip: %s", archive_name, exc)
    return out


def _attachments(msg: Message) -> tuple[list[tuple[str, bytes]], list[str]]:
    """`(accepted, rejected)` — the parts we can read, and the names of those we cannot.

    Every allowed-extension part, capped. `walk()` recurses into a message/rfc822 part,
    so a forward-as-attachment still yields the inner PDF under its own name. A `.zip` is
    expanded in place — see `_unzip`. It is not itself a document, so it never reaches the
    cap as one; its contents do.

    **`rejected` is why a customer who forwards an `.xlsx` gets an answer.** Returning
    only the accepted list made a mail whose every attachment is unsupported indis-
    tinguishable from one carrying no file at all — both left `_process_message` on the
    first line, so nothing was written anywhere and `#/admin/email` had nothing to show
    when they asked where their document went. A part with no filename at all is still a
    free silent skip: a bank's "your statement is ready" notice must not fill the ledger.

    A zip that yielded nothing usable is reported under its own name — one answer for
    both "an archive of CSVs" and "an archive we could not open".
    """
    out: list[tuple[str, bytes]] = []
    rejected: list[str] = []
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        filename = _decode(part.get_filename())
        if not filename:
            continue
        is_zip = filename.lower().endswith(".zip")
        if not is_zip and not filename.lower().endswith(ALLOWED_EXTENSIONS):
            rejected.append(filename)
            continue
        payload = part.get_payload(decode=True)
        if not isinstance(payload, bytes) or not payload:
            rejected.append(filename)
            continue
        if is_zip:
            inner = _unzip(filename, payload, MAX_ATTACHMENTS_PER_MESSAGE - len(out))
            out.extend(inner)
            if not inner:
                rejected.append(filename)
        else:
            out.append((filename, payload))
        if len(out) >= MAX_ATTACHMENTS_PER_MESSAGE:
            logger.warning("[email] More than %d attachments — rest ignored", len(out))
            break
    return out[:MAX_ATTACHMENTS_PER_MESSAGE], rejected[:MAX_ATTACHMENTS_PER_MESSAGE]


def unique_names(names: list[str]) -> list[str]:
    """`report.pdf`, `report (2).pdf`, `report (3).pdf` — one name per attachment.

    The ledger dedupes on `(tenant_id, message_id, attachment)`, so a second part named
    the same as the first violated that index, `_claim` returned None, and the document
    was filed "already handled" without ever being looked at. Not hypothetical: `_unzip`
    strips directories, so a bank's `2026/01/report.pdf` and `2026/02/report.pdf` arrive
    as two identical names in one message.

    The suffix goes **before the extension** deliberately — `validate_magic_bytes()` and
    `match_rules()` both read the extension, so a `report.pdf~2` form would fail the
    magic-byte gate on a perfectly good PDF.

    ponytail: no guard against two names that collide only after `_claim` truncates them
    to 255 characters. A 255-character bank filename is not a thing anyone has.
    """
    used: set[str] = set()
    out = []
    for name in names:
        candidate, nth = name, 1
        # Counts up rather than straight to "(2)", so a message that already contains a
        # literal `report (2).pdf` alongside two `report.pdf` cannot land back on a name
        # taken — which would drop the third file exactly the way this function exists to
        # prevent.
        while candidate in used:
            nth += 1
            stem, dot, ext = name.rpartition(".")
            candidate = f"{stem} ({nth}){dot}{ext}" if dot else f"{name} ({nth})"
        used.add(candidate)
        out.append(candidate)
    return out


def _confirmation_body(msg: Message) -> str:
    """The text of a Gmail forwarding-confirmation mail, or "" for anything else.

    Gated on the sender rather than decoded for every message: the only thing we read a
    body for is the confirmation link, and a poll of bank mail is otherwise all
    attachments — decoding each one's HTML signature block to find nothing is work the
    ingest path does not need to do.
    """
    if _GMAIL_CONFIRM_SENDER not in _decode(msg.get("From")).lower():
        return ""
    if not msg.is_multipart():
        return _decode_body(msg)
    return "\n".join(
        _decode_body(part)
        for part in msg.walk()
        if part.get_content_type() in ("text/plain", "text/html")
    )


def _decode_body(part: Message) -> str:
    payload = part.get_payload(decode=True)
    if not isinstance(payload, bytes):
        return ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def _recipients(msg: Message) -> list[str]:
    """Every envelope-recipient candidate, delivery headers first then `Received … for`.

    Order matters only for a multi-hop forward, where the first match wins; both sources
    are the receiving server's own record of the address it accepted the mail for.
    """
    out = [_decode(v) for h in _DELIVERY_HEADERS for v in (msg.get_all(h) or [])]
    out += [
        found.group(1)
        for value in (msg.get_all("Received") or [])
        if (found := _RECEIVED_FOR.search(" ".join(value.split())))
    ]
    return out


def _quoted_folder(name: str) -> str:
    """The mailbox name as an IMAP quoted-string.

    `imaplib` passes command arguments through raw — `_command` concatenates them with
    spaces and quotes nothing — so a Gmail label with a space in it (`AR Agent`, the
    label a filter routes the ingest alias into) would go out as `SELECT AR Agent` and
    the server would reject the whole command. Every poll fails, no document is read,
    and the only symptom is a FAILED row on `#/admin/jobs`.

    Quoted unconditionally: `SELECT "INBOX"` is as valid as `SELECT INBOX`, so there is
    no case to branch on. Surrounding quotes are stripped first, because a value typed
    into a dashboard as `"AR Agent"` and one typed as `AR Agent` must mean the same
    folder — a `.env` file strips them and Render does not.

    ponytail: no escaping of `"` or `\\` inside the name. A Gmail label containing a
    quote character is not a thing anyone has; add it the day someone proves otherwise.
    """
    return f'"{name.strip().strip(chr(34))}"'


def _connect() -> imaplib.IMAP4_SSL:
    """A logged-in mailbox connection, with a socket timeout.

    The timeout is the point. `imaplib` defaults to the global socket timeout, which
    nothing in this app sets, so a mailbox that accepts the TCP connection and then stops
    answering blocks forever — and every IMAP call here runs under `asyncio.to_thread`,
    which cannot be cancelled. One wedged poll would hold a worker thread for the life of
    the process; on the 1-minute confirmation sweep they would accumulate.
    """
    box = imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port, timeout=IMAP_TIMEOUT_SECONDS)
    box.login(settings.imap_user, settings.imap_password)
    return box


# ponytail: a month table rather than `strftime("%b")` — that one is locale-dependent,
# and IMAP dates are ASCII English regardless of what the host is set to.
_IMAP_MONTHS = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")


def since_arg() -> str:
    """The `SEARCH … SINCE` floor, as an IMAP date.

    Bounds the hold-and-retry window. Mail we hand back (`unmark_seen`) stays unseen on
    purpose, so that a BU switched off, out of package or with the module disabled loses
    nothing and replays its backlog the moment it is switched on again. What it must not
    do is accumulate for ever: past this many days a held message drops out of every
    search, costing nothing more, and stays in the mailbox for a person to find.

    Matched on INTERNALDATE (arrival at our mailbox), which never moves — so a message's
    window is fixed the moment it arrives and cannot be extended by re-polling it.
    """
    day = datetime.now(UTC) - timedelta(days=settings.imap_hold_days)
    return f"{day.day:02d}-{_IMAP_MONTHS[day.month - 1]}-{day.year}"


def _arrived_at(fetched: list) -> float | None:
    """A FETCH response's INTERNALDATE as epoch seconds, or None if it carried none.

    Scanned across **every** chunk of the response, not read out of `fetched[0][0]`:
    RFC 3501 lets a server return the data items of one FETCH in any order, and Gmail
    measurably answers `(INTERNALDATE RFC822)` with the RFC822 literal first and
    `INTERNALDATE "…"` in the trailing chunk. Reading only the first chunk returned None
    for every message on the real mailbox — the `enabled_at` filter was inert and no test
    against a hand-built response could see it (measured 2026-08-18, imap.gmail.com).

    None is not a failure: the caller treats it as "do not filter", which processes the
    mail. Guessing an arrival time in either direction would drop real documents.
    """
    for part in fetched:
        chunk = part[0] if isinstance(part, tuple) else part
        if isinstance(chunk, bytes) and (stamp := imaplib.Internaldate2tuple(chunk)):
            # Internaldate2tuple normalises the server's offset to local time, which is
            # what mktime reads back — so the epoch is right whatever zone either side is in.
            return time.mktime(stamp)
    return None


def _uid_search(box: imaplib.IMAP4_SSL, *terms: str) -> list[str]:
    """`UID SEARCH <terms>` as a list of UID strings.

    **UID, not sequence numbers.** `box.search`/`box.fetch`/`box.store` speak message
    sequence numbers, which are per-session and shift down whenever anything is expunged
    from the folder — so a number captured in one connection names a different message in
    the next. `_set_seen` opens its own connection minutes later, which made every
    hand-back a coin flip: the held mail stayed `\\Seen` (lost) while an unrelated message
    was silently marked unread. UIDs are stable for the life of the mailbox, which is what
    this code always assumed it had.
    """
    _, data = box.uid("SEARCH", *terms)
    return [u.decode() for u in (data[0] or b"").split()]


def fetch_unseen(limit: int) -> tuple[list[dict[str, Any]], int]:
    """Pull unseen mail and mark it seen in the same connection.

    Returns the messages and **how many unseen messages fell outside the hold window** —
    see the second search below.

    `SMALLER` filters at the server, before `FETCH` pulls the whole message — including
    every attachment — into this process's memory. That is the byte-size cap the ingest
    path never had: `MAX_FILE_SIZE_MB` is enforced in `file_service.py`, which only the
    interactive upload path calls.

    `SINCE` is the other half of the hold-and-retry behaviour (`unmark_seen`): mail the
    pipeline hands back stays unseen, so without a floor a BU that switches the feature
    off leaves its bank's daily mail in the search result for ever. See `since_arg`.

    Marked seen even when it turns out to be junk: an unattributable message has no
    ledger row to record it, so the IMAP flag is the only thing stopping it from being
    re-read on every poll forever.
    """
    box = _connect()
    try:
        box.select(_quoted_folder(settings.imap_folder))
        max_octets = str(settings.max_file_size_mb * 1024 * 1024)
        since = since_arg()
        # Everything but the date floor, so the unbounded count below differs from this
        # search in exactly one term.
        terms = ["UNSEEN", "SMALLER", max_octets]
        try:
            found = _uid_search(box, "UNSEEN", "SINCE", since, "SMALLER", max_octets)
        except imaplib.IMAP4.error as exc:
            # SMALLER is RFC 3501 mandatory, but a broken server refusing it must not
            # silently mean "no mail today" — that is a total outage with no symptom.
            logger.warning("[email] IMAP SMALLER refused (%s) — searching without it", exc)
            terms = ["UNSEEN"]
            found = _uid_search(box, "UNSEEN", "SINCE", since)

        # The same search minus the date floor, and **no FETCH** — one round trip on the
        # connection that is already open. Past `IMAP_HOLD_DAYS` a message drops out of
        # every poll silently, so a poller outage longer than the window loses real mail
        # with no symptom at all. `SMALLER` is kept so the only difference between the two
        # counts is the date: without it an oversized recent message would be miscounted
        # as beyond-window. Never fatal — this is a counter, not the poll.
        beyond_window = 0
        try:
            beyond_window = max(len(_uid_search(box, *terms)) - len(found), 0)
        except imaplib.IMAP4.error as exc:
            logger.warning("[email] Could not count mail beyond the hold window: %s", exc)

        # **The newest, not the oldest.** SEARCH answers in ascending UID order, so
        # slicing from the front would let held-back mail — which is by definition older
        # than anything arriving now — sit at the head of the queue for ever. `imap_batch_size`
        # is 10: one switched-off BU whose bank mails daily would fill the whole batch
        # within ten days and silently starve every other tenant. Taking the tail means a
        # backlog can only ever use capacity nothing newer wants.
        messages = []
        for uid in found[-limit:]:
            _, fetched = box.uid("FETCH", uid, "(INTERNALDATE RFC822)")
            if not fetched or not isinstance(fetched[0], tuple):
                continue
            msg = email.message_from_bytes(fetched[0][1])
            accepted, rejected = _attachments(msg)
            messages.append(
                {
                    # Carried so the poll can hand a message back (un-`\Seen`) when the
                    # reason it stopped was ours, not the mail's — see `unmark_seen`.
                    "uid": uid,
                    "message_id": (msg.get("Message-ID") or f"no-id-{uid}")[:500],
                    "subject": _decode(msg.get("Subject")),
                    "from": _decode(msg.get("From")),
                    # For the owner-address gate only. `To`/`Cc` are display headers and
                    # are never used to route — see `sender_allowed` and `_recipients`.
                    "people": " ".join(
                        _decode(v) for h in ("From", "To", "Cc") for v in (msg.get_all(h) or [])
                    ),
                    "recipients": _recipients(msg),
                    # Epoch seconds, compared against `email_ingest_settings.enabled_at`.
                    # INTERNALDATE, not the `Date:` header: arrival at *our* mailbox, which
                    # the sender cannot compose, and what `SEARCH … SINCE` already matches.
                    "arrived_at": _arrived_at(fetched),
                    "attachments": accepted,
                    # The names we refused. Carried so a mail whose every attachment is
                    # unsupported still leaves a ledger row — see `_process_message`.
                    "rejected": rejected,
                    # Empty for everything that is not a Gmail confirmation — the only
                    # message whose body we have any use for.
                    "body": _confirmation_body(msg),
                }
            )
            box.uid("STORE", uid, "+FLAGS", "\\Seen")
        return messages, beyond_window
    finally:
        try:
            box.logout()
        except OSError:
            pass


def fetch_confirmations(limit: int = MAX_CONFIRMATIONS_PER_SWEEP) -> list[dict[str, Any]]:
    """Unseen Gmail forwarding-confirmation mail only — the cheap half of `fetch_unseen`.

    Narrowed at the server by sender, so a mailbox full of bank statements costs one
    SEARCH that matches nothing. No `SMALLER` (a confirmation has no attachment), no
    `_attachments()` parse, and **nothing is marked seen here** — the flag is a decision
    the async caller makes after it knows whether the link was followed.

    Same `SINCE` floor and same newest-first slice as `fetch_unseen`, for the same
    reason: a confirmation for a tag nobody is waiting on is never marked seen, and five
    of those would otherwise pin the whole sweep to stale mail permanently.
    """
    box = _connect()
    try:
        box.select(_quoted_folder(settings.imap_folder))
        found = _uid_search(box, "UNSEEN", "SINCE", since_arg(), "FROM", _GMAIL_CONFIRM_SENDER)
        out = []
        for uid in found[-limit:]:
            _, fetched = box.uid("FETCH", uid, "(RFC822)")
            if not fetched or not isinstance(fetched[0], tuple):
                continue
            msg = email.message_from_bytes(fetched[0][1])
            out.append(
                {
                    "uid": uid,
                    "subject": _decode(msg.get("Subject")),
                    "from": _decode(msg.get("From")),
                    "recipients": _recipients(msg),
                    "body": _confirmation_body(msg),
                }
            )
        return out
    finally:
        try:
            box.logout()
        except OSError:
            pass


def _set_seen(uids: list[str], *, seen: bool) -> None:
    """Add or remove `\\Seen` on messages we have decided about. Never raises.

    **This is the connection that made UIDs mandatory** — see `_uid_search`. It opens
    minutes after the one that read the mail, and a sequence number from the earlier
    session names whatever has shifted into that position since.
    """
    if not uids:
        return
    try:
        box = _connect()
        try:
            box.select(_quoted_folder(settings.imap_folder))
            for uid in uids:
                box.uid("STORE", uid, "+FLAGS" if seen else "-FLAGS", "\\Seen")
        finally:
            try:
                box.logout()
            except OSError:
                pass
    except Exception as exc:  # noqa: BLE001 — a flag we could not set is not an outage
        logger.error("[email] Could not set \\Seen=%s on %d message(s): %s", seen, len(uids), exc)


def mark_seen(uids: list[str]) -> None:
    """Flag the messages the sweep has finished with."""
    _set_seen(uids, seen=True)


def unmark_seen(uids: list[str]) -> None:
    """Put mail back the way we found it, so a later poll gets another go at it.

    `fetch_unseen` flags the whole batch on the way in, which is right for everything
    the pipeline reaches a verdict on — but "this BU is out of documents" is not a
    verdict about the mail. Left flagged, a customer who runs out mid-backlog silently
    loses every remaining statement, with no retry anywhere in this feature to save them.
    """
    _set_seen(uids, seen=False)


# ── Routing ───────────────────────────────────────────────────────────────────


def tag_from_recipients(candidates: list[str]) -> str | None:
    """The `+tag` on the address this mail was delivered to, or None.

    Matched against our own configured mailbox, so no other address in the headers can
    produce a tag — including the customer's own, which is what `To:` holds on an
    auto-forward and why `To:` is not among the headers collected.
    """
    user, _, domain = settings.email_ingest_address.partition("@")
    if not domain:
        return None
    pattern = re.compile(
        rf"{re.escape(user)}\+([A-Za-z0-9]{{1,32}})@{re.escape(domain)}", re.IGNORECASE
    )
    for value in candidates:
        if found := pattern.search(value):
            return found.group(1).lower()
    return None


# Setting up an auto-forward in Gmail needs a code Google mails to the *destination*
# and the customer types back into their own Gmail screen. The destination is this
# shared mailbox, which no customer can open — so without this the last step of a
# self-service setup needs one of us to read the mail out to them.
_GMAIL_CONFIRM_SENDER = "forwarding-noreply@google.com"

# "(#123456789) Gmail Forwarding Confirmation - Receive Mail from x@y"
#
# **Expect this to match nothing.** Checked against four real confirmation mails on
# 2026-08-07 — Thai personal Gmail and English Workspace — and none carried a code, in
# the subject or the body. Every real subject opens with a bare "(" where "#code)" used
# to be, which is why the pattern reads as plausible: it only ever matched the fixtures
# we wrote for ourselves. Kept because a code we cannot use costs nothing and Google
# bringing it back costs a deploy; `auto_confirm_forwarding` is what actually works.
_GMAIL_CONFIRM_CODE = re.compile(r"\(#\s*(\d{6,12})\s*\)")

# The confirm link, and **only** the confirm link. The same mail carries an almost
# identical `/mail/uf-…` URL that *cancels* the forward — one letter apart, and
# following the wrong one would silently undo the setup the customer just asked for.
# Anchored on the host and the literal `/mail/vf-` so nothing else in the body matches.
_GMAIL_CONFIRM_LINK = re.compile(r"https://mail-settings\.google\.com/mail/vf-[A-Za-z0-9%\-_\[\]]+")

# Every host the confirmation may touch: it 302s from mail-settings to mail. Checked on
# each hop rather than trusting `follow_redirects`, which would otherwise let a
# redirect walk this request off Google entirely.
_GMAIL_HOSTS = frozenset({"mail-settings.google.com", "mail.google.com"})


def gmail_confirm_code(sender: str, subject: str) -> str | None:
    """The forwarding confirmation code in this message, or None if it is not one.

    The sender is checked, not just the pattern: `(#123456789)` is an unremarkable
    thing for a bank to put in a subject line, and a false positive here would park
    a real document's worth of digits on the settings screen as a "code".
    """
    if _GMAIL_CONFIRM_SENDER not in (sender or "").lower():
        return None
    found = _GMAIL_CONFIRM_CODE.search(subject or "")
    return found.group(1) if found else None


def gmail_confirm_link(body: str) -> str | None:
    """The `vf-` confirmation URL in this mail's body, or None.

    The caller has already established the sender (`_confirmation_body` returns "" for
    anything else), so this only has to pick the right URL out of the three Google puts
    in the mail: the confirm link, the cancel link, and a help-centre article.
    """
    found = _GMAIL_CONFIRM_LINK.search(body or "")
    return found.group(0) if found else None


async def auto_confirm_forwarding(link: str) -> bool:
    """Complete Gmail's handshake by following the link, the way a click would.

    **This is the only mechanism that still works.** Google stopped printing a code, so
    the "paste it into your own Gmail screen" path has nothing to paste; verified end to
    end on 2026-08-07 against a forward that had never been confirmed, which went live
    without anyone touching it.

    Two requests, because the link is not the confirmation: it 302s to an interstitial
    whose whole content is `<form action="" method="post">` with a single button and no
    hidden field or CSRF token. GET renders it, POST to the same URL is the click. Both
    run on one client so the cookies Google sets on the way in are still there.

    Never raises. A poll is mostly about documents, and a confirmation that fails must
    not take down the invoices travelling with it.
    """
    if httpx.URL(link).host not in _GMAIL_HOSTS:
        logger.error("[email] Confirmation link is not a Google host — refused")
        return False
    try:
        async with httpx.AsyncClient(
            timeout=20, follow_redirects=True, headers={"User-Agent": _CONFIRM_USER_AGENT}
        ) as client:
            page = await client.get(link)
            for hop in [*page.history, page]:
                if httpx.URL(str(hop.url)).host not in _GMAIL_HOSTS:
                    logger.error("[email] Confirmation redirect left Google — abandoned")
                    return False
            done = await client.post(str(page.url), data={})
        if done.status_code >= 400:
            logger.error("[email] Gmail refused the confirmation (HTTP %s)", done.status_code)
            return False
        logger.info("[email] Forwarding confirmed automatically")
        return True
    except Exception as exc:
        logger.error("[email] Could not follow the confirmation link: %s", exc)
        return False


# Google serves the interstitial to a default httpx UA as readily as to a browser, so
# this is not evasion — it is the plain identification a form submission is expected to
# carry, kept because an unrecognised client is the first thing an anti-abuse rule drops.
_CONFIRM_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


def sender_allowed(owner_emails: list[str], people: str) -> bool:
    """Does this message involve one of the BU's own addresses? Empty list = yes.

    `people` is `From` + `To` + `Cc` concatenated, matched as a case-insensitive
    substring so the `"Accounting" <a@b.com>` display form needs no parsing — the same
    way `bank_sender_email` is matched.

    All three headers, because the two arrival modes put the customer somewhere
    different: an auto-forward has them in `To:`/`Cc:` (the mailbox the bank wrote to),
    a manual forward in `From:` (the employee who pressed Forward).

    **A second layer, deliberately weaker than the tag.** These headers are composed by
    the sender, so anyone who already knows the tag can also write an address into them;
    the envelope tag is written by a mail server and cannot be. What this reliably stops
    is accidents — a personal Gmail forwarding a document, someone outside the accounting
    team, a document that landed on the wrong tag — which is the common case, not the
    interesting one.

    Empty by default and left that way on purpose: a gate nobody asked for that silently
    refuses real documents is worse than no gate (§2.3 "start broad, narrow later").
    """
    if not owner_emails:
        return True
    haystack = people.lower()
    return any(addr in haystack for addr in owner_emails if addr)


def match_rules(rules: list[dict], sender: str, filename: str) -> list[dict]:
    """This BU's rules that claim this attachment. **Empty means stop** — no LLM call.

    A rule identifies a bank. Both of its conditions must hold, which is stricter than
    either alone: mail from KTC's address carrying a file only the BBL rule names stops
    rather than being scanned as BBL.

        narrow by bank_sender_email  →  matched nothing? keep every rule. A manual
                                        forward carries no bank sender, so this step
                                        must never empty the set.
        filter by filename_patterns  →  nothing left → the caller stops.

    Sender **narrows**, it does not short-circuit: returning on a sender hit without
    looking at the filename would walk straight past the gate.

    Several matches means the BU's patterns overlap. The list is returned rather than a
    winner so the caller can decline to guess the extraction prompt and let the document
    itself say which bank issued it.
    """
    active = [r for r in rules if r.get("is_active", True)]
    sender_l, filename_l = sender.lower(), filename.lower()
    by_sender = [
        r
        for r in active
        if (addr := (r.get("bank_sender_email") or "").lower()) and addr in sender_l
    ]
    # Substring, case-insensitive — `%pattern%`, so the word may sit anywhere in the
    # filename. Deliberately not equality: banks vary their names and employees rename
    # files before forwarding.
    return [
        r
        for r in (by_sender or active)
        if any(p.lower() in filename_l for p in (r.get("filename_patterns") or []) if p)
    ]
