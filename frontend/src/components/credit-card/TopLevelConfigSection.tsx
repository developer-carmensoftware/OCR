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
  // The box holds this bank's own wording, raw — NOT the resolved value. Feeding it
  // the fallback makes the field impossible to clear: deleting the last character
  // empties the per-bank entry, the fallback resolves in its place, and the old text
  // reappears under the cursor. The fallback belongs in the placeholder, where it
  // says what will be used without pretending to be what you typed.
  const ownDescription = (bankCode && bankDescriptions[bankCode]) || ''
  const fallback = description || ''
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

        {/* One field, scoped to the selected bank — the same way File Source is.
            It shows the wording that is actually in effect: this bank's own if it
            has one, else the value the BU set before descriptions were per-bank.
            Editing writes it against the selected bank, which the line underneath
            says out loud; the BU-wide value stays in place as the fallback for
            banks nobody has got to yet, and needs no field of its own to do that. */}
        <label htmlFor="description">
          Description
          <span
            className="gl-help-tip"
            title="Goes on the journal voucher and the input-tax record for this bank's documents."
          >
            ?
          </span>
        </label>
        <div>
          <input
            id="description"
            type="text"
            aria-label="Description"
            placeholder={(bankCode && fallback) || 'Additional details'}
            value={bankCode ? ownDescription : fallback}
            onChange={e =>
              bankCode
                ? setBankDescriptions({ ...bankDescriptions, [bankCode]: e.target.value })
                : setDescription(e.target.value)
            }
          />
          <small style={{ display: 'block', marginTop: 2, color: 'var(--text-3)' }}>
            {!bankCode
              ? 'Select a bank to set this per bank'
              : ownDescription
                ? `Applies to ${bankCode} documents`
                : fallback
                  ? `Empty — ${bankCode} documents use "${fallback}"`
                  : `Applies to ${bankCode} documents`}
          </small>
        </div>
      </div>
    </div>
  )
}
