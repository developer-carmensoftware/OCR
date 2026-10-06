"""Email Automation — the pipeline: gate, charge, extract, verify, post one document.

`_run_document` is the whole of it; everything else here is a helper it (or
`_post_input_tax`, its own second half for the statement's input-tax record) calls. See
`ingest.py`'s module docstring for the end-to-end shape this is steps 3 through 7 of —
called once per attachment, from `ingest._process_attachment`.

Imports one-way from `ledger.py` (the ledger row this pipeline claims, parks and finishes)
and is in turn imported by `ingest.py` (the poll loop) and `review.py` (approve is the
second half of this same pipeline, picking up at the review fork). Never imports from
either of those — see codebase-refactor-recursive-scroll.md's stated direction,
`ingest → pipeline → ledger` and `review → pipeline, ledger`.
"""

from __future__ import annotations

import logging
import re
import uuid
from functools import partial
from typing import Any

from app.constants import SETTLEMENT_BANK, DocType, Module, PostType
from app.database import async_session
from app.exceptions import (
    ExtractionError,
    InsufficientCredits,
    ModuleDisabled,
    PdfPasswordRequired,
    ValidationError,
)
from app.models.catalog import Bank
from app.models.schemas import ExtractedCreditCardData
from app.models.schemas.ocr import ExtractedDetailRow, ExtractionWarning
from app.services.credit_card import ar_reconcile as ar_svc
from app.services.credit_card import gl_suggestion as gl
from app.services.credit_card import kbank_tax_summary
from app.services.credit_card import ocr as ocr_service
from app.services.credit_card.accounting_config import description_for, get_accounting_config
from app.services.credit_card.extraction import finalize_extraction, mark_task_failed
from app.services.credit_card.input_tax import build_input_tax_payload
from app.services.credit_card.jv import (
    build_gljv_payload,
    build_jv_rows,
    group_key,
    is_balanced,
    num,
    r2,
    unmapped_payment_types,
)
from app.services.email_automation import credential
from app.services.email_automation import ingest_settings as es
from app.services.email_automation.imap import match_rules, people_addresses, sender_allowed
from app.services.email_automation.ledger import (
    _already_pending,
    _finish,
    _mark_submitted,
    _park_for_review,
    _possibly_posted,
    _review_flags,
)
from app.services.shared import carmen
from app.services.shared.carmen import (
    CarmenAPIError,
    get_account_codes,
    get_departments,
    get_tax_profiles,
)
from app.services.shared.credits import consume_document, refund_document
from app.services.shared.module_gate import assert_module_enabled
from app.services.shared.task import create_task
from app.utils.bank_detect import detect_bank_code
from app.utils.gl_filter import parse_default_account
from app.utils.image_processing import validate_magic_bytes
from app.utils.pdf_utils import ensure_pdf_openable

logger = logging.getLogger(__name__)

# The stops that say nothing about the document itself: the BU has nothing left to spend,
# or the module is switched off for them. Both are somebody's to reverse, so both hand the
# mail back unread rather than spending a ledger row — and a ledger row is exactly what
# would make it unrecoverable, since `_claim` dedupes on (tenant, message, attachment).
_HOLD = (InsufficientCredits, ModuleDisabled)

# The merchant in KBANK's commission tax invoice's own name,
# `E-TAX_INVOICE_CARD_<merchant>_<tax invoice>_<date>.PDF` — the fallback when the page's
# was not read, for finding this invoice's row in its zip's tax summary.
_KBANK_FEE_FILE_MERCHANT = re.compile(r"E-TAX_INVOICE_CARD_(\d{6,})_", re.I)


class _Skip(Exception):
    """Not an error — this document will not be posted *unattended*. Carries a contract
    reason_code.

    Carries no refund flag on purpose: once the vision model has run, the document is
    charged whatever happens next. Every `_Skip` is raised either before the charge (so
    there is nothing to refund) or after extraction succeeded (so the LLM cost is already
    real) — see the refund boundary in `_run_document`.

    It does carry `reviewable`, which is a different axis and the one that decides where the
    row lands. A `_Skip` raised after a successful extraction describes a *decision* about a
    document we read and were paid for, so the reading is worth keeping and the document
    parks for a human — see `_park_or_finish`. The flag exists for the one case where that
    is false even though the money was spent: a second copy of something already sitting in
    the queue. The reviewable copy is already there, and parking this one would put two
    identical rows in front of the reviewer, which is exactly what raising it prevented.
    """

    def __init__(self, reason_code: str, message: str, *, reviewable: bool = True):
        self.reason_code = reason_code
        self.reviewable = reviewable
        super().__init__(message)


def _carmen_verdict(result: Any) -> str:
    """What Carmen actually said about a document it would not file.

    Nobody reviews these before they post, so the ledger row *is* the support ticket:
    "Carmen rejected the JV" — the old text — names only the fact that there was a
    verdict. Carmen puts its reason in `UserMessage`, sometimes in `InternalMessage`,
    and its framework puts framework-level refusals in `Message`; the `Code` is worth
    keeping even when all three are empty, because "Code 1 with no message" is a
    different support conversation from "Code 1: Insufficient balance".

    This *is* the queue's Detail cell for the row (WITH_DETAIL in lib/reviewReasons), not
    a suffix to one, so it has to name who spoke and stand on its own — and say it once.
    """
    body = result if isinstance(result, dict) else {}
    said = str(body.get("UserMessage") or body.get("InternalMessage") or body.get("Message") or "")
    if said:
        return f"Carmen: {said}"
    return f"Carmen refused it, no reason given (Code {body.get('Code')})"


def _resolve_bank(extracted: ExtractedCreditCardData, rule_bank: str | None) -> str | None:
    """Which bank issued this document: what it says, else what the rule guessed.

    The document outranks the rule because the rule is a filename substring and the
    document is the printed issuer. When they disagree the rule's patterns are catching
    another bank's files — say so on the document itself: the reviewer sees it as the
    amber banner, and it is the only place a mis-scoped pattern is visible before it has
    posted a JV against the wrong vendor.
    """
    detected = detect_bank_code(
        model_bank_code=extracted.bank_code,
        bank_company_name=extracted.bank_company_name,
        bank_name=extracted.bank_name,
        company_name=extracted.company_name,
        doc_name=extracted.doc_name,
    )
    if detected and rule_bank and detected != rule_bank:
        extracted.warnings.append(
            ExtractionWarning(code="bankMismatch", params={"rule": rule_bank, "detected": detected})
        )
    return detected or rule_bank


async def _run_document(
    *,
    ledger_id: uuid.UUID,
    tenant_id: str,
    sender: str,
    people: str,
    filename: str,
    blob: bytes,
    owner_emails: list[str],
    rules: list[dict],
    passwords: list[str],
    carmen_token: str,
    carmen_uri: str,
    auto_post: bool,
    tax_summary: dict[str, dict[str, str]] | None = None,
) -> str:
    """Gate, charge, extract, verify, post — every exit lands on the ledger.

    Two things stop a document one step short of Carmen and park it at `pending_review`
    instead: `auto_post` being off, and — with it on — anything `_review_flags` has to say
    about the document. Everything above that fork is identical either way, so a document
    that reaches a human has already survived every gate a machine can judge.

    **`auto_post` posts what is ready to post.** Not everything that got this far: a reading
    with warnings, lines that do not reconcile, a GL rule the AI invented, or a statement
    whose number could not be read are all questions, and a question goes to the queue no
    matter which mode the BU is in. The switch buys a BU freedom from approving the
    *ordinary* document, which is most of them, and never freedom from the doubtful one.

    **A failure after the extraction parks too.** The charge follows the vision call
    (decision-log #17), so by the time any of the later gates can refuse — a foreign tax ID,
    an unmappable payment type, a Carmen refusal — the customer has already paid for a
    reading we are holding in memory. Finishing those as `failed` threw that reading away
    and left re-scanning the same file by hand as the only recovery. `_park_or_finish` below
    is the whole of that rule: charged and read means reviewable.
    """
    charged: str | None = None
    task_id: str | None = None
    bank_code: str | None = None
    # What the vision call returned, held for the handlers at the bottom of this function.
    # `None` there means the model never produced anything for this document, which is the
    # line between a row a human can work and a row that is only a record of a failure.
    extracted: ExtractedCreditCardData | None = None
    # Did the AI have to invent a GL mapping on the way past? Only knowable here, and the
    # queue needs it to tell a reviewer which documents are worth opening.
    mapping_guessed = False
    # WHICH rules it invented and what it put in them. The keys are what the review screen
    # marks for checking — marking every rule because one was guessed is the same as
    # marking none — and the values are what it *shows*, since 2026-09-04 nothing
    # writes them to the BU's config until a human approves, so there is nowhere else for
    # the reviewer to read them from.
    mapping_suggested: dict[str, dict[str, str]] = {}
    # Payment types nothing could map — the AI included. With review on these park instead
    # of failing, so the reviewer sees them as empty cells to fill rather than never seeing
    # the document at all.
    mapping_missing: list[str] = []
    # Recorded on failures too: "several BUs failing on the same issuer at once" is the
    # only early warning that a bank changed its form, and it cannot be computed if a
    # failed row forgets which bank the document came from.
    doc_no: str | None = None
    # Which of the two KBANK documents this is — decided by the rule below, before the
    # charge. Initialised here so `_park_or_finish` can read it on any path.
    doc_type: str = DocType.FEE_INVOICE
    # AR only: how the credit side groups — saved from the mapping page.
    ar_post_type: str = PostType.DETAIL
    # AR only: the settlement report's own page prints no tax ID, so its second factor
    # comes from the CSV sidecar instead — set below, read by `_review_flags`. True when
    # there was no matching sidecar row, not when one was checked and found fine.
    tin_unverified = False
    tax_summary = tax_summary or {}

    async def _park_or_finish(reason_code: str, error: str, *, reviewable: bool = True) -> str:
        """Where a refusal lands: the queue if we have a paid-for reading of the document,
        the ledger if we do not.

        A closure rather than a module function because it reads eight locals that only
        exist here, and every one of them is the answer at the moment of failure rather than
        at the moment of parking.

        `charged is None` is the pre-LLM gates — the customer's own filename and sender rules
        answering "not this file", which cost nothing and leave nothing to review.
        `extracted is None` is a failure inside the refund boundary: the money went back, so
        there is no reading and no charge to honour.
        """
        if charged is not None and extracted is not None and reviewable:
            await _park_for_review(
                ledger_id,
                extracted=extracted,
                task_id=task_id,
                bank_code=bank_code,
                doc_no=doc_no,
                flags=_review_flags(
                    extracted,
                    mapping_guessed=mapping_guessed,
                    mapping_missing=mapping_missing,
                    doc_type=doc_type,
                    tin_unverified=tin_unverified,
                ),
                mapping_suggested=mapping_suggested,
                mapping_missing=mapping_missing,
                reason_code=reason_code,
                error=error,
                doc_type=doc_type,
            )
            logger.warning("[email] %s: %s (%s) — parked for review", reason_code, error, filename)
            return "pending_review"
        # The gates that run before a credit is charged are the customer's own configuration
        # answering "not this file", not a failure of ours. Filing them as `failed` would put
        # a red row on Carmen's screen for a signature logo.
        status = "skipped" if charged is None else "failed"
        await _finish(
            ledger_id,
            status=status,
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            reason_code=reason_code,
            error=error,
            # `reviewable=False` is a second copy of something already in the queue. Failed,
            # because it was charged (`skipped` means free), but silent: the copy the
            # customer can act on is waiting in the queue, whose own bell already rang.
            notify=reviewable,
        )
        logger.warning("[email] %s: %s (%s)", reason_code, error, filename)
        return status

    try:
        # Coarsest question first, and free: is this even from someone this BU accepts?
        # Before match_rules so mail that is not theirs at all is not filed under the
        # narrower "your pattern was too tight" reason.
        if not sender_allowed(owner_emails, people):
            # Naming what arrived is the whole value of this row. Without it a typo in a
            # registered address is indistinguishable from a broken feature — see
            # `people_addresses`. Five is enough to spot the near-miss without pasting a
            # forwarded chain's entire Cc into the dialog.
            seen = ", ".join(people_addresses(people)[:5]) or "no readable address"
            raise _Skip(
                "sender_not_allowed",
                "None of this BU's registered addresses appear in From/To/Cc — "
                f"this mail carries {seen}",
            )
        matched = match_rules(rules, sender, filename)
        if not matched and match_rules([{**r, "is_active": True} for r in rules], sender, filename):
            # A file the BU's own switched-off rule names is theirs, not noise: turning a
            # bank off is the per-bank form of turning the feature off — they are keying it
            # by hand. Same code and same visible row as `ingest_paused` at message level,
            # so the queue lists what arrived instead of hiding it as `no_rule_match`.
            raise _Skip(
                "ingest_paused",
                "Arrived while this bank's rule was switched off — key this one by hand",
            )
        if not matched:
            # A too-narrow pattern silently dropped real documents before the tag named
            # the tenant. Now the miss is a row in *this BU's* ledger, diagnosable from
            # #/admin — and it costs nothing, which is what removes the whole
            # signature-logo class of junk from the spend.
            raise _Skip("no_rule_match", f"No rule matches {filename}")
        # A rule says which files are worth scanning. It does NOT say which bank issued
        # one: `filename_patterns` is a substring test and `.pdf` is a documented escape
        # hatch, so one broad rule is the sole match for every other bank's documents and
        # used to label all of them itself — and pick their extraction layout. Kept only
        # as the fallback for a document whose issuer cannot be read at all.
        rule_bank = matched[0].get("bank_code") if len(matched) == 1 else None
        # Standing guess, so a row that fails before extraction still names an issuer for
        # the "several BUs failing on the same bank" signal. Replaced by the document's
        # own answer the moment there is one.
        bank_code = rule_bank

        # ── Which document is this? ───────────────────────────────────────────
        #
        # The only place the pipeline branches on document type, and it is here — before
        # the charge — because the two types need different prompts, different pages and
        # different JV builders, and reading one with the other's layout produces
        # plausible rows off the wrong table rather than an error.
        #
        # The *rule* answers it, not the document: a settlement report and the commission
        # invoice for the same settlement both say KASIKORNBANK at the top and carry the
        # same tax invoice number, so nothing on the page distinguishes them reliably. The
        # BU says which of their mail is which by tagging the rule; the filename pattern
        # (`KB1P554V2`) is what makes that tagging easy.
        ar_rule = next(
            (r for r in matched if r.get("doc_type") == DocType.AR_RECONCILE),
            None,
        )
        doc_type = DocType.AR_RECONCILE if ar_rule else DocType.FEE_INVOICE
        if ar_rule:
            bank_code = (ar_rule.get("bank_code") or "").upper() or None
            if not bank_code:
                raise _Skip(
                    "ar_reconcile_disabled",
                    "The settlement-report rule does not say which bank it is for",
                )
            # The rule is the switch (2026-09-29): an active `ar_reconcile` rule means
            # reconcile this bank, and there is no second toggle to consult. Switching it
            # off is deactivating the rule, which `match_rules` already skips —
            # `ingest_paused`, free, before the charge, same as the old toggle was.
            # How it groups is the BU's own choice on the mapping page, not the rule's.
            ar_post_type = await _ar_post_type(tenant_id, bank_code)
        # No fee-invoice double-book guard here (deleted 2026-09-29): `match_rules` gives
        # KBANK's two files to the KBANK rule alone (2026-10-05, decision-log #37), so while
        # it reconciles, no rule — an "Other" `.pdf` one included — can read the commission
        # tax invoice beside the settlement report that already books it.

        # Before any charge: a disguised, locked or corrupt file must not cost anything.
        password = await _open_or_fail(blob, filename, passwords)

        # `module_id` still splits by document type — `daily_usage_summary` reports a
        # settlement report's cost apart from a fee invoice's, and `ocr_tasks.module_id`
        # is the only place that answers "how many settlement reports has this tenant
        # processed" (CLAUDE.md: count with SUM(charged_docs), never COUNT(ocr_tasks),
        # but the grouping column is this one). The *gate* does not split any more
        # (decision #1, 2026-09-22): a settlement report is part of the credit-card
        # module now, not a switchable add-on, so a BU with credit_card_ocr enabled can
        # process one regardless of whether cc_ar_reconcile's row was ever turned on.
        # `modules.is_active = false` for cc_ar_reconcile keeps it off
        # #/admin/quota-modules' switch list while the id keeps meaning something.
        module_id = (
            Module.CC_AR_RECONCILE if doc_type == DocType.AR_RECONCILE else Module.CREDIT_CARD_OCR
        )
        await assert_module_enabled(Module.CREDIT_CARD_OCR)
        charged = await consume_document()

        # ── The refund boundary ───────────────────────────────────────────────
        #
        # This block is the ONLY place in the pipeline that refunds. Everything in it
        # can fail without the model ever having run — a dead pool connection on
        # `create_task`, an OpenRouter socket that never opened — and that is our
        # failure to deliver, not work the customer received. So it is given back.
        #
        # Once `finalize_extraction` returns, the vision call has been made and billed
        # to us. From there on the document is charged whatever happens next: a
        # duplicate, a foreign tax ID, an unmappable GL account and a Carmen refusal
        # are all decisions taken *about a document we successfully read*, not failures
        # to read it. That is the whole rule, and it is why `_Skip` carries no refund
        # flag — see the handlers at the bottom of this function.
        try:
            async with async_session() as db:
                task = await create_task(
                    db,
                    tenant_id=tenant_id,
                    module_id=module_id,
                    original_filename=filename,
                    carmen_user_id=None,
                    charged_docs=1 if charged else 0,
                )
                task_id = str(task.id)

            # The first money of the document, and the tenant and task are already known —
            # so `log_llm_usage` inserts a fully attributed row rather than needing the
            # tenant-less parking buffer the tax-ID design forced on it.
            # No bank: the combined auto-detect prompt, always. A filename cannot pick a
            # layout — reading a GHL invoice with the KBANK layout mismaps its columns AND
            # makes it answer "ธนาคารกสิกรไทย", which then confirms the wrong bank to
            # every later reader.
            #
            # The settlement report is the exception to both halves of that. Its layout is
            # *selected* (the rule already named the bank, and there is only one prompt per
            # bank for it), and its figures are on the LAST page — the earlier pages repeat
            # the same money per terminal and per batch. Still one page, so still one
            # document charged.
            extracted = await ocr_service.extract_stateless(
                file_bytes=blob,
                original_filename=filename,
                task_id=task_id,
                pdf_password=password,
                bank_code=bank_code if doc_type == DocType.AR_RECONCILE else None,
                doc_type=doc_type,
                page_indexes=[-1] if doc_type == DocType.AR_RECONCILE else None,
            )
            # Resolved once, before finalize_extraction, so `credit_cards.bank_code` and
            # `email_documents.bank_code` are the same decision rather than two. The AR
            # path keeps the rule's answer: its prompt was chosen from it, so re-deriving
            # it from the page could only disagree with the layout already applied.
            if doc_type != DocType.AR_RECONCILE:
                bank_code = _resolve_bank(extracted, rule_bank)
            extracted = await finalize_extraction(
                extracted,
                task_id,
                tenant_id,
                bank_code,
                None,
                doc_type=doc_type,
                original_filename=filename,
            )
        except Exception as exc:
            if charged:
                await refund_document(charged)
            if task_id is not None:
                await mark_task_failed(task_id, exc)
            # Dropped rather than left half-assigned: `extract_stateless` may have returned
            # before `finalize_extraction` threw, and `_park_or_finish` reads this to decide
            # whether there is a paid-for reading worth parking. The money just went back,
            # so there is not — and making that true by construction beats making it true by
            # tracing which handler this re-raise happens to reach.
            extracted = None
            raise

        doc_no = extracted.doc_no

        # `is_duplicate` below reads `credit_cards.submitted_at`, which stays NULL for the
        # whole time a document sits in the review queue. So a second copy — the bank
        # re-sends, or someone forwards it twice — sails past that check and parks a second
        # identical row for the reviewer to notice by eye.
        #
        # Ingest-side only, deliberately: `has_submitted_doc` is shared with the wizard,
        # where a pending row means nothing and blocking on one would stop a user scanning
        # a document they are holding in their hand.
        #
        # Unconditional, deliberately. It read `not auto_post` while a BU with review off
        # could not park anything; decision #51 ended that, and a clean-only `auto_post`
        # parks routinely — so the gate that was theoretical there is now on the main path.
        #
        # Checked ahead of the GL-mapping call below, deliberately: this is the one
        # post-extraction skip that does NOT park, so nobody will ever see a suggestion for
        # it — it stays ahead of that call's LLM spend rather than paying for one.
        if await _already_pending(tenant_id, bank_code, doc_no, doc_type):
            # The one post-extraction skip that does NOT park. Its twin is already in the
            # queue, editable and postable; a second identical row is the thing this check
            # exists to prevent, not a second chance at anything.
            raise _Skip(
                "duplicate_document",
                "A copy is already waiting for review",
                reviewable=False,
            )

        # The settlement report's own page prints no tax ID at all (decision #28), so for
        # AR it has nothing of its own to check below — the CSV sidecar supplies one by
        # merchant ID instead. A sidecar with no matching row is not a conflict (the same
        # "positive evidence only" rule `foreign_tax_id` already follows for a fee invoice
        # that never prints the buyer's TIN) — it sets `tin_unverified` instead, which
        # blocks auto-post without refusing a document that is probably fine.
        tax_ids_to_check = list(extracted.tax_ids or [])
        if doc_type == DocType.AR_RECONCILE:
            merchant = kbank_tax_summary.digits_only(extracted.merchant_id)
            csv_row = tax_summary.get(merchant) if merchant else None
            if csv_row and csv_row.get("tax_id"):
                tax_ids_to_check.append(csv_row["tax_id"])
            else:
                tin_unverified = True
            if csv_row:
                # Same sidecar row, a second independent check: the CSV's own fee/VAT/net
                # and tax invoice number against what the report printed. A disagreement
                # parks the document via the existing `warnings` flag — see
                # `kbank_tax_summary.cross_check`.
                extracted.warnings.extend(
                    kbank_tax_summary.cross_check(csv_row, extracted.doc_no, extracted.total_row)
                )
        elif bank_code == SETTLEMENT_BANK and tax_summary:
            # KBANK's commission tax invoice, read beside its zip's tax summary when one came
            # (2026-10-05). The same two checks, minus `tin_unverified`: this document prints
            # its own TIN, so a missing CSV costs it nothing. Its merchant is read off the page,
            # else off the file's name (`E-TAX_INVOICE_CARD_<merchant>_…`).
            merchant = kbank_tax_summary.digits_only(extracted.merchant_id) or (
                m.group(1) if (m := _KBANK_FEE_FILE_MERCHANT.search(filename)) else ""
            )
            csv_row = tax_summary.get(merchant) if merchant else None
            if csv_row:
                if csv_row.get("tax_id"):
                    tax_ids_to_check.append(csv_row["tax_id"])
                # Fee and VAT only: an invoice's total is fee + VAT, not the CSV's net.
                total = lambda field: str(  # noqa: E731
                    r2(sum(num(getattr(d, field)) for d in extracted.details))
                )
                extracted.warnings.extend(
                    kbank_tax_summary.cross_check(
                        csv_row,
                        extracted.doc_no,
                        ExtractedDetailRow(
                            commis_amt=total("commis_amt"), tax_amt=total("tax_amt")
                        ),
                    )
                )

        async with async_session() as db:
            config = await get_accounting_config(db, tenant_id, bank_code)
            # The second factor. The envelope said who owns this mail; if the document
            # carries a number registered to someone else, the two disagree and that stops
            # the post rather than picking a winner.
            conflict = await es.foreign_tax_id(db, tax_ids_to_check, tenant_id)

        # The document's own verdict, decided here and raised after the GL suggestion
        # below. Decided first so that nothing about *this BU's credential* can outrank
        # it: a dead token used to make the suggester's 401 park a foreign-TIN document
        # as `carmen_unauthorized`, and the reviewer never learned the tax ID was wrong
        # (F-6, 2026-09-24 QA).
        if conflict:
            # Support's copy, not the reviewer's — the queue prints the phrase alone for
            # this code. "Registered to another BU" is dropped: a BU's register holds an
            # array of tax IDs, so one missing from it has failed to match and nothing
            # stronger than that has been established.
            verdict = _Skip("tax_id_mismatch", f"Tax ID {conflict} is not in this BU's register")
        elif extracted.is_duplicate:
            # This *is* the queue's cell, not a tail on one (WITH_DETAIL in
            # lib/reviewReasons), so it is capitalised and stands alone. The two duplicate
            # kinds share one reason_code and are told apart here: this copy is redundant
            # because the document is in Carmen already, which is nothing for anyone to do.
            verdict = _Skip("duplicate_document", "Already posted to Carmen")
        elif near := await _possibly_posted(tenant_id, doc_no, extracted.doc_date):
            # Same cell as the two above (WITH_DETAIL), so it stands alone and names the
            # number the reviewer has to look up in Carmen before approving.
            verdict = _Skip(
                "duplicate_document",
                f"Possibly already posted to Carmen as {near} — same date, overlapping number",
            )
        else:
            verdict = None

        if doc_type == DocType.AR_RECONCILE:
            # No AI suggestion on this path: a suggestion nobody has read must not become a
            # saved rule, and only the review screen's approve step writes this bank's
            # settlement keys (decision #3, 2026-09-22). Extending the fee invoice's
            # guess-then-approve dance to a second document type is a separate decision
            # from collapsing the storage, not a consequence of it.
            mapping_missing = unmapped_payment_types(
                extracted.details,
                config.mappings or {},
                grouping=partial(group_key, post_type=ar_post_type),
            )
            missing: list[str] = []
        else:
            missing = unmapped_payment_types(extracted.details, config.mappings or {})
        if missing:
            # Parking every document of a BU that never opened the mapping page, with
            # empty pickers and no starting point, is the worse failure. So the AI fills
            # the gap and the reviewer is handed an answer to check rather than a blank
            # form — which is the whole of what this call buys. It does not decide
            # anything: `mapping_guessed` below parks the document either way.
            #
            # Runs ahead of raising the verdict, deliberately: both verdicts still park the
            # document for review (see `_Skip.reviewable`), and a parked document with an
            # unmapped payment type deserves the same suggestion a clean one gets, instead
            # of the blank pickers a `raise` upstream used to leave it with.
            try:
                suggested = await _suggest_missing_mappings(missing, bank_code, carmen_token)
            except CarmenAPIError:
                # Only a dead credential escapes the suggester. With no verdict it is the
                # honest reason and the handler below parks on it; with one, the credential
                # is still flagged for the BU but the document keeps its own reason.
                if verdict is None:
                    raise
                await _flag_dead_token(tenant_id, carmen_token)
                suggested = {}
            if suggested:
                # In memory only. Saving it here made the guess the BU's own rule before
                # anyone had looked at it, so the *second* document carrying that payment
                # type was no longer "guessed" and auto-posted on a mapping no human ever
                # confirmed (KTC and SiamPay did exactly that, JV 1023 and 1026). The write
                # moved to `approve_document`: a human confirming it once is what turns a
                # suggestion into a rule, which is also what makes the review happen once
                # per payment type rather than once per document.
                config.mappings = {**(config.mappings or {}), **suggested}
                mapping_guessed = True
                mapping_suggested = suggested
            mapping_missing = unmapped_payment_types(extracted.details, config.mappings or {})
            # Never terminal, under either setting: the review screen maps in place, so a
            # document the AI could not map is a question for the reviewer rather than a
            # dead end. It falls through to the fork below, where `mapping_missing` is a
            # flag — which both parks it and names the unmapped fields on the row.
            #
            # Changed 2026-08-31 for review mode; the `auto_post` half of the branch went
            # when auto-post narrowed to clean documents, since a gap in the GL mapping is
            # the plainest case of a document that is not one. Before that, the whole BU's
            # odd payment types died here and someone had to find the mapping page.

        if verdict:
            raise verdict

        if doc_type == DocType.AR_RECONCILE:
            # One dict now (decision #3): commission/tax/net and this bank's credit-side
            # keys both live in `config.mappings`. The debit legs still read it off the
            # report's own total row, not derived from the credit rows — `is_balanced`
            # below is therefore a real check: it compares that row's own COMM+VAT+NET
            # against Σ THB AMT over the grouped rows, two independent readings of the
            # same page. See `jv.build_jv_rows`'s docstring.
            rows = build_jv_rows(
                extracted.details,
                config.mappings or {},
                total_row=extracted.total_row,
                grouping=partial(group_key, post_type=ar_post_type),
            )
        else:
            rows = build_jv_rows(extracted.details, config.mappings or {})
        if not rows or not any(r["credit"] for r in rows):
            # Zero-total document: posting an empty JV is worse than stopping here.
            # The read itself succeeded, so the charge stands.
            raise _Skip("unreadable_document", "Document has no postable amounts")

        # `carmen_unauthorized`, not `carmen_rejected`: nothing is wrong with the
        # document, and the fix is a credential on the settings screen rather than a
        # figure on the invoice. Same bucket as a 401 from the post itself, below.
        if not carmen_token:
            raise _Skip("carmen_unauthorized", "No Carmen posting credential for this BU")
        if not carmen_uri:
            # Park with the honest reason. Without this the RuntimeError from
            # carmen_service._base_url falls through to the generic handler and the
            # document is filed as unreadable, which sends everyone looking at the PDF.
            raise _Skip("carmen_unauthorized", "No Carmen host known for this BU")

        # ── The review fork ───────────────────────────────────────────────────────────
        #
        # Here and not earlier: every gate a machine can judge has now passed, so a
        # document that reaches the queue is one a human can actually act on. Parking
        # before the GL step would fill the queue with documents whose only problem is a
        # missing mapping the AI was about to fill by itself.
        #
        # Here and not later: `build_gljv_payload` + `post_gljv` is the step that writes to
        # someone's books, and it is the only thing this fork skips. Nothing above it has
        # touched Carmen.
        #
        # The credit is already spent (`consume_document`, far above). Approving or
        # rejecting later must not refund — decision-log #17: the charge follows the vision
        # call, not the outcome.
        #
        # **`auto_post` posts what is ready to post, not everything that got this far.**
        # `_review_flags` is the queue's own answer to "why might this be worth opening",
        # and it is the gate as well as the row's reason line — deliberately one predicate,
        # so a document the reviewer would have been shown a reason for can never post
        # behind their back. Before this, a reading with warnings, a JV whose lines did not
        # reconcile, or a GL rule the AI invented on the way past all reached the customer's
        # ledger exactly like a clean one, and the flags were computed and then only looked
        # at if review happened to be on.
        flags = _review_flags(
            extracted,
            mapping_guessed=mapping_guessed,
            mapping_missing=mapping_missing,
            doc_type=doc_type,
            ar_unbalanced=(not is_balanced(rows) if doc_type == DocType.AR_RECONCILE else False),
            tin_unverified=tin_unverified,
        )
        if not auto_post or flags:
            await _park_for_review(
                ledger_id,
                extracted=extracted,
                task_id=task_id,
                bank_code=bank_code,
                doc_no=doc_no,
                flags=flags,
                mapping_suggested=mapping_suggested,
                mapping_missing=mapping_missing,
                doc_type=doc_type,
            )
            logger.info(
                "[email] Parked %s (%s) for review, tenant %s%s",
                doc_no,
                filename,
                tenant_id,
                f" — {', '.join(flags)}" if auto_post else "",
            )
            return "pending_review"

        payload = build_gljv_payload(
            rows,
            doc_date=extracted.doc_date,
            doc_no=extracted.doc_no,
            bank_code=bank_code,
            config=config,
        )
        result = await carmen.post_gljv(payload, carmen_token)
        if not result or result.get("Code", -1) != 0:
            raise _Skip("carmen_rejected", _carmen_verdict(result))

        await _mark_submitted(tenant_id, task_id)

        # The statement's second Carmen document (wizard step 4). Deliberately after
        # the JV and deliberately unable to fail it: the JV is already in Carmen's
        # books and there is no rollback, so a missing input-tax record is recorded
        # for a human to add rather than turned into a failure on a document that
        # posted successfully.
        #
        # The settlement report files this claim itself now (decision #28): the fee
        # invoice that used to is no longer processed once AR reconciliation covers a
        # bank, so its VAT would otherwise disappear rather than double up. Its own
        # per-scheme rows print no commission/VAT (dashes on the page) — only
        # `total_row` does — so that is what `_post_input_tax` sums instead.
        ar_input_tax_details = [extracted.total_row] if extracted.total_row else []
        tax_error = await _post_input_tax(
            extracted,
            bank_code=bank_code,
            config=config,
            carmen_token=carmen_token,
            details=ar_input_tax_details if doc_type == DocType.AR_RECONCILE else None,
        )

        await _finish(
            ledger_id,
            status="posted",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            jv_no=str(result.get("InternalMessage") or ""),
            error=tax_error,
        )
        logger.info("[email] Posted %s (%s) for tenant %s", extracted.doc_no, filename, tenant_id)
        return "posted"

    except _Skip as skip:
        # No refund here, ever. A `_Skip` raised before the charge has nothing to give
        # back; one raised after it comes from a document the model already read, and
        # that reading is what the credit paid for. The refund boundary above owns the
        # only case where money goes back.
        #
        # And because that reading was paid for, it is kept: `_park_or_finish` sends a
        # post-extraction refusal to the review queue rather than to the ledger. What used
        # to be six dead red rows — a foreign tax ID, a duplicate, an unmappable payment
        # type, a document with no postable amount, a missing credential, a Carmen refusal —
        # are now six documents a human can correct and post.
        return await _park_or_finish(skip.reason_code, str(skip), reviewable=skip.reviewable)
    except _HOLD as stop:
        # Out before the generic handler below, which would file this as
        # `unreadable_document` — sending whoever debugs it to look at a PDF that is
        # perfectly fine, and putting a red `document_failed` in the customer's bell for
        # a module *we* switched off. Nothing was charged at either point (both gates run
        # ahead of `consume_document`), so there is nothing to refund and no row to finish.
        logger.warning("[email] Tenant %s: %s — mail held unread", tenant_id, stop)
        raise
    except CarmenAPIError as exc:
        # Either a transport failure or a real HTTP status from Carmen. Neither refunds:
        # the JV's fate is unknown, so a human decides after checking Carmen — and now the
        # document is parked where that human already works, rather than filed away where
        # the only remaining option was to key it in by hand.
        #
        # The transport case is the one that carries a risk, and it is a risk the approve
        # path already takes: `_mark_submitted` never ran, so `has_submitted_doc` cannot
        # catch a JV that landed just as the socket died, and a reviewer who approves
        # without checking Carmen can post it twice. Same wording as the 503 that path
        # returns, so the caveat travels with the row.
        #
        # 401/403 is separated out because it is not a verdict on this document at all —
        # every document of this BU will fail the same way until someone re-pastes the
        # token, and the person who does that is not the person reading the invoice. Parked
        # all the same: every document that arrived while the credential was dead becomes
        # postable the moment it is replaced, instead of a day of scanning burnt.
        unauthorized = exc.status_code in (401, 403)
        if unauthorized:
            await _flag_dead_token(tenant_id, carmen_token)
        note = (
            str(exc)
            if unauthorized
            else f"{exc} — check whether the JV posted before approving this document"
        )
        return await _park_or_finish(
            "carmen_unauthorized" if unauthorized else "carmen_rejected", note
        )
    except Exception as exc:
        # Anything reaching here from *inside* the refund boundary was already refunded
        # and re-raised there; refunding again would hand back a second credit for one
        # document. Anything reaching here from after it is post-extraction and keeps
        # its charge like every other late failure.
        #
        # **This one does not park, and that is deliberate.** Every other post-extraction
        # refusal is a decision the pipeline reached on purpose and stopped short of
        # Carmen for. This is an unhandled bug, and it can fire *after* `post_gljv`
        # returned zero — `_mark_submitted` and `_post_input_tax` both run past that
        # point. Parking a document whose JV is already in Carmen's books would offer a
        # reviewer an Approve button that posts it a second time.
        #
        # `unreadable_document` is the honest-but-broad reason for an unclassified
        # failure, so the exception's own type goes in the message: without it every
        # bug in this pipeline reads as "your PDF is bad" and sends the reader to a
        # file that is perfectly fine.
        await _finish(
            ledger_id,
            status="failed",
            task_id=task_id,
            bank_code=bank_code,
            doc_no=doc_no,
            reason_code="unreadable_document",
            error=f"{type(exc).__name__}: {exc}",
        )
        logger.exception("[email] Failed on %s", filename)
        return "failed"


# ── Input tax (the statement's second Carmen document) ────────────────────────


async def _post_input_tax(
    extracted: ExtractedCreditCardData,
    *,
    bank_code: str | None,
    config: Any,
    carmen_token: str,
    overrides: Any = None,
    details: list[ExtractedDetailRow] | None = None,
) -> str | None:
    """File the VAT the bank charged. Returns a note to keep on the ledger, or None.

    **One prefix, "Input tax not recorded", shared with `build_input_tax_payload`'s own skip
    reasons.** The two halves used to disagree ("JV posted; input tax not recorded: …" here,
    "input tax skipped: …" there) and both land in the same cell, appended to a phrase that
    has already said the JV posted — so the old head restated the row and the reader had two
    spellings of one outcome to learn.

    Never raises. The JV it follows is already in Carmen's books, so the only useful
    answers here are "done" and "someone needs to add this by hand" — turning a
    failure into an exception would mark a document Carmen has already accepted as
    failed, which is the one outcome that is plainly wrong.

    **`details` overrides `extracted.details`** for the settlement report: its per-scheme
    rows print no commission/VAT of their own (dashes on the page), only the report's own
    `total_row` does — see decision #28. Every other caller leaves this `None` and gets
    `extracted.details`, unchanged from before this parameter existed.
    """
    async with async_session() as db:
        bank = await db.get(Bank, bank_code) if bank_code else None

    try:
        payload, skipped = build_input_tax_payload(
            details if details is not None else extracted.details,
            doc_no=extracted.doc_no,
            doc_date=extracted.doc_date,
            bank=bank,
            # The branch printed on the statement, which is the field the review screen
            # shows and lets a reviewer correct. Falling straight through to the BU config
            # made that input theatre: whatever was typed went into `extracted` and was
            # then dropped here. Config stays the fallback for a document with none.
            branch=extracted.branch_no or getattr(config, "branch", None),
            description=description_for(config, bank_code),
            tax_profiles_raw=await get_tax_profiles(carmen_token),
            # `getattr` rather than a branch: the auto-post path passes nothing, and
            # None answers all three the same way the reviewer leaving them alone does.
            vendor_name=getattr(overrides, "vendor_name", None),
            tax_id=getattr(overrides, "tax_id", None),
            profile_code=getattr(overrides, "profile_code", None),
        )
        if payload is None:
            if skipped:
                # A claim that should have been made and was not. Kept on the ledger
                # rather than only in a log line, because nothing else would ever
                # tell the customer the VAT is theirs to add by hand.
                logger.warning("[email] %s (%s)", skipped, extracted.doc_no)
            return skipped
        result = await carmen.post_input_tax(payload, carmen_token)
    except Exception as exc:
        logger.exception("[email] Input tax failed for %s", extracted.doc_no)
        return f"Input tax not recorded: {exc}"

    if not result or result.get("Code", -1) != 0:
        message = _carmen_verdict(result)
        logger.error("[email] Input tax rejected for %s: %s", extracted.doc_no, message)
        # Em dash, not a colon: `message` is `_carmen_verdict` and already opens "Carmen:".
        return f"Input tax not recorded — {message}"

    logger.info("[email] Input tax recorded for %s", extracted.doc_no)
    return None


# ── AR reconciliation grouping ────────────────────────────────────────────────


async def _ar_post_type(tenant_id: str, bank_code: str) -> str:
    """Detail or Summary for this bank, as the mapping page saved it (Detail if never)."""
    async with async_session() as db:
        return await ar_svc.post_type_for(db, tenant_id, bank_code)


# ── GL mapping the BU never set ───────────────────────────────────────────────

# `unmapped_payment_types` speaks the config's keys; the suggester speaks the
# wizard's labels. Same three fields (useMappingSuggestions.ts `suggestKeyMap`).
_FIXED_LABEL = {
    "commission": "Credit card commission",
    "tax": "Input Tax",
    "net": "Bank Account",
}


async def _flag_dead_token(tenant_id: str, carmen_token: str) -> None:
    """Mark this BU's posting credential unproven after Carmen refused it (401/403)."""
    try:
        async with async_session() as db:
            await credential.mark_token_unverified(db, tenant_id, carmen_token)
    except Exception:  # never let the flag cost us the ledger row
        logger.exception("[email] Could not flag the credential for tenant %s", tenant_id)


async def _suggest_missing_mappings(
    missing: list[str], bank_code: str | None, carmen_token: str
) -> dict[str, dict[str, str]]:
    """AI-fill the mappings this BU has none for, using the wizard's own suggester.

    Only pairs where both codes survived validation against Carmen's master (and the
    dept's DefaultAccount rule) are returned — a half-filled mapping would post a JV
    line with a blank account.
    """
    if not carmen_token:
        return {}
    try:
        accounts_raw = await get_account_codes(carmen_token)
        depts_raw = await get_departments(carmen_token)
    except CarmenAPIError as exc:
        # 401/403 is not "the master is unavailable", it is "this BU's stored posting
        # credential is dead" — and every document of theirs will fail the same way until
        # someone re-pastes it. Swallowed, it surfaced as one row reading *mapping missing*,
        # which sends the reader to the mapping page instead of to the credential, while
        # `mark_token_unverified` never ran and the bell said nothing (seen on carmencloud,
        # 2026-09-04). Re-raised, `_run_document` flags the token and parks the document
        # with the honest reason — the credential, unless the document already has a verdict
        # of its own (foreign tax ID, already posted), which outranks it.
        if exc.status_code in (401, 403):
            raise
        logger.warning("[email] Could not read Carmen GL master for suggestions: %s", exc)
        return {}

    accounts = [
        {
            "code": a["AccCode"],
            # Both names: the suggester's Thai keywords (ลูกหนี้, บัตร, วีซ่า) live in Description2.
            "name": " · ".join(filter(None, (a.get("Description"), a.get("Description2")))),
            "type": (a.get("Type") or "").lower(),
        }
        for a in (accounts_raw.get("Data") or [])
        if a.get("AccCode") and a.get("AccCode") != "AccCode"
    ]
    departments = [
        {
            "code": d["DeptCode"],
            "name": d.get("Description") or "",
            "allowed_accounts": sorted(parse_default_account(d.get("DefaultAccount"))),
        }
        for d in (depts_raw.get("Data") or [])
        if d.get("DeptCode") and d.get("DeptCode") != "CodeDep"
    ]

    out: dict[str, dict[str, str]] = {}
    if fixed := [m for m in missing if m in _FIXED_LABEL]:
        result = await gl.suggest_fixed_fields(accounts, departments)
        sugg = (result.output or {}).get("suggestions") or {}
        out.update({key: sugg.get(_FIXED_LABEL[key]) or {} for key in fixed})
    if dynamic := [m for m in missing if m not in _FIXED_LABEL]:
        result = await gl.suggest_payment_types(
            payment_types=dynamic, accounts=accounts, departments=departments, bank_code=bank_code
        )
        out.update((result.output or {}).get("suggestions") or {})

    filled = {k: v for k, v in out.items() if v.get("dept") and v.get("acc")}
    logger.info("[email] AI filled %d/%d missing GL mapping(s)", len(filled), len(missing))
    return filled


# ── Opening the file ──────────────────────────────────────────────────────────


async def _open_or_fail(blob: bytes, filename: str, passwords: list[str]) -> str | None:
    """Open the file, returning the password that worked (None = not encrypted).

    Runs before the credit is charged, so nothing here costs the customer anything.

    The magic-byte check is the gate the ingest path never had: `ensure_pdf_openable`
    is a no-op for anything that is not a PDF, so an `.jpg` that is really a text file
    used to reach the vision model and be paid for.

    Every one of *this BU's* configured passwords is tried, because overlapping rules
    can leave the issuing bank ambiguous. They are all the same customer's.
    """
    try:
        validate_magic_bytes(blob, filename)
    except ValueError as exc:
        raise _Skip("unreadable_document", str(exc)) from exc

    last: Exception | None = None
    for pwd in [None, *passwords]:
        try:
            await ensure_pdf_openable(blob, filename, pwd)
            return pwd
        except (PdfPasswordRequired, ValidationError) as exc:
            last = exc
        except ExtractionError as exc:
            # The bytes are wrong, not the password, so the remaining passwords cannot
            # help. Raised as a _Skip rather than left to the generic handler, which
            # files everything as `failed` — and nothing has been charged at this point.
            # A junk attachment must not put a red row on the customer's screen.
            raise _Skip("unreadable_document", str(exc)) from exc
    raise _Skip("wrong_pdf_password", str(last or "Could not open the attachment"))
