"""The mailbox purge (decision-log #50) against the REAL dev Gmail — under a throwaway label only.

    python scripts/qa/mailbox_purge_live.py                       # imap.purge_expired directly
    python scripts/qa/mailbox_purge_live.py --endpoint URL         # through POST …/email-ingest/purge
                                                                   # (a backend run with IMAP_FOLDER
                                                                   #  set to the label; job token)

What a fake mailbox cannot prove: Gmail's own MOVE, its `\\Trash` folder, and how its
`SEARCH BEFORE` treats INTERNALDATE at the hold window's edge. Three mails are APPENDed to
the label `E2E-PURGE-TEST` with chosen INTERNALDATEs — the day before the floor, the floor
day, today — and the real purge runs on that label alone:

    L-1 a dry run counts only the day-before mail, and moves nothing
    L-2 the real run moves it to [Gmail]/Trash
    L-3 the floor-day mail and today's stay (the floor is the poll's SINCE: still searchable)
    L-4 a second run moves nothing
    (--endpoint) L-5 the run wrote a job_runs row (read back through the admin Jobs API)

Then everything it added is deleted for good (Trash included) and the label removed. The
mailbox's real mail (the ingest label) is never selected. Mailbox = backend/.env's IMAP_*.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]  # scripts/qa/this.py -> repo root
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import imaplib  # noqa: E402

from app.config import settings  # noqa: E402
from app.services.email_automation import imap  # noqa: E402

LABEL = "E2E-PURGE-TEST"
RUN = uuid.uuid4().hex[:8]
results: list[tuple[str, str, bool, str]] = []


def check(cid: str, name: str, ok: bool, detail: str = "") -> None:
    results.append((cid, name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'} {cid} {name}{f'  ({detail})' if detail else ''}")


def _floor() -> datetime:
    """Noon UTC on the date `since_arg()` names — the poll's SINCE floor."""
    day = datetime.strptime(imap.since_arg(), "%d-%b-%Y")
    return day.replace(hour=12, tzinfo=UTC)


def _mail(tag: str) -> bytes:
    return (
        f"From: e2e@example.co.th\r\nTo: {settings.imap_user}\r\n"
        f"Subject: {LABEL} {RUN} {tag}\r\nMessage-ID: <{RUN}-{tag}@purge.e2e>\r\n\r\n"
        f"throwaway mail for the purge test ({tag})\r\n"
    ).encode()


def _subjects(box, folder: str) -> set[str]:
    box.select(imap._quoted_folder(folder))
    uids = imap._uid_search(box, "SUBJECT", RUN)  # one token: imaplib quotes nothing
    found = set()
    for uid in uids:
        _, data = box.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (SUBJECT)])")
        raw = b"".join(p[1] for p in data if isinstance(p, tuple)).decode(
            errors="replace"
        )
        found.add(raw.strip().rsplit(" ", 1)[-1])
    return found


def seed(box) -> None:
    box.create(imap._quoted_folder(LABEL))  # "already exists" is fine
    floor = _floor()
    for tag, when in (
        ("old", floor - timedelta(days=1)),
        ("edge", floor),
        ("new", datetime.now(UTC)),
    ):
        typ, _ = box.append(
            imap._quoted_folder(LABEL),
            None,
            imaplib.Time2Internaldate(when),
            _mail(tag),
        )
        assert typ == "OK", f"APPEND {tag}: {typ}"


def cleanup(box, trash: str | None) -> None:
    """Gone for good: to the Trash, then deleted there; then the label. Matches every run's
    mail, not only this one's, so a run that died before cleaning up is cleaned by the next."""
    box.select(imap._quoted_folder(LABEL))
    left = imap._uid_search(box, "SUBJECT", LABEL)
    if left and trash:
        box.uid("MOVE", ",".join(left), trash)
    if trash:
        box.select(trash)
        gone = imap._uid_search(box, "SUBJECT", LABEL)
        if gone:
            box.uid("STORE", ",".join(gone), "+FLAGS", "(\\Deleted)")
            box.expunge()
    box.select("INBOX")
    box.delete(imap._quoted_folder(LABEL))


def _post(url: str, dry_run: bool) -> dict:
    req = urllib.request.Request(
        f"{url}/api/v1/carmen/email-ingest/purge?dry_run={'true' if dry_run else 'false'}",
        method="POST",
        headers={"Authorization": f"Bearer {settings.internal_job_token}"},
    )
    with urllib.request.urlopen(req, timeout=120) as res:  # noqa: S310 — our own local backend
        return json.loads(res.read())


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--endpoint", help="a backend whose IMAP_FOLDER is the test label"
    )
    args = parser.parse_args()
    if not settings.imap_host:
        sys.exit("[abort] IMAP not configured in backend/.env")
    print(
        f"mailbox {settings.imap_user} · label {LABEL} · run {RUN} · floor {imap.since_arg()}"
    )

    box = imap._connect()
    trash = imap._trash_folder(box)
    try:
        seed(box)
        settings.imap_folder = (
            LABEL  # imap.purge_expired selects this; the real label is never touched
        )
        if args.endpoint:
            dry = _post(args.endpoint, True)["messages"]
            moved = _post(args.endpoint, False)["messages"]
            again = _post(args.endpoint, False)["messages"]
        else:
            dry = imap.purge_expired(dry_run=True)
            moved = imap.purge_expired()
            again = imap.purge_expired()

        check(
            "L-1",
            "a dry run counts only the mail from before the floor",
            dry == 1,
            f"counted {dry}",
        )
        check("L-2", "the real run moved it", moved == 1, f"moved {moved}")
        in_label, in_trash = (
            _subjects(box, LABEL),
            _subjects(box, trash) if trash else set(),
        )
        check(
            "L-2",
            "...to [Gmail]/Trash",
            "old" in in_trash and "old" not in in_label,
            f"trash={sorted(in_trash)}",
        )
        check(
            "L-3",
            "the floor-day and today's mail stay",
            in_label == {"edge", "new"},
            f"label={sorted(in_label)}",
        )
        check("L-4", "a second run moves nothing", again == 0, f"moved {again}")
        if args.endpoint:
            check(
                "L-5",
                "the run is recorded in job_runs",
                _job_recorded(args.endpoint),
                "",
            )
    finally:
        cleanup(box, trash)
        box.logout()
    print(f"cleaned up: run {RUN} mail deleted, label removed")
    failed = [r for r in results if not r[2]]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed")
    return 1 if failed else 0


def _job_recorded(url: str) -> bool:
    """The newest email-mailbox-purge row on the backend's DB, via the admin Jobs API."""
    from app.auth.admin_session import create_admin_jwt
    from app.services.admin.auth import get_admin_jwt_secret

    token = create_admin_jwt(
        "e2e", "e2e", ["e2e"], ["tenants:read"], get_admin_jwt_secret(), ttl_hours=1
    )
    req = urllib.request.Request(
        f"{url}/api/v1/admin/jobs?limit=20",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=60) as res:  # noqa: S310 — our own local backend
        rows = json.loads(res.read()).get("data", [])
    fresh = time.time() - 600
    return any(
        r.get("job_name") == "email-mailbox-purge"
        and r.get("rows_affected") == 1
        and datetime.fromisoformat(r["started_at"]).timestamp() > fresh
        for r in rows
    )


if __name__ == "__main__":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    sys.exit(main())
