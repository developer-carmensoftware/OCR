import { Plus, Check } from 'lucide-react'
import { BANKS } from '@/shared/constants'
import { BANK_CODE_MAP } from '@/shared/constants/banks'
import type { BankDisplayName } from '@/shared/types/api'
import { useT } from '@/i18n/LanguageContext'
import CustomSearchSelect, {
  type SelectOption,
} from '@/shared/components/common/CustomSearchSelect'
import { descriptionForBank } from '../lib/bankTransforms'
import { DESCRIPTION_TAGS, joinDescription, renderDescription, splitDescription } from '../lib/ccJv'
import '@/styles/pages/ar-reconcile.css'

interface Props {
  bank: BankDisplayName | ''
  handleBankChange: (bank: BankDisplayName | '') => void
  filePrefix: string
  setFilePrefix: (v: string) => void
  /** Carmen's GL prefixes (`GET /carmen/gl-prefix`). */
  prefixes: SelectOption[]
  fileSource: string
  bankDescriptions: Record<string, string>
  setBankDescriptions: (v: Record<string, string>) => void
  /** Whether the selected bank has a settlement layout (`banks.settlement_grouping`) —
   *  such a bank's preview comes from the server, over its own latest real report. */
  hasSettlementLayout?: boolean
  /** The live "renders as" example for the currently-selected bank's settlement JV,
   *  from `useSettlementMapping`'s own preview call. */
  settlementPreview?: string
}

// Every other bank's preview is rendered here, by the same twin the JV posts through,
// over an example document: today's date and a made-up number.
const SAMPLE_DOC_NO = 'INV-0001'

export default function TopLevelConfigSection({
  bank,
  handleBankChange,
  filePrefix,
  setFilePrefix,
  prefixes,
  fileSource,
  bankDescriptions,
  setBankDescriptions,
  hasSettlementLayout = false,
  settlementPreview,
}: Props) {
  const { t } = useT()
  const bankOptions: SelectOption[] = BANKS.map(b => ({
    code: b.full,
    name: t(b.kind === 'gateway' ? 'cc.bankKindGateway' : 'cc.bankKindBank'),
  }))
  const bankCode = bank ? BANK_CODE_MAP[bank] : ''
  // This bank's own wording is the whole story — there is no BU-wide fallback behind it
  // since 2026-09-30, so an empty box is an empty description on the JV. With no bank
  // selected there is nothing to write to, and the field says so rather than editing a
  // default no screen could ever show again.
  const current = (bankCode && bankDescriptions[bankCode]) || ''
  const write = (next: string) => {
    if (bankCode) setBankDescriptions({ ...bankDescriptions, [bankCode]: next })
  }
  // The box edits the free text only; the fields ride after it and are toggled by the
  // chips (`splitDescription`), so a backspace can never break a token.
  const { text, tags } = splitDescription(current)
  const toggleTag = (tag: string) =>
    write(joinDescription(text, tags.includes(tag) ? tags.filter(x => x !== tag) : [...tags, tag]))
  const preview =
    (hasSettlementLayout && settlementPreview) ||
    renderDescription(
      descriptionForBank(bankDescriptions, bankCode),
      new Date().toLocaleDateString('en-GB'),
      SAMPLE_DOC_NO,
      bankCode || undefined
    )
  return (
    <div className="section">
      <div className="form-grid">
        <label style={!bank ? { color: '#dc2626', fontWeight: 600 } : {}}>
          {t('cc.cfgBank')} {!bank && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <CustomSearchSelect
          value={bank || null}
          onChange={v => handleBankChange(v as BankDisplayName)}
          options={bankOptions}
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
          placeholder={t('cc.cfgFilePrefixPh')}
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

        {/* One field, scoped to the selected bank — the same way File Source is. It is
            that bank's Description and nothing else: no BU-wide fallback since 2026-09-30
            (decision-log #33), so what the box and preview show is what the JV posts. */}
        <label htmlFor="description" className="ar-desc-label">
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
            placeholder={t('cc.cfgDescriptionPlaceholder')}
            value={text}
            disabled={!bankCode}
            onChange={e => write(joinDescription(e.target.value, tags))}
          />
          <small style={{ display: 'block', marginTop: 2, color: 'var(--text-3)' }}>
            {!bankCode
              ? t('cc.cfgDescSelectBank')
              : !current.trim()
                ? t('cc.cfgDescEmpty', { bank: bankCode })
                : t('cc.cfgDescApplies', { bank: bankCode })}
          </small>

          {/* In the input's own column, not a full-width row under a divider: the chips
              act on this field and the preview is what it renders to, so they line up
              with it. Each chip is a toggle — ✓ means the field is attached after the
              text, in the order picked; pressing it again detaches it. Every bank gets
              them: nothing is appended on post, so a field is the only way a date or
              number reaches the description. */}
          <div className="ar-desc-extras">
            <div className="ar-tags" role="group" aria-labelledby="ar-tags-label">
              <span id="ar-tags-label" className="ar-tags-label">
                {t('ar.addAfterText')}
              </span>
              {DESCRIPTION_TAGS.map(({ tag, labelKey }) => {
                const label = t(labelKey)
                const added = tags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    className="ar-tag"
                    aria-pressed={added}
                    disabled={!bankCode}
                    onClick={() => toggleTag(tag)}
                    title={
                      added
                        ? t('ar.tagRemove', { field: label })
                        : t('ar.tagInsert', { field: label })
                    }
                  >
                    {added ? <Check size={12} /> : <Plus size={12} />}
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="ar-preview" aria-live="polite">
              <span className="ar-preview-label">{t('ar.preview')}</span>
              <span className="ar-preview-value">{preview || t('ar.templateEmpty')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
