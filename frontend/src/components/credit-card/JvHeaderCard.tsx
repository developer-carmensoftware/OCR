import CustomSearchSelect from '../common/CustomSearchSelect'
import DateInput from '../common/DateInput'
import { useT } from '../../i18n/LanguageContext'
import { useGlMasters } from '../../hooks/mapping/useGlMasters'
import type { BankCode } from '../../types/api'

/**
 * The JV's own header — the four things that reach Carmen as the journal's identity.
 *
 * Not "the extracted document", which is what this used to be: nine fields, of which only
 * these four go anywhere. `company_name`, `merchant_name`, `merchant_id`, `bank_name`,
 * `bank_company_name` and `doc_name` appear in neither `build_gljv_payload` nor
 * `build_input_tax_payload` — they are extraction context, and showing them here invited
 * the reviewer to check figures that could not be wrong in any way that matters. They
 * still travel untouched inside `extracted`.
 *
 * `BranchNo` is the one document field that survived the cut but belongs elsewhere: it is
 * used by the input-tax record and nothing else, so it lives in that panel.
 *
 * **Prefix and Description are BU config, not per-document**, so editing one changes the
 * rule and the parent persists it on approve — the same contract the GL pickers have. Two
 * consequences worth knowing:
 *
 * - The input edits the description's **base**. What posts is `base - docDate`, and the
 *   date is machine-appended per document and is not rendered here — it is the document
 *   date already on screen two fields along, and what this system appends on post is not
 *   news to the person approving.
 * - **The description is per bank**, as it is in the wizard's config editor. The box holds
 *   this bank's own entry and the BU-wide sentence is only the placeholder, so a correction
 *   made about one bank's statements cannot rewrite the wording for every other bank the BU
 *   receives. The parent names the bank on save, and `patch_config` writes that entry —
 *   which is also the one `description_for` prefers when the JV is built.
 */
interface Props {
  headerData: Record<string, string>
  onUpdate: (key: string, value: string) => void
  config: Record<string, unknown> | null
  bank: BankCode | ''
  /** Uncommitted header corrections, keyed as the config names them. */
  prefix: string | null
  description: string | null
  onPrefix: (value: string) => void
  onDescription: (value: string) => void
}

export default function JvHeaderCard({
  headerData,
  onUpdate,
  config,
  bank,
  prefix,
  description,
  onPrefix,
  onDescription,
}: Props) {
  const { t } = useT()
  const { prefixes } = useGlMasters()

  const storedPrefix = (config?.filePrefix as string) || ''
  const effectivePrefix = prefix ?? storedPrefix

  // **This bank's own wording, raw — not the resolved value.** Same shape as the wizard's
  // config editor (`TopLevelConfigSection`), and for the same two reasons. Feeding the
  // fallback into the box makes the field impossible to clear: delete the last character,
  // the fallback resolves in its place, and the old text reappears under the cursor. And
  // the box is what gets saved, so showing the BU-wide sentence here meant a reviewer
  // correcting the wording for *this* bank silently rewrote it for every other one.
  //
  // The fallback belongs in the placeholder, where it says what will post without
  // pretending to be what you typed — the muted "already answered" treatment, since it is
  // a preview rather than a gap.
  const storedOwn =
    ((config?.bankDescriptions as Record<string, string> | undefined) || {})[bank || ''] || ''
  const effectiveOwn = description ?? storedOwn
  // What posts when this bank has no wording of its own — which is all `descriptionForBank`
  // falls back to, so naming the field directly says the same thing with less ceremony.
  const fallback = ((config?.description as string) || '').trim()

  return (
    <div className="rd-doc">
      <div className={`rd-f rd-f--docno${headerData.DocNo ? '' : ' rd-f--missing'}`}>
        <label className="rd-f-label" htmlFor="rd-DocNo">
          {t('review.fDocNo')}
        </label>
        <input
          id="rd-DocNo"
          type="text"
          aria-label={t('review.fDocNo')}
          className="rd-f-input text-mono"
          value={headerData.DocNo || ''}
          /* An empty field says what is wrong with it rather than sitting blank. */
          placeholder={t('review.fMissing')}
          onChange={e => onUpdate('DocNo', e.target.value)}
        />
      </div>

      <div className={`rd-f rd-f--date${headerData.DocDate ? '' : ' rd-f--missing'}`}>
        <label className="rd-f-label" htmlFor="rd-DocDate">
          {t('review.fDocDate')}
        </label>
        <DateInput
          id="rd-DocDate"
          aria-label={t('review.fDocDate')}
          value={headerData.DocDate || ''}
          className="rd-f-input text-mono"
          onChange={v => onUpdate('DocDate', v)}
        />
      </div>

      {/* Marked missing like DocNo and DocDate above, because it is: the JV cannot post
          without a book, and the parent's block reason says so at the button. The
          placeholder is a dash rather than the word "Book" — a real book name and the name
          of the field read the same in this control, so an unset prefix looked set. Same
          dash the wizard's own config badges use for it (`AccountingReview`). */}
      <div className={`rd-f rd-f--prefix${effectivePrefix ? '' : ' rd-f--missing'}`}>
        <span className="rd-f-label">{t('review.fPrefix')}</span>
        {/* Carmen's own list of journal books, through the picker the JV rows use — one
            control vocabulary across the screen. */}
        <CustomSearchSelect
          value={effectivePrefix || null}
          onChange={onPrefix}
          options={prefixes}
          placeholder={t('review.fPrefixPlaceholder')}
          aria-label={t('review.fPrefix')}
        />
      </div>

      {/* Takes whatever the three fixed-width fields leave. The JV builder appends
          " - <doc date>" to whatever is typed here; that tail used to render beside the
          field and has been dropped — it is the same date already on screen two fields
          along, and what this system appends on post is not news to the person approving. */}
      <div className="rd-f rd-f--grow">
        <label className="rd-f-label" htmlFor="rd-Description">
          {t('review.fDescription')}
        </label>
        <input
          id="rd-Description"
          type="text"
          aria-label={t('review.fDescription')}
          className="rd-f-input rd-f-input--optional"
          value={effectiveOwn}
          /* The BU-wide wording when this bank has none, so the field says what will post.
             Not `fMissing` ("Not on the document"), which the two fields above earn by
             being document fields the extractor could not fill: this one is BU config and
             was never on the document, so that placeholder accused the statement of an
             omission it could not have. */
          placeholder={fallback || t('review.fDescriptionPlaceholder')}
          onChange={e => onDescription(e.target.value)}
        />
      </div>
    </div>
  )
}
