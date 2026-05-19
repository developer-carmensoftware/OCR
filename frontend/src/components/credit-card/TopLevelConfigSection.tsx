import type { BankDisplayName } from '../../types/api'

interface Props {
  bank: BankDisplayName | ''
  handleBankChange: (bank: BankDisplayName | '') => void
  filePrefix: string
  setFilePrefix: (v: string) => void
  fileSource: string
  setFileSource: (v: string) => void
  description: string
  setDescription: (v: string) => void
}

export default function TopLevelConfigSection({
  bank,
  handleBankChange,
  filePrefix,
  setFilePrefix,
  fileSource,
  setFileSource,
  description,
  setDescription,
}: Props) {
  return (
    <div className="section">
      <div className="form-grid">
        <label style={!bank ? { color: '#dc2626', fontWeight: 600 } : {}}>
          Bank {!bank && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <select
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
          <option value="Bangkok Bank (BBL)">Bangkok Bank (BBL)</option>
          <option value="Kasikornbank (KBANK)">Kasikornbank (KBANK)</option>
          <option value="Siam Commercial Bank (SCB)">Siam Commercial Bank (SCB)</option>
        </select>

        <label style={!filePrefix ? { color: '#dc2626', fontWeight: 600 } : {}}>
          File Prefix {!filePrefix && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <input
          type="text"
          placeholder="IC"
          value={filePrefix}
          onChange={e => setFilePrefix(e.target.value.toUpperCase())}
          style={
            !filePrefix
              ? { borderColor: 'var(--rose)', background: 'var(--btn-err-bg, #fff1f2)' }
              : {}
          }
        />

        <label style={!fileSource ? { color: '#dc2626', fontWeight: 600 } : {}}>
          File Source {!fileSource && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
        <input
          type="text"
          placeholder="e.g. ACBB, ACKB, ACSC"
          value={fileSource}
          onChange={e => setFileSource(e.target.value)}
          style={
            !fileSource
              ? { borderColor: 'var(--rose)', background: 'var(--btn-err-bg, #fff1f2)' }
              : {}
          }
        />

        <label>Description</label>
        <input
          type="text"
          placeholder="Additional details"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
    </div>
  )
}
