import DateInput from '../common/DateInput'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'

/**
 * What the document is, as extracted — every field except one.
 *
 * Not `HeaderCard`. That one is a wizard form: each field labelled twice (an English
 * label and the raw field name under it), in data-entry order. This is the same content
 * read for verification: one label, grouped as a person checks a statement — which
 * document is this, who issued it, who is it about.
 *
 * The single omission is `DateProcessed`, which is today's date generated in the browser
 * at load. It says nothing about the document and changes every time the modal opens.
 *
 * Everything shown here is editable AND posted: `ReviewDocument.approve` sends each of
 * these keys back into `extracted`. An input the reviewer can change that quietly does
 * not travel is worse than a read-only one.
 */
const FIELDS: Array<{
  key: string
  label: TKey
  /** Mono = a value to verify character by character. DESIGN.md's Mono Signal Rule. */
  mono?: boolean
  date?: boolean
  wide?: boolean
}> = [
  { key: 'DocNo', label: 'review.fDocNo', mono: true },
  { key: 'DocDate', label: 'review.fDocDate', mono: true, date: true },
  { key: 'DocName', label: 'review.fDocName' },
  { key: 'BranchNo', label: 'review.fBranch', mono: true },
  { key: 'BankName', label: 'review.fBankName' },
  { key: 'BankCompanyName', label: 'review.fBankCompany', wide: true },
  { key: 'CompanyName', label: 'review.fCompany', wide: true },
  { key: 'MerchantId', label: 'review.fMerchantId', mono: true },
  { key: 'MerchantName', label: 'review.fMerchant' },
]

interface Props {
  headerData: Record<string, string>
  onUpdate: (key: string, value: string) => void
}

export default function ReviewDocCard({ headerData, onUpdate }: Props) {
  const { t } = useT()
  return (
    <div className="rd-doc">
      {FIELDS.map(f => {
        const value = headerData[f.key] || ''
        const label = t(f.label)
        return (
          <div
            key={f.key}
            className={`rd-f${f.wide ? ' rd-f--wide' : ''}${value ? '' : ' rd-f--missing'}`}
          >
            <label className="rd-f-label" htmlFor={`rd-${f.key}`}>
              {label}
            </label>
            {f.date ? (
              <DateInput
                id={`rd-${f.key}`}
                aria-label={label}
                value={value}
                className="rd-f-input text-mono"
                onChange={v => onUpdate(f.key, v)}
              />
            ) : (
              <input
                id={`rd-${f.key}`}
                type="text"
                aria-label={label}
                className={`rd-f-input${f.mono ? ' text-mono' : ''}`}
                value={value}
                /* An empty field says what is wrong with it, rather than sitting blank and
                   letting the reviewer work out which one the header meant. */
                placeholder={t('review.fMissing')}
                onChange={e => onUpdate(f.key, e.target.value)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
