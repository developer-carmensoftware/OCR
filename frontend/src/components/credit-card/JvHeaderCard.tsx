import DateInput from '../common/DateInput'
import { useT } from '../../i18n/LanguageContext'
import { descriptionForBank } from '../../lib/bankTransforms'
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
 * Prefix and Description are read-only because they are not per-document: they come from
 * the BU's accounting config, are resolved here exactly as `buildGljvPayload` resolves
 * them, and are changed on the mapping page. Showing them as a preview is the point —
 * they are what will print on the journal.
 */
interface Props {
  headerData: Record<string, string>
  onUpdate: (key: string, value: string) => void
  config: Record<string, unknown> | null
  bank: BankCode | ''
}

export default function JvHeaderCard({ headerData, onUpdate, config, bank }: Props) {
  const { t } = useT()

  const prefix = (config?.filePrefix as string) || ''
  // Same resolution `buildGljvPayload` does, from the same helper — a preview that could
  // disagree with what posts would be worse than no preview.
  const base = descriptionForBank(
    config?.description as string | undefined,
    config?.bankDescriptions as Record<string, string> | undefined,
    bank
  )
  const description = base ? `${base}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}` : ''

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
        <span className="rd-f-fixed text-mono">{prefix || '—'}</span>
      </div>

      <div className="rd-f rd-f--wide">
        <span className="rd-f-label">{t('review.fDescription')}</span>
        <span className="rd-f-fixed" title={description}>
          {description || '—'}
        </span>
      </div>
    </div>
  )
}
