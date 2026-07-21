import { BANKS } from '../../constants'
import type { BankDisplayName } from '../../types/api'

interface Props {
  bank: BankDisplayName | ''
  handleBankChange: (bank: BankDisplayName | '') => void
  filePrefix: string
  setFilePrefix: (v: string) => void
  fileSource: string
  description: string
  setDescription: (v: string) => void
}

export default function TopLevelConfigSection({
  bank,
  handleBankChange,
  filePrefix,
  setFilePrefix,
  fileSource,
  description,
  setDescription,
}: Props) {
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

        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          aria-label="Description"
          placeholder="Additional details"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
    </div>
  )
}
