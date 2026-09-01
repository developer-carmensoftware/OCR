import CustomSearchSelect from '../common/CustomSearchSelect'
import DateInput from '../common/DateInput'
import { useT } from '../../i18n/LanguageContext'
import { descriptionForBank } from '../../lib/bankTransforms'
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
 *   date is machine-appended per document; the tail is rendered beside the field so the
 *   reviewer sees the whole string without being asked to retype a date into it.
 * - `descriptionForBank` prefers a per-bank entry over the BU-wide one. The parent tells
 *   the server which bank this edit was made against so it writes whichever one actually
 *   wins — otherwise the per-bank value keeps overriding the edit on every future document.
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
  // Same resolution `buildGljvPayload` does, from the same helper — a preview that could
  // disagree with what posts would be worse than no preview.
  const storedBase =
    descriptionForBank(
      config?.description as string | undefined,
      config?.bankDescriptions as Record<string, string> | undefined,
      bank
    ) || ''

  const effectivePrefix = prefix ?? storedPrefix
  const effectiveBase = description ?? storedBase

  return (
    <div className="rd-doc">
      <div className={`rd-f${headerData.DocNo ? '' : ' rd-f--missing'}`}>
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

      <div className={`rd-f${headerData.DocDate ? '' : ' rd-f--missing'}`}>
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

      <div className="rd-f">
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

      <div className="rd-f">
        <label className="rd-f-label" htmlFor="rd-Description">
          {t('review.fDescription')}
        </label>
        <div className="rd-f-suffixed">
          <input
            id="rd-Description"
            type="text"
            aria-label={t('review.fDescription')}
            className="rd-f-input"
            value={effectiveBase}
            placeholder={t('review.fMissing')}
            onChange={e => onDescription(e.target.value)}
          />
          {/* Appended per document by the JV builder, so it is shown rather than typed. */}
          {headerData.DocDate && (
            <span className="rd-f-suffix text-mono">- {headerData.DocDate}</span>
          )}
        </div>
      </div>
    </div>
  )
}
