import { User, CheckCircle2, AlertTriangle, Plus, RotateCw, Search, Info } from 'lucide-react'
import Badge from '../common/Badge'
import Tooltip from '../common/Tooltip'
import { getCarmenUrl } from '../../lib/url'

export default function VendorSearch({ t, systemVendor, setSystemVendor, vendorSearch, setVendorSearch, showVendorDrop, setShowVendorDrop, filteredVendors, onRefresh, refreshing }) {
  return (
    <div className="vendor-search-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div className="field-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.3rem', position: 'relative' }}>
          <User size={15} /> {t.systemVendor}
          <Tooltip text='Choose vendor or click "+ New Vendor" if not found.' position="top-right">
            <Info size={14} style={{ color: 'var(--text-4)', cursor: 'help' }} />
          </Tooltip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant={systemVendor.code ? 'success' : 'warning'}>
            {systemVendor.code ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {systemVendor.code ? 'Mapped' : 'Unmapped'}
          </Badge>
          <a
            href={getCarmenUrl('/apVendor/create')}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: 600,
              color: 'var(--primary)', background: 'var(--ap-exclude-bg, #eff6ff)',
              border: '1px solid var(--primary)', borderRadius: '999px',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            <Plus size={11} />
            New Vendor
          </a>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh vendor list"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '1.75rem', height: '1.75rem',
              background: 'var(--gray-50)', border: '1px solid var(--border)',
              borderRadius: '999px', cursor: refreshing ? 'not-allowed' : 'pointer',
              color: 'var(--text-3)', opacity: refreshing ? 0.6 : 1,
            }}
          >
            <RotateCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="vendor-search-input-wrap">
        <Search size={15} />
        <input
          type="text"
          className={`vendor-search-input ${systemVendor.code ? 'matched' : ''}`}
          placeholder={t.searchVendor}
          value={vendorSearch}
          onChange={e => {
            setVendorSearch(e.target.value)
            setShowVendorDrop(true)
            if (!e.target.value) setSystemVendor({ code: '', name: '' })
          }}
          onFocus={() => {
            if (systemVendor.code) setVendorSearch('')
            setShowVendorDrop(true)
          }}
          onBlur={() => setTimeout(() => setShowVendorDrop(false), 180)}
        />
      </div>

      {showVendorDrop && (
        <div className="vendor-dropdown">
          {filteredVendors.length > 0
            ? filteredVendors.map(v => {
                const isInactive = v.active === false
                return (
                  <div
                    key={`${v.taxId}-${v.branchNo}`}
                    className={`vendor-dropdown-item${isInactive ? ' vendor-dropdown-item--inactive' : ''}`}
                    style={isInactive ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
                    onMouseDown={isInactive ? undefined : () => {
                      setSystemVendor(v)
                      setVendorSearch(`${v.code} — ${v.name} | TaxID : ${v.taxId || '—'} | Branch No. : ${String(v.branchNo ?? '—').padStart(5, '0')}`)
                      setShowVendorDrop(false)
                    }}
                  >
                    <div className="vd-name" style={isInactive ? { color: 'var(--text-4)' } : undefined}>
                      {v.code} — {v.name}
                      {isInactive && (
                        <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', fontWeight: 600, color: 'var(--rose)', background: 'var(--btn-err-bg, #fee2e2)', borderRadius: '4px', padding: '0 4px' }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="vd-meta">
                      <span className="vd-tax">Tax ID: {v.taxId}</span>
                      {v.branchNo != null && v.branchNo !== '' && (
                        <span className="vd-branch">BranchNo: {v.branchNo}</span>
                      )}
                    </div>
                  </div>
                )
              })
            : (
                <div style={{ padding: '0.75rem 1rem', fontSize: '0.83rem', color: 'var(--text-4)', textAlign: 'center' }}>
                  No vendor found
                </div>
              )
          }
        </div>
      )}
    </div>
  )
}
