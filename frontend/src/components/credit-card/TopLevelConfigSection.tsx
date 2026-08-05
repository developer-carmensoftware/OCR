import { BANKS } from '../../constants'
import { BANK_CODE_MAP } from '../../constants/banks'
import type { BankDisplayName } from '../../types/api'

interface Props {
  bank: BankDisplayName | ''
  handleBankChange: (bank: BankDisplayName | '') => void
  filePrefix: string
  setFilePrefix: (v: string) => void
  fileSource: string
  description: string
  setDescription: (v: string) => void
  bankDescriptions: Record<string, string>
  setBankDescriptions: (v: Record<string, string>) => void
}

export default function TopLevelConfigSection({
  bank,
  handleBankChange,
  filePrefix,
  setFilePrefix,
  fileSource,
  description,
  setDescription,
  bankDescriptions,
  setBankDescriptions,
}: Props) {
  const bankCode = bank ? BANK_CODE_MAP[bank] : ''
  const bankDescription = (bankCode && bankDescriptions[bankCode]) || ''
  return (
    <div className="section">
      <div className="form-grid">
        <label htmlFor="bankSelect" style={!bank ? { color: '#dc2626', fontWeight: 600 } : {}}>
          Bank {!bank && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <select
          id="bankSelect"
          value={bank}
          onChange={e => handleBankChange(e.target.value as BankDisplayName | '')}
          className="search-select-trigger"
          style={{
            width: '100%',
            ...(!bank
              ? { borderColor: 'var(--rose)', background: 'var(--btn-err-bg, #fff1f2)' }
              : {}),
          }}
        >
          <option value="">Select bank...</option>
          {BANKS.map(b => (
            <option key={b.value} value={b.full}>
              {b.full}
            </option>
          ))}
        </select>

        <label
          htmlFor="filePrefix"
          style={!filePrefix ? { color: '#dc2626', fontWeight: 600 } : {}}
        >
          File Prefix {!filePrefix && <span style={{ color: '#dc2626' }}>*</span>}
          <span
            className="gl-help-tip"
            title="Prefix for the journal voucher file name sent to Carmen (e.g. IC for invoice credit, AP for accounts payable)"
          >
            ?
          </span>
        </label>
        <input
          id="filePrefix"
          type="text"
          aria-label="File Prefix"
          placeholder="IC"
          value={filePrefix}
          onChange={e => setFilePrefix(e.target.value.toUpperCase())}
          style={
            !filePrefix
              ? { borderColor: 'var(--rose)', background: 'var(--btn-err-bg, #fff1f2)' }
              : {}
          }
        />

        <label
          htmlFor="fileSource"
          style={!fileSource ? { color: '#dc2626', fontWeight: 600 } : {}}
        >
          File Source {!fileSource && <span style={{ color: '#dc2626' }}>*</span>}
          <span
            className="gl-help-tip"
            title="Carmen Cloud source code that identifies the originating bank or system — one code per bank (e.g. ACBB = Bangkok Bank, ACKB = Kasikornbank, ACBY = Krungsri, ACKC = Krungthai Card). Auto-set from the selected Bank."
          >
            ?
          </span>
        </label>
        <div>
          <input
            id="fileSource"
            type="text"
            aria-label="File Source"
            placeholder="Select a bank"
            value={fileSource}
            readOnly
            title="Auto-set from the selected Bank"
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
            Auto-set from Bank
          </small>
        </div>

        <label htmlFor="description">
          Description
          <span
            className="gl-help-tip"
            title="Used on the journal voucher and the input-tax record for every bank that has no wording of its own."
          >
            ?
          </span>
        </label>
        <input
          id="description"
          type="text"
          aria-label="Description"
          placeholder="Additional details"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        {/* Only meaningful once a bank is chosen — there is nothing to key it on
            otherwise, and an input that silently discards what you type is worse
            than one that is not there. */}
        {bankCode && (
          <>
            <label htmlFor="bankDescription">
              Description for {bankCode}
              <span
                className="gl-help-tip"
                title={`Overrides Description for ${bankCode} documents only. Leave empty to use the Description above.`}
              >
                ?
              </span>
            </label>
            <div>
              <input
                id="bankDescription"
                type="text"
                aria-label={`Description for ${bankCode}`}
                placeholder={description || 'Additional details'}
                value={bankDescription}
                onChange={e =>
                  setBankDescriptions({ ...bankDescriptions, [bankCode]: e.target.value })
                }
              />
              <small style={{ display: 'block', marginTop: 2, color: 'var(--text-3)' }}>
                {bankDescription
                  ? `Only ${bankCode} documents use this`
                  : 'Empty — falls back to Description'}
              </small>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
