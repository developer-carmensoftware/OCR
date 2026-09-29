export const en = {
  // -- Review queue: the automation landing page (#/CreditCardOCR) -------------
  // One name for the module, on the queue and on the wizard alike. The page has no heading
  // of its own — the chip strip is it — so this is the only place either page is named.
  'review.title': 'AI JV Automation',
  'review.back': 'Back',
  'review.refresh': 'Refresh',
  'review.close': 'Close',
  // A dash, not "Book": the field is labelled Prefix and its values are book names, so the
  // word sat in the control reading exactly like a chosen one. The wizard's own config
  // badge has always printed `-` for an unset prefix (`AccountingReview`).
  'review.fPrefixPlaceholder': '-',
  'review.fPrefix': 'Prefix',
  'review.fDescription': 'Description',
  'review.prefixRequired': 'Choose a prefix before posting',
  'review.fDescriptionPlaceholder': 'Description',
  'review.itxShow': 'Show details',
  'review.itxHide': 'Hide details',
  // Carmen's own column headings for the three amounts it will show once this record posts
  // (BfTaxAmt / TaxAmt / TotalAmt). English in both dictionaries, like Dept and Tax ID: the
  // reviewer matches these against the ERP they are posting to, and translating them makes
  // that harder. `Tax` rather than `VAT` for the same reason — it is Carmen's word.
  'review.itxNet': 'Net Amount',
  'review.itxTax': 'Tax',
  'review.itxTotal': 'Total',
  'review.itxVendor': 'Vendor',
  'review.itxVendorHint': 'Registered name',
  'review.itxTaxId': 'Tax ID',
  // `InvhTInvNo` / `InvhTInvDt`, named as the record names them. English in both
  // dictionaries for the same reason the three amounts above are.
  'review.itxTInvNo': 'Tax invoice no.',
  'review.itxTInvDt': 'Tax invoice date',
  'review.itxPeriod': 'Tax period',
  'review.itxProfile': 'Tax profile',
  'review.itxNoIdentity':
    'This bank has no registered tax identity, so Carmen will refuse the record.',
  'review.itxRateOff':
    'The document works out at {ratio}%, which is not the {rate}% profile it would be filed under.',
  'review.fDocNo': 'Document no.',
  'review.fDocDate': 'Document date',
  'review.fBranch': 'Branch',
  'review.fMissing': 'Not on the document',
  'review.openJv': 'Open JV in Carmen',
  'review.unknownBank': 'Unknown',
  // -- Review screen: the JV pane, where GL rules are corrected in place ------
  'review.paneDocument': 'What the document says',
  'review.paneJv': 'What will post',
  'review.jvLoading': 'Loading your GL accounts',
  'review.jvNoConfig': 'This business unit has no accounting configuration yet.',
  'review.jvDept': 'Dept',
  'review.jvAccount': 'Account',
  'review.jvDesc': 'Comment',
  'review.jvLineOf': '{field} line {line}',
  'review.jvDebitFor': 'Debit for {field}',
  'review.jvCreditFor': 'Credit for {field}',
  'review.jvSharedHint':
    'Summed from {count} lines — changing this shares the new figure across them',
  'review.jvDebit': 'Debit',
  'review.jvCredit': 'Credit',
  'review.jvDeptPlaceholder': 'Department',
  'review.jvAccountPlaceholder': 'Account',
  'review.jvDeptFor': 'Department for {field}',
  'review.jvAccountFor': 'Account for {field}',
  'review.jvDescFor': 'Comment for {field}',
  'review.jvDeptFilter': '{count} accounts allowed for {dept}',
  'review.jvGuessed': 'AI',
  'review.jvGuessedHint': 'The AI chose this account when the document arrived. Check it.',
  'review.jvAllBanks': 'Every bank',
  'review.jvAllBanksHint':
    'Commission, input tax and the bank account are one rule for this business unit — approving sets them for every bank, not just this one.',
  'review.jvUndo': 'Undo',
  'review.jvBalanced': 'Balanced',
  'review.jvImbalanced': 'Does not balance',
  // Why Approve is unavailable, read under the button. Each names the fix, not the
  // fault: the reviewer is standing in front of the control that will not move.
  'review.jvBlankAccount': 'Choose an account for every line that carries an amount',
  'review.jvOffBy': 'Debit and credit differ by {diff}',
  'review.jvNothing': 'There is nothing to post',
  // Names both ways out, because unticking the record is a real answer here and not a
  // last resort: some documents genuinely have no vendor to claim against.
  'review.itxBlocked':
    'Fill in the vendor name and tax ID under Show details, or untick the input tax record',
  'review.loadingDocument': 'Loading the document',
  'review.ruleSaveFailed': 'The GL rule could not be saved, so nothing was posted: {reason}',
  'review.arMappingSaveFailed': 'The mapping could not be saved, so nothing was posted: {reason}',
  'review.arStillBlocked': 'Still blocked after saving the mapping: {reason}',
  // Sentence case on every phrase this column can print, including the ones that arrive
  // from the backend. Five lowercase fragments, one capitalised phrase and two first-person
  // sentences was four grammars in one scan, and the eye re-orients at each change.
  'review.reasonMissingMapping': 'Mapping missing',
  'review.reasonUnbalanced': 'Amounts do not reconcile',
  // "AI suggested", not "guessed": every document that needs a rule the BU has never set
  // goes through the suggester before it reaches this queue, so what the reviewer is being
  // shown is a proposal to check — the fields are named after the colon — and not a gap.
  'review.reasonGuessed': 'AI suggested mapping',
  'review.reasonDocNoMissing': 'No document number',
  // AR reconciliation only: no CSV sidecar confirmed this settlement report's tax ID, so
  // it is not a conflict (that is `tax_id_mismatch`, above this ladder) — just unverified.
  'review.reasonTinUnverified': 'Tax ID not verified',
  'review.reasonWarnings': 'Extraction warnings',
  // The reviewer's next move, not the absence of a problem. "nothing flagged" named an
  // internal concept (the ReviewFlag values) and left a clerk to work out that the row was
  // fine. It is also the sentence auto-post acts on: an empty flag list is what posts
  // unattended, so the words the reader sees and the rule the pipeline runs are the same.
  'review.reasonClean': 'Ready to post',
  // One pair per chip. A single sentence used to serve three of them, which is how an empty
  // Posted chip came to say "All clear" — it has not posted anything; that is not all clear.
  //
  // No second person, and each must stay true whether or not this BU reviews before posting.
  // The old one could not: "…appear here for approval" describes, to a BU that switched
  // review off, the exact thing it stopped doing. None of these names forwarding or
  // approval, so none of them can go stale that way.
  //
  // The ingest address is deliberately absent — it belongs to Carmen's settings screen,
  // not to a line in an empty state.
  'review.emptyReviewTitle': 'Nothing needs review',
  'review.emptyReviewBody': 'Documents that need a decision appear here.',
  'review.emptyTodayTitle': 'No activity today',
  'review.emptyTodayBody': 'Documents received or posted today appear here.',
  'review.emptyPostedTitle': 'Nothing posted yet',
  'review.emptyPostedBody': 'Documents that reached Carmen appear here with their JV number.',
  // Not "All clear" and no tick: an empty pile of failures is not an achievement.
  'review.emptyUnpostedTitle': 'No failed documents',
  'review.emptyUnpostedBody': 'Documents that were read but did not post appear here.',
  'review.emptyAllTitle': 'No documents yet',
  'review.emptyAllBody': 'Every document this module has looked at appears here.',
  // The only route the page does not already offer. Since `all` became a chip, a BU can be
  // told "nothing here" while holding a hundred rows it has no way to reach.
  'review.viewAllActivity': 'View all activity',
  'review.errorTitle': 'Could not load the queue',
  'review.errorBody': 'The list could not be fetched. Nothing has been lost - try again.',
  'review.retry': 'Try again',
  // "Document status" no longer describes the whole strip — `Today` is a window over every
  // status rather than one of them — so the group is named for what it does instead.
  'review.tabsLabel': 'Filter documents',
  // Everything since midnight, whatever came of it. The one chip that answers "what has the
  // robot been doing", which no status can.
  'review.filterToday': 'Today',
  // One word, and the same one the row's Status pill and its action button already use.
  // "Needs review" described a chip holding one status; this one holds everything that
  // wants a human, and the shorter word is the one that stays true as it widens.
  'review.filterReview': 'Review',
  // Both of these are literal, and both are about a document this BU paid to have read: it
  // reached Carmen, or it did not. An attachment nobody was charged for is under neither —
  // it was never a document, and saying "not posted" about a signature logo made the words
  // mean nothing.
  'review.filterSuccess': 'Posted',
  'review.filterUnposted': 'Not posted',
  // The log. Every attachment the system has ever looked at for this BU, charged or not,
  // forwarded or scanned by hand — which makes it the only place the rows the BU's own
  // filename rules threw out can be found, and the answer to "did my statement arrive?".
  'review.filterAll': 'All',
  'review.colDocument': 'Document',
  'review.colReceived': 'Received',
  'review.colJv': 'JV no.',
  'review.colStatus': 'Status',
  // Not "Message". Every other header on this table names its content; this one named its
  // medium, and the cell under it is a reason while the row waits and an outcome once it
  // resolves. "Detail" is the word that covers both without promising either.
  'review.colMessage': 'Detail',
  'review.colActions': 'Actions',
  'review.statusReview': 'Review',
  'review.statusSuccess': 'Success',
  'review.statusFailed': 'Failed',
  // Not "Failed". Both sit under Not posted and neither became a JV, but a person read this
  // one and decided against it — that is the system working, not breaking.
  'review.statusRejected': 'Rejected',
  'review.statusSkipped': 'Skipped',
  // Not "Skipped". `received` is the state every row is claimed into, so one still sitting
  // there is a message the pipeline picked up and never finished — a different thing from
  // a filename rule deliberately throwing a file out.
  'review.statusStuck': 'Unfinished',
  'review.actionReview': 'Review',
  'review.actionFixMapping': 'Fix mapping',
  'review.actionOpenSettings': 'Open settings',
  // A cause, not a document: the Document cell counts the attachments one refusal stopped
  // instead of naming one of them. "attachments" rather than "documents" deliberately —
  // none of these was ever read, so calling them documents would promise a reading the BU
  // was not charged for and did not get.
  // Short because it shares an 8.5rem column with every other row's button; the word that
  // distinguishes it from the generic 'Open settings' is 'Reconnect', and that is kept.
  // review.openJv carries the full sentence on the button's title.
  'review.actionReconnect': 'Reconnect',
  'review.actionOpenJv': 'Open JV',
  'review.uploadDocuments': 'Upload documents',
  'review.arSettings': 'AR reconciliation settings',
  'review.arNotConfigured':
    'AR reconciliation is no longer configured for this bank, so no JV can be built.',
  'review.arUnmapped': 'Map these payment types before posting: {types}',
  // The settlement report's reconciliation pane. The first two columns are the document's
  // own, so they are named the way KBANK prints them; the rest reuse the JV's column names
  // (review.jvDept / jvAccount / jvDesc / jvDebit / jvCredit) because they are the same
  // columns — including the Comment column, which both this pane and the settings screen's
  // preview render from the same `desc` field since 2026-09-17. arColPaymentType survives
  // only for ARMappingTable's own column, which maps a bare payment type to a GL account
  // and never shows the posted comment.
  'review.arColPaymentType': 'Payment type',
  'review.arPostTypeDetail': 'Detail',
  'review.arPostTypeSummary': 'Summary',
  'review.arNotMapped': 'Not mapped',
  'review.arNotPosted': 'no journal line',
  'review.arNewType': 'not mapped — pick Dept/Account to post it',
  'review.arFoldedCount': '{count} folded in',
  'review.arExpandCol': 'Expand',
  'review.arExpandFolded': 'Show {count} lines folded into {field}',
  'review.arCollapseFolded': 'Hide the lines folded into {field}',
  // The journal book lives in the credit-card mapping screen, which is where this sends
  // the reviewer — the field on the dialog cannot be typed into on this path.
  'review.actionSetPrefix': 'Set the journal book',
  // "reviewed and", because that is what the name is evidence of: this document stopped at
  // the queue and a person read it before it went. Its sibling below says "scanned and" for
  // the same reason — each names the work the person actually did, not just the posting.
  'review.postedBy': 'Reviewed and posted by {name}',
  'review.postedAutomatically': 'Posted automatically',
  // Named wherever the session that ran the scan can still be resolved. "by hand" answers
  // how, which the reader can already see from the Source icon; the name answers who, which
  // is the part they were reading the row for.
  'review.postedManuallyBy': 'Scanned and posted by {name}',
  // The fallback, and it has to exist: the name comes from `ocr_sessions`, not a stored
  // column, so it is genuinely gone once that session is scrubbed. Vaguer than a name and
  // far better than a raw user id.
  'review.postedManually': 'Scanned and posted by hand',
  // A manual scan charged and never posted. The row exists so a BU can see what its
  // credits went on, and nothing can resume it — so it says what happened, not what to do.
  'review.scannedNotPostedBy': 'Scanned by {name} — not posted',
  'review.scannedNotPosted': 'Scanned by hand — not posted',
  // The landing page for a BU that has never scanned anything. No word about email: most
  // BUs scan by hand, and the automation is introduced by Carmen's own settings screen.
  'review.noScansTitle': 'No scans yet',
  'review.noScansBody':
    'Every statement you scan appears here, posted or not, so you can see what each credit went on.',
  // Two forms, because the reason is optional and the one-form version printed the word
  // twice: `{reason}` was fed the `rejected_by_reviewer` phrase rather than what the
  // reviewer typed, so every rejection read "rejected by somchai - rejected" and the words
  // they actually left were reachable only by hovering the cell.
  'review.rejectedBy': 'Reviewed and rejected by {name}',
  'review.rejectedByWith': 'Reviewed and rejected by {name}: {reason}',
  // Each phrase that carries a Fix button names the field on the screen that button opens.
  // "your list" / "connection" were our nouns; the settings screen offers *Your email
  // addresses* and *Posting credential*, so a reader who followed the button arrived looking
  // for something that was not there. (There were three. `rcNoRuleMatch` — *Filename
  // patterns* — went with the rows it described: a rule refusing a file it was written to
  // refuse is in no view of this app now, only on #/admin/email, which has its own key.)
  'review.rcSenderNotAllowed': 'Sender is not one of your email addresses',
  'review.rcUnsupported': 'We cannot read this file type',
  'review.rcUnreadable': 'Could not read the document',
  'review.rcWrongPassword': 'PDF password did not work',
  // Not "belongs to another company". A BU's register holds an array of tax IDs, so a
  // document carrying one that is not in it has not been proven to belong to anyone else —
  // it just did not match. The claim the row can actually support is the weaker one, and
  // the number itself rides in on `error_message` (see WITH_DETAIL in shared/lib/reviewReasons).
  'review.rcTaxIdMismatch': 'Registered Tax ID does not match the document',
  // The fallback only. A live row prints its own detail instead — "already posted to
  // Carmen" or "a copy is already waiting for review" — because those are two situations
  // with two different next moves and one phrase could only be vague about both. This is
  // what a row written before those details existed still says.
  'review.rcDuplicate': 'Already handled',
  'review.rcMappingIncomplete': 'GL mapping missing',
  'review.rcCarmenRejected': 'Carmen refused it',
  // Names the field that fixes it, and drops a claim we cannot make: a revoked token and a
  // lapsed one write the same row, and only one of them expired.
  'review.rcCarmenUnauthorized': 'The Carmen posting credential is no longer accepted',
  'review.rcIngestPaused': 'Arrived while AI JV Automation was off',
  'review.rcArDisabled': 'Arrived while AR reconciliation was off for this bank',
  'review.rcUnbalanced': 'Debit and credit do not agree — a figure was misread',
  'review.rcCoveredBySettlement': "This bank's settlement report already covers this commission",
  'review.rcRejectedByReviewer': 'Rejected',
  'review.rcUnknown': 'No reason recorded',
  'review.rcStuck': 'We started reading this and stopped',
  // On the cell's title, because it is the half a reader cannot infer and the column has no
  // width for. `_claim` dedupes on (message, attachment) and returns None on the constraint
  // hit, so nothing ever retries one of these — an amber pill alone reads as "in progress".
  'review.rcStuckHint':
    'This one will not be picked up again. Forward it again if it never reached Carmen.',
  'review.chipAttention': '{count} need attention',
  'review.secTax': 'Input tax',
  'review.secTaxLabel': 'Post the input tax record',
  'review.approve': 'Approve and post',
  'review.approving': 'Posting',
  'review.reject': 'Reject',
  'review.rejectTitle': 'Reject this document?',
  'review.rejectMsg':
    'It will not post to Carmen, and this cannot be undone. The document has already been charged - rejecting does not refund it.',
  'review.rejectReason': 'Reason (optional)',
  'review.rejectReasonHint': 'e.g. wrong company',
  'review.rejectConfirm': 'Reject document',
  'review.rejected': 'Document rejected',
  'review.rejectFailed': 'Could not reject the document',
  'review.postedOk': 'Posted to Carmen - JV {jv}',
  'review.postedWithTaxNote': 'Posted as JV {jv}, but the input tax record was not created',
  'review.alreadyHandled': 'Someone else has already handled this document',
  'review.discardTitle': 'Leave without posting?',
  'review.discardMsg':
    'The amounts and GL accounts you changed here have not been saved. The document stays in the queue exactly as it arrived.',
  'review.discardConfirm': 'Discard changes',
  'review.discardKeep': 'Keep reviewing',
  'review.goneTitle': 'This document is not waiting for review',
  'review.goneBody': 'It may have been approved or rejected by someone else in your business unit.',
} as const

export const th: Record<keyof typeof en, string> = {
  'review.title': 'AI JV Automation',
  'review.back': 'ย้อนกลับ',
  'review.refresh': 'รีเฟรช',
  'review.close': 'ปิด',
  // Field names and column headers stay English on this screen, in both locales. They are
  // the names Carmen shows an accountant every day — a JV's Dept / Account / Debit /
  // Credit, an ACTX record's Vendor / Tax ID / Tax profile — and translating them made the
  // reviewer match a Thai word against an English field in the ERP they are posting to.
  // The sentences around them (actions, statuses, warnings, empty states) stay Thai.
  // A dash, not "Book": the field is labelled Prefix and its values are book names, so the
  // word sat in the control reading exactly like a chosen one. The wizard's own config
  // badge has always printed `-` for an unset prefix (`AccountingReview`).
  'review.fPrefixPlaceholder': '-',
  'review.fPrefix': 'Prefix',
  'review.fDescription': 'Description',
  'review.prefixRequired': 'เลือก Prefix ก่อนโพสต์',
  'review.fDescriptionPlaceholder': 'Description',
  'review.itxShow': 'ดูรายละเอียด',
  'review.itxHide': 'ซ่อนรายละเอียด',
  'review.itxNet': 'Net Amount',
  'review.itxTax': 'Tax',
  'review.itxTotal': 'Total',
  'review.itxVendor': 'Vendor',
  'review.itxVendorHint': 'Registered name',
  'review.itxTaxId': 'Tax ID',
  'review.itxTInvNo': 'Tax invoice no.',
  'review.itxTInvDt': 'Tax invoice date',
  'review.itxPeriod': 'Tax period',
  'review.itxProfile': 'Tax profile',
  'review.itxNoIdentity': 'ธนาคารนี้ไม่มีเลขประจำตัวผู้เสียภาษีในระบบ Carmen จะปฏิเสธรายการนี้',
  'review.itxRateOff': 'เอกสารคิดออกมาได้ {ratio}% ซึ่งไม่ตรงกับประเภทภาษี {rate}% ที่จะใช้ยื่น',
  'review.fDocNo': 'Document no.',
  'review.fDocDate': 'Document date',
  'review.fBranch': 'Branch',
  'review.fMissing': 'ไม่มีในเอกสาร',
  'review.openJv': 'เปิด JV ใน Carmen',
  'review.unknownBank': 'ไม่ทราบ',
  // -- Review screen: the JV pane, where GL rules are corrected in place ------
  'review.paneDocument': 'เอกสารบอกว่า',
  'review.paneJv': 'จะโพสต์เข้า Carmen',
  'review.jvLoading': 'กำลังโหลดผังบัญชี',
  'review.jvNoConfig': 'หน่วยธุรกิจนี้ยังไม่ได้ตั้งค่าผังบัญชี',
  'review.jvDept': 'Dept',
  'review.jvAccount': 'Account',
  'review.jvDesc': 'Comment',
  'review.jvLineOf': '{field} line {line}',
  'review.jvDebitFor': 'Debit for {field}',
  'review.jvCreditFor': 'Credit for {field}',
  'review.jvSharedHint': 'รวมมาจาก {count} บรรทัด — แก้ตรงนี้จะกระจายยอดใหม่ไปทุกบรรทัด',
  'review.jvDebit': 'Debit',
  'review.jvCredit': 'Credit',
  'review.jvDeptPlaceholder': 'Department',
  'review.jvAccountPlaceholder': 'Account',
  'review.jvDeptFor': 'Department for {field}',
  'review.jvAccountFor': 'Account for {field}',
  'review.jvDescFor': 'Comment for {field}',
  'review.jvDeptFilter': '{dept} ใช้ได้ {count} บัญชี',
  'review.jvGuessed': 'AI',
  'review.jvGuessedHint': 'AI เลือกบัญชีนี้ตอนเอกสารเข้ามา ช่วยตรวจด้วย',
  'review.jvAllBanks': 'ทุกธนาคาร',
  'review.jvAllBanksHint':
    'ค่าคอมมิชชั่น ภาษีซื้อ และบัญชีธนาคาร เป็นกฎเดียวของหน่วยธุรกิจนี้ — กด Approve แล้วจะมีผลกับทุกธนาคาร ไม่ใช่เฉพาะใบนี้',
  'review.jvUndo': 'ย้อนกลับ',
  'review.jvBalanced': 'ยอดตรงกัน',
  'review.jvImbalanced': 'ยอดไม่ตรงกัน',
  'review.itxBlocked':
    'กรอกชื่อผู้ขายและเลขประจำตัวผู้เสียภาษีใน "ดูรายละเอียด" หรือติ๊กรายการภาษีซื้อออก',
  'review.jvBlankAccount': 'เลือกบัญชีให้ทุกบรรทัดที่มียอด',
  'review.jvOffBy': 'เดบิตกับเครดิตต่างกัน {diff}',
  'review.jvNothing': 'ไม่มีรายการให้โพสต์',
  'review.loadingDocument': 'กำลังโหลดเอกสาร',
  'review.ruleSaveFailed': 'บันทึกกฎบัญชีไม่สำเร็จ จึงยังไม่ได้โพสต์: {reason}',
  'review.arMappingSaveFailed': 'บันทึกผังบัญชีไม่สำเร็จ จึงยังไม่ได้โพสต์: {reason}',
  'review.arStillBlocked': 'หลังบันทึกผังบัญชีแล้วยังโพสต์ไม่ได้: {reason}',
  'review.reasonMissingMapping': 'ยังไม่มีผังบัญชี',
  'review.reasonUnbalanced': 'ยอดไม่สมดุล',
  'review.reasonGuessed': 'AI แนะนำผังบัญชี',
  'review.reasonDocNoMissing': 'ไม่มีเลขที่เอกสาร',
  'review.reasonTinUnverified': 'ยังไม่ยืนยันเลขผู้เสียภาษี',
  'review.reasonWarnings': 'มีคำเตือนจากการอ่าน',
  'review.reasonClean': 'พร้อมโพสต์',
  'review.emptyReviewTitle': 'ไม่มีรายการรอตรวจสอบ',
  'review.emptyReviewBody': 'เอกสารที่ต้องให้คุณตัดสินใจจะมาปรากฏที่นี่',
  'review.emptyTodayTitle': 'วันนี้ยังไม่มีความเคลื่อนไหว',
  'review.emptyTodayBody': 'เอกสารที่เข้ามาหรือลงบัญชีวันนี้จะมาปรากฏที่นี่',
  'review.emptyPostedTitle': 'ยังไม่มีเอกสารที่ลงบัญชี',
  'review.emptyPostedBody': 'เอกสารที่ส่งเข้า Carmen สำเร็จจะมาปรากฏที่นี่พร้อมเลขที่ JV',
  'review.emptyUnpostedTitle': 'ไม่มีเอกสารที่ลงบัญชีไม่สำเร็จ',
  'review.emptyUnpostedBody': 'เอกสารที่ระบบอ่านแล้วแต่ลงบัญชีไม่สำเร็จจะมาปรากฏที่นี่',
  'review.emptyAllTitle': 'ยังไม่มีเอกสาร',
  'review.emptyAllBody': 'เอกสารทุกฉบับที่ผ่านเข้าโมดูลนี้จะมาปรากฏที่นี่',
  'review.viewAllActivity': 'ดูประวัติทั้งหมด',
  'review.errorTitle': 'โหลดรายการไม่สำเร็จ',
  'review.errorBody': 'ดึงรายการไม่ได้ ข้อมูลไม่หาย ลองอีกครั้ง',
  'review.retry': 'ลองอีกครั้ง',
  'review.tabsLabel': 'กรองเอกสาร',
  'review.filterToday': 'วันนี้',
  'review.filterReview': 'ตรวจสอบ',
  'review.filterSuccess': 'ลงบัญชีแล้ว',
  'review.filterUnposted': 'ไม่ได้ลงบัญชี',
  'review.filterAll': 'ทั้งหมด',
  'review.colDocument': 'Document',
  'review.colReceived': 'Received',
  'review.colJv': 'JV no.',
  'review.colStatus': 'Status',
  'review.colMessage': 'Detail',
  'review.colActions': 'Actions',
  'review.statusReview': 'รอตรวจ',
  'review.statusSuccess': 'สำเร็จ',
  'review.statusFailed': 'ล้มเหลว',
  'review.statusRejected': 'ถูกปฏิเสธ',
  'review.statusSkipped': 'ข้ามไป',
  'review.statusStuck': 'ค้างอยู่',
  'review.actionReview': 'ตรวจสอบ',
  'review.actionOpenSettings': 'เปิดตั้งค่า',
  'review.actionReconnect': 'เชื่อมใหม่',
  'review.actionFixMapping': 'แก้ผังบัญชี',
  'review.actionOpenJv': 'เปิด JV',
  'review.uploadDocuments': 'อัปโหลดเอกสาร',
  'review.arSettings': 'ตั้งค่ากระทบยอดลูกหนี้บัตรเครดิต',
  'review.arNotConfigured': 'ธนาคารนี้ไม่ได้ตั้งค่ากระทบยอดไว้แล้ว จึงสร้าง JV ไม่ได้',
  'review.arUnmapped': 'ผูกผังบัญชีให้ประเภทบัตรเหล่านี้ก่อนจึงจะโพสต์ได้: {types}',
  'review.arColPaymentType': 'ประเภทบัตร',
  'review.arPostTypeDetail': 'Detail',
  'review.arPostTypeSummary': 'Summary',
  'review.arNotMapped': 'ยังไม่ผูกบัญชี',
  'review.arNotPosted': 'ไม่มีบรรทัดใน JV',
  'review.arNewType': 'ยังไม่ผูกบัญชี — เลือกฝ่าย/บัญชีเพื่อโพสต์',
  'review.arFoldedCount': 'รวม {count} รายการ',
  'review.arExpandCol': 'ขยาย',
  'review.arExpandFolded': 'แสดง {count} รายการที่รวมอยู่ใน {field}',
  'review.arCollapseFolded': 'ซ่อนรายการที่รวมอยู่ใน {field}',
  'review.actionSetPrefix': 'ตั้งสมุดรายวัน',
  'review.postedBy': 'ตรวจสอบและโพสต์โดย {name}',
  'review.postedAutomatically': 'โพสต์อัตโนมัติ',
  'review.postedManuallyBy': 'สแกนและลงบัญชีโดย {name}',
  'review.postedManually': 'สแกนและโพสต์เอง',
  'review.scannedNotPostedBy': 'สแกนโดย {name} — ยังไม่ได้ลงบัญชี',
  'review.scannedNotPosted': 'สแกนเอง — ยังไม่ได้ลงบัญชี',
  'review.noScansTitle': 'ยังไม่มีการสแกน',
  'review.noScansBody':
    'ใบแจ้งยอดทุกใบที่สแกนจะมาปรากฏที่นี่ ทั้งที่ลงบัญชีแล้วและยังไม่ได้ลงบัญชี เพื่อให้เห็นว่าเครดิตแต่ละหน่วยใช้ไปกับอะไร',
  'review.rejectedBy': 'ตรวจสอบและปฏิเสธโดย {name}',
  'review.rejectedByWith': 'ตรวจสอบและปฏิเสธโดย {name}: {reason}',
  // Same rule as EN: each names the field on the settings screen its Fix button opens.
  'review.rcSenderNotAllowed': 'ผู้ส่งไม่อยู่ในอีเมลของคุณ',
  'review.rcUnsupported': 'อ่านไฟล์ชนิดนี้ไม่ได้',
  'review.rcUnreadable': 'อ่านเอกสารไม่ได้',
  'review.rcWrongPassword': 'รหัสผ่าน PDF ไม่ถูกต้อง',
  'review.rcTaxIdMismatch': 'เลขผู้เสียภาษีที่ลงทะเบียนไว้ไม่ตรงกับในเอกสาร',
  'review.rcDuplicate': 'ทำรายการนี้ไปแล้ว',
  'review.rcMappingIncomplete': 'ยังไม่มีผังบัญชี',
  'review.rcCarmenRejected': 'Carmen ปฏิเสธ',
  'review.rcCarmenUnauthorized': 'Carmen ไม่รับ token สำหรับส่งเอกสารแล้ว',
  'review.rcIngestPaused': 'เข้ามาตอนที่ปิด AI JV Automation อยู่',
  'review.rcArDisabled': 'เข้ามาตอนที่ปิดการกระทบยอดลูกหนี้บัตรของธนาคารนี้อยู่',
  'review.rcUnbalanced': 'ยอดเดบิตกับเครดิตไม่ตรงกัน — น่าจะอ่านตัวเลขผิด',
  'review.rcCoveredBySettlement': 'รายงาน settlement ของธนาคารนี้ครอบคลุมค่าธรรมเนียมนี้ไว้แล้ว',
  'review.rcRejectedByReviewer': 'ถูกปฏิเสธ',
  'review.rcUnknown': 'ไม่มีการบันทึกเหตุผล',
  'review.rcStuck': 'เริ่มอ่านแล้วแต่หยุดกลางทาง',
  'review.rcStuckHint': 'รายการนี้จะไม่ถูกหยิบไปทำใหม่ ถ้ายังไม่ถึง Carmen ให้ส่งเมลเข้ามาอีกครั้ง',
  'review.chipAttention': 'มี {count} รายการผิดปกติ',
  'review.secTax': 'Input tax',
  'review.secTaxLabel': 'บันทึกรายการภาษีซื้อ',
  'review.approve': 'อนุมัติและโพสต์',
  'review.approving': 'กำลังโพสต์',
  'review.reject': 'ปฏิเสธ',
  'review.rejectTitle': 'ปฏิเสธเอกสารนี้?',
  'review.rejectMsg':
    'เอกสารจะไม่ถูกโพสต์เข้า Carmen และย้อนกลับไม่ได้ เอกสารนี้ถูกหักโควตาไปแล้ว การปฏิเสธไม่คืนโควตา',
  'review.rejectReason': 'เหตุผล (ไม่บังคับ)',
  'review.rejectReasonHint': 'เช่น ผิดบริษัท',
  'review.rejectConfirm': 'ปฏิเสธเอกสาร',
  'review.rejected': 'ปฏิเสธเอกสารแล้ว',
  'review.rejectFailed': 'ปฏิเสธเอกสารไม่สำเร็จ',
  'review.postedOk': 'โพสต์เข้า Carmen แล้ว - JV {jv}',
  'review.postedWithTaxNote': 'โพสต์เป็น JV {jv} แล้ว แต่ไม่ได้บันทึกรายการภาษีซื้อ',
  'review.alreadyHandled': 'มีคนอื่นจัดการเอกสารนี้ไปแล้ว',
  'review.discardTitle': 'ออกโดยไม่โพสต์ใช่ไหม',
  'review.discardMsg': 'ยอดและบัญชีที่คุณแก้ไว้ยังไม่ถูกบันทึก เอกสารจะอยู่ในคิวเหมือนตอนที่เข้ามา',
  'review.discardConfirm': 'ทิ้งการแก้ไข',
  'review.discardKeep': 'ตรวจสอบต่อ',
  'review.goneTitle': 'เอกสารนี้ไม่ได้รอตรวจอยู่',
  'review.goneBody': 'อาจถูกอนุมัติหรือปฏิเสธไปแล้วโดยคนอื่นใน BU ของคุณ',
}
