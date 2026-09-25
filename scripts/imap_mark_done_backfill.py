"""One-off: bring an existing ingest mailbox onto the `$OcrDone` queue. Run once per mailbox,
before the poll that reads `NOT KEYWORD $OcrDone` is deployed against it.

    python scripts/imap_mark_done_backfill.py                 # dry run: counts only
    python scripts/imap_mark_done_backfill.py --apply
    python scripts/imap_mark_done_backfill.py --apply --seen-as-done

Why it exists. The poll used to take `SEARCH UNSEEN` as its queue; it now takes "everything
without `email_imap.DONE_FLAG`" (F-1, 2026-09-24 QA — a person reading the mailbox made
mail vanish). On the first poll after deploy, nothing in the mailbox carries the flag yet, so:

  * mail **older than the hold window** would all count as `beyond_window` and raise the
    `email_ingest_beyond_window` alert for years of history. No poll can ever process it
    (it is outside `SINCE`), so marking it done is simply true. **This is the default.**
  * mail **inside the window** is left alone on purpose. The first polls re-read it,
    newest first, and anything already decided costs nothing — `_claim` dedupes on
    (tenant, message, attachment) — while anything the old queue lost because someone had
    marked it read is found and processed. That recovery is the point of the fix.

`--seen-as-done` also marks every `\\Seen` message inside the window done: exactly the old
behaviour, no re-reading, and no recovery. Use it where re-reading two weeks of mail is not
wanted (it would re-evaluate every in-window mail once; mail to tags that no longer resolve
counts toward the per-poll `unrouted` alert).

Idempotent: it only ever adds the flag, and only to mail that lacks it. Dry run by default.
Reads IMAP_HOST / IMAP_USER / IMAP_PASSWORD / IMAP_FOLDER / IMAP_HOLD_DAYS from
backend/.env — the same mailbox the app polls, so point that file at the mailbox you mean.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from app.config import settings  # noqa: E402
from app.services.email_imap import (  # noqa: E402
    DONE_FLAG,
    _connect,
    _quoted_folder,
    _uid_search,
    since_arg,
)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--apply", action="store_true", help="actually set the flag")
    ap.add_argument(
        "--seen-as-done",
        action="store_true",
        help="also mark \\Seen mail inside the hold window done (no re-reading, no recovery)",
    )
    args = ap.parse_args()

    if not settings.imap_host:
        print("[abort] IMAP_HOST is empty — ingestion is disabled for this environment")
        return 2

    since = since_arg()
    print(f"mailbox  {settings.imap_user} @ {settings.imap_host}")
    print(f"folder   {settings.imap_folder!r}")
    print(f"window   SINCE {since} ({settings.imap_hold_days} days)\n")

    box = _connect()
    try:
        box.select(_quoted_folder(settings.imap_folder))
        pending = ["NOT", "KEYWORD", DONE_FLAG]
        old = _uid_search(box, *pending, "BEFORE", since)
        in_window = _uid_search(box, *pending, "SINCE", since)
        seen_in_window = _uid_search(box, *pending, "SEEN", "SINCE", since)
        print(f"  older than the window, not done   {len(old):>6}  -> mark done")
        print(f"  inside the window, not done       {len(in_window):>6}  ", end="")
        if args.seen_as_done:
            print(f"-> {len(seen_in_window)} of them \\Seen will be marked done")
        else:
            print(
                f"-> left for the poll ({len(seen_in_window)} of them \\Seen: re-read once)"
            )

        targets = old + (seen_in_window if args.seen_as_done else [])
        if not args.apply:
            print(f"\ndry run: {len(targets)} message(s) would be flagged {DONE_FLAG}")
            return 0
        for uid in targets:
            box.uid("STORE", uid, "+FLAGS", f"({DONE_FLAG})")
        print(f"\nflagged {len(targets)} message(s) {DONE_FLAG}")
        return 0
    finally:
        try:
            box.logout()
        except OSError:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
