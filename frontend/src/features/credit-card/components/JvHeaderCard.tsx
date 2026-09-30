import CustomSearchSelect from '@/shared/components/common/CustomSearchSelect'
import DateInput from '@/shared/components/common/DateInput'
import { useT } from '@/i18n/LanguageContext'
import { useGlMasters } from '@/features/credit-card/hooks/mapping/useGlMasters'
import {
  DESCRIPTION_TAGS,
  joinDescription,
  splitDescription,
} from '@/features/credit-card/lib/ccJv'
import type { BankCode } from '@/shared/types/api'

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
 * - The input edits the description's **text** only. The fields attached after it
 *   (`{Settlement_Date}` and friends, picked on the Mapping page) are kept as they are and
 *   named beside the box, never typed in it — a stray backspace would post a broken token.
 *   What posts is that text with the fields filled from this document (`renderDescription`);
 *   nothing else is appended, so no date field means no date (2026-09-30).
 * - **The description is per bank**, as it is in the wizard's config editor — and since
 *   2026-09-30 there is nothing else: no BU-wide sentence behind it (decision-log #33). The
 *   parent names the bank on save, and `patch_config` writes that entry, the only one
 *   `description_for` reads when the JV is built.
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
  /**
   * Show the four fields as values rather than controls.
   *
   * For the AR settlement path, where none of them is editable in any sense that reaches
   * Carmen: the server rebuilds that JV from the document on approve, so a corrected
   * document number changed nothing that posted; and the
   * parent skips the config write entirely on that path, so a retyped prefix or
   * description was dropped on submit. Four inputs that quietly discard what is typed into
   * them are worse than four values.
   */
  readOnly?: boolean
  /**
   * The description that will actually post, when the caller knows it and this component
   * cannot derive it. The AR JV's is rendered server-side from the BU's
   * `jv_description_template`; the per-bank wording resolved below belongs to the
   * credit-card JV and is a different sentence about a different document.
   */
  descriptionOverride?: string
}

/** A field the reviewer reads rather than fills. Same label, same column, no control. */
function ReadOnlyField({
  label,
  value,
  mono = true,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <>
      <span className="rd-f-label">{label}</span>
      <span className={`rd-f-value${mono ? ' text-mono' : ''}`}>{value}</span>
    </>
  )
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
  readOnly = false,
  descriptionOverride,
}: Props) {
  const { t } = useT()
  const { prefixes } = useGlMasters()

  const storedPrefix = (config?.filePrefix as string) || ''
  const effectivePrefix = prefix ?? storedPrefix

  // **This bank's own wording** — the uncommitted correction if there is one, else what is
  // saved. It is all that posts: there is no BU-wide sentence behind it since 2026-09-30.
  const storedOwn =
    ((config?.bankDescriptions as Record<string, string> | undefined) || {})[bank || ''] || ''
  const effectiveOwn = description ?? storedOwn
  const { text, tags } = splitDescription(effectiveOwn)
  // The box edits the text; the bank's fields ride along untouched (picked on the Mapping
  // page), so clearing the text leaves e.g. just the date, and clearing both leaves ''.
  const editText = (v: string) => onDescription(joinDescription(v, tags))

  return (
    <div className="rd-doc">
      <div className={`rd-f rd-f--docno${headerData.DocNo ? '' : ' rd-f--missing'}`}>
        {readOnly ? (
          <ReadOnlyField
            label={t('review.fDocNo')}
            value={headerData.DocNo || t('review.fMissing')}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      <div className={`rd-f rd-f--date${headerData.DocDate ? '' : ' rd-f--missing'}`}>
        {readOnly ? (
          <ReadOnlyField
            label={t('review.fDocDate')}
            value={headerData.DocDate || t('review.fMissing')}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Marked missing like DocNo and DocDate above, because it is: the JV cannot post
          without a book, and the parent's block reason says so at the button. The
          placeholder is a dash rather than the word "Book" — a real book name and the name
          of the field read the same in this control, so an unset prefix looked set. Same
          dash the wizard's own config badges use for it (`AccountingReview`). */}
      <div className={`rd-f rd-f--prefix${effectivePrefix ? '' : ' rd-f--missing'}`}>
        {readOnly ? (
          <ReadOnlyField
            label={t('review.fPrefix')}
            value={effectivePrefix || t('review.fPrefixPlaceholder')}
          />
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Takes whatever the three fixed-width fields leave. The fields this bank attaches
          after the text are named under the box, read-only — they are picked on the
          Mapping page, and filled from this document's own number and date on post. */}
      <div className="rd-f rd-f--grow">
        {readOnly ? (
          <ReadOnlyField
            label={t('review.fDescription')}
            /* What posts, not what this bank's credit-card wording says: on the AR path
               the sentence is rendered server-side from a different template entirely. */
            value={descriptionOverride ?? effectiveOwn}
            mono={false}
          />
        ) : (
          <>
            <label className="rd-f-label" htmlFor="rd-Description">
              {t('review.fDescription')}
            </label>
            <input
              id="rd-Description"
              type="text"
              aria-label={t('review.fDescription')}
              className="rd-f-input rd-f-input--optional"
              value={text}
              /* Not `fMissing` ("Not on the document"), which the two fields above earn by
             being document fields the extractor could not fill: this one is BU config and
             was never on the document, so that placeholder accused the statement of an
             omission it could not have. */
              placeholder={t('review.fDescriptionPlaceholder')}
              onChange={e => editText(e.target.value)}
            />
            {tags.length > 0 && (
              <span className="rd-f-suffix">
                +{' '}
                {tags
                  .map(tag => DESCRIPTION_TAGS.find(d => d.tag === tag))
                  .map(d => (d ? t(d.labelKey) : ''))
                  .join(' · ')}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
