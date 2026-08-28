import DateInput from '../common/DateInput'
import { useT } from '../../i18n/LanguageContext'
import type { TKey } from '../../i18n/dict'

/**
 * What the reviewer has to check about the document itself.
 *
 * Not `HeaderCard`. That one is a wizard form: ten fields in entry order, each labelled
 * twice (an English label and the raw field name under it), including three the reviewer
 * cannot act on — `DateProcessed` is today's date generated in the browser, and the two
 * bank names are already in the modal's own header. On a screen whose job is "does this
 * document add up", every one of those is a thing to read past.
 *
 * So: six fields, in the order a person checks a statement — which document is this, then
 * who is it about. `headerData` still carries the rest, because `AccountingReview` reads it
 * and approve posts it; they simply are not things to look at here.
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
  { key: 'BranchNo', label: 'review.fBranch', mono: true },
  { key: 'CompanyName', label: 'review.fCompany', wide: true },
  { key: 'MerchantId', label: 'review.fMerchantId', mono: true },
  { key: 'MerchantName', label: 'review.fMerchant', wide: true },
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
