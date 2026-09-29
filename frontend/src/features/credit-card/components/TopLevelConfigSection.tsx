import { Plus, Check } from 'lucide-react'
import { BANKS } from '@/shared/constants'
import { BANK_CODE_MAP } from '@/shared/constants/banks'
import type { BankDisplayName } from '@/shared/types/api'
import { useT } from '@/i18n/LanguageContext'
import type { TKey } from '@/i18n/dict'
import CustomSearchSelect, {
  type SelectOption,
} from '@/shared/components/common/CustomSearchSelect'
import '@/styles/pages/ar-reconcile.css'

const BANK_OPTIONS: SelectOption[] = BANKS.map(b => ({
  code: b.full,
  name: b.kind === 'gateway' ? 'Payment gateway' : 'Bank',
}))

interface Props {
  bank: BankDisplayName | ''
  handleBankChange: (bank: BankDisplayName | '') => void
  filePrefix: string
  setFilePrefix: (v: string) => void
  /** Carmen's GL prefixes (`GET /carmen/gl-prefix`). */
  prefixes: SelectOption[]
  fileSource: string
  description: string
  setDescription: (v: string) => void
  bankDescriptions: Record<string, string>
  setBankDescriptions: (v: Record<string, string>) => void
  /** Whether the selected bank has a settlement layout (`banks.settlement_grouping`) —
   *  gates the tag-insert buttons and live preview below, since a settlement JV is the
   *  only reason `description` needs to be a template rather than a plain label
   *  (Ticket D, 2026-09-22 — this field now also feeds a settlement JV's wording, the
   *  same one `ar_reconcile_service.resolve_jv_description` reads at posting time). */
  hasSettlementLayout?: boolean
  /** The live "renders as" example for the currently-selected bank's settlement JV,
   *  from `useSettlementMapping`'s own preview call. */
  settlementPreview?: string
}

// A tag can only be in the description once — see `ar-desc-extras`'s CSS comment for
// why availability is read off the current text rather than tracked separately.
const TEMPLATE_TAGS: Array<{ tag: string; labelKey: TKey }> = [
  { tag: '{Settlement_Date}', labelKey: 'ar.tagSettlementDate' },
  { tag: '{Tax_Invoice_No}', labelKey: 'ar.tagTaxInvoiceNo' },
  { tag: '{Bank_Name}', labelKey: 'ar.tagBankName' },
]

export default function TopLevelConfigSection({
  bank,
  handleBankChange,
  filePrefix,
  setFilePrefix,
  prefixes,
  fileSource,
  description,
  setDescription,
  bankDescriptions,
  setBankDescriptions,
  hasSettlementLayout = false,
  settlementPreview,
}: Props) {
  const { t } = useT()
  const bankCode = bank ? BANK_CODE_MAP[bank] : ''
  // The box holds this bank's own wording, raw — NOT the resolved value. Feeding it
  // the fallback makes the field impossible to clear: deleting the last character
  // empties the per-bank entry, the fallback resolves in its place, and the old text
  // reappears under the cursor. The fallback belongs in the placeholder, where it
  // says what will be used without pretending to be what you typed.
  const ownDescription = (bankCode && bankDescriptions[bankCode]) || ''
  const fallback = description || ''
  const current = bankCode ? ownDescription : fallback
  const appendTag = (tag: string) => {
    const next = `${current} ${tag}`.trim()
    if (bankCode) setBankDescriptions({ ...bankDescriptions, [bankCode]: next })
    else setDescription(next)
  }
  return (
    <div className="section">
      <div className="form-grid">
        <label style={!bank ? { color: '#dc2626', fontWeight: 600 } : {}}>
          {t('cc.cfgBank')} {!bank && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <CustomSearchSelect
          value={bank || null}
          onChange={v => handleBankChange(v as BankDisplayName)}
          options={BANK_OPTIONS}
          placeholder={t('cc.cfgBankPlaceholder')}
          hasError={!bank}
          aria-label={t('cc.cfgBank')}
        />

        <label style={!filePrefix ? { color: '#dc2626', fontWeight: 600 } : {}}>
          {t('cc.cfgFilePrefix')} {!filePrefix && <span style={{ color: '#dc2626' }}>*</span>}
          <span className="gl-help-tip" title={t('cc.cfgFilePrefixHelp')}>
            ?
          </span>
        </label>
        {/* Carmen's own journal books (gl-prefix), same picker as the review queue's JV header. */}
        <CustomSearchSelect
          value={filePrefix || null}
          onChange={setFilePrefix}
          options={prefixes}
          placeholder="Select prefix..."
          hasError={!filePrefix}
          aria-label={t('cc.cfgFilePrefix')}
        />

        <label
          htmlFor="fileSource"
          style={!fileSource ? { color: '#dc2626', fontWeight: 600 } : {}}
        >
          {t('cc.cfgFileSource')} {!fileSource && <span style={{ color: '#dc2626' }}>*</span>}
          <span className="gl-help-tip" title={t('cc.cfgFileSourceHelp')}>
            ?
          </span>
        </label>
        <div>
          <input
            id="fileSource"
            type="text"
            aria-label={t('cc.cfgFileSource')}
            placeholder={t('cc.cfgFileSourcePlaceholder')}
            value={fileSource}
            readOnly
            title={t('cc.cfgFileSourceAuto')}
            style={{
              cursor: 'default',
              // theme-aware muted token (defined for light + dark); color stays
              // from the global input rule so contrast is correct in both themes.
              background: 'var(--muted)',
              ...(!fileSource
                ? { borderColor: 'var(--rose)', background: 'var(--btn-err-bg, #fff1f2)' }
                : {}),
            }}
          />
          <small style={{ display: 'block', marginTop: 2, color: 'var(--text-3)' }}>
            {t('cc.cfgFileSourceAuto')}
          </small>
        </div>

        {/* One field, scoped to the selected bank — the same way File Source is.
            It shows the wording that is actually in effect: this bank's own if it
            has one, else the value the BU set before descriptions were per-bank.
            Editing writes it against the selected bank, which the line underneath
            says out loud; the BU-wide value stays in place as the fallback for
            banks nobody has got to yet, and needs no field of its own to do that. */}
        <label htmlFor="description">
          {t('cc.cfgDescription')}
          <span className="gl-help-tip" title={t('cc.cfgDescriptionHelp')}>
            ?
          </span>
        </label>
        <div>
          <input
            id="description"
            type="text"
            aria-label={t('cc.cfgDescription')}
            placeholder={(bankCode && fallback) || t('cc.cfgDescriptionPlaceholder')}
            value={bankCode ? ownDescription : fallback}
            onChange={e =>
              bankCode
                ? setBankDescriptions({ ...bankDescriptions, [bankCode]: e.target.value })
                : setDescription(e.target.value)
            }
          />
          <small style={{ display: 'block', marginTop: 2, color: 'var(--text-3)' }}>
            {!bankCode
              ? t('cc.cfgDescSelectBank')
              : !ownDescription && fallback
                ? t('cc.cfgDescEmpty', { bank: bankCode, fallback })
                : t('cc.cfgDescApplies', { bank: bankCode })}
          </small>
        </div>

        {hasSettlementLayout && (
          <div className="ar-desc-extras" style={{ gridColumn: '1 / -1' }}>
            <div className="ar-tags" role="group">
              {TEMPLATE_TAGS.map(({ tag, labelKey }) => {
                const label = t(labelKey)
                const added = current.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    className="ar-tag"
                    disabled={added}
                    onClick={() => appendTag(tag)}
                    title={
                      added
                        ? t('ar.tagAdded', { field: label })
                        : t('ar.tagInsert', { field: label })
                    }
                  >
                    {added ? <Check size={12} /> : <Plus size={12} />}
                    {label}
                  </button>
                )
              })}
            </div>
            <p className="ar-example">
              <span aria-hidden="true">→</span>
              <span className="ar-example-value">{settlementPreview || t('ar.templateEmpty')}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
