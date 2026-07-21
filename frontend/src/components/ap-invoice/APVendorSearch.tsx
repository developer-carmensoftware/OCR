import { User, CheckCircle2, AlertTriangle, Plus, RotateCw, Search, Info } from 'lucide-react'
import Badge from '../common/Badge'
import Tooltip from '../common/Tooltip'
import { getCarmenUrl } from '../../lib/url'
import { useT } from '../../i18n/LanguageContext'
import type { Vendor } from '../../hooks/ap-invoice/useAPVendor'
import type React from 'react'

interface Props {
  systemVendor: Vendor
  setSystemVendor: React.Dispatch<React.SetStateAction<Vendor>>
  vendorSearch: string
  setVendorSearch: (v: string) => void
  showVendorDrop: boolean
  setShowVendorDrop: (v: boolean) => void
  filteredVendors: Vendor[]
  onRefresh: () => void
  refreshing: boolean
}

export default function VendorSearch({
  systemVendor,
  setSystemVendor,
  vendorSearch,
  setVendorSearch,
  showVendorDrop,
  setShowVendorDrop,
  filteredVendors,
  onRefresh,
  refreshing,
}: Props) {
  const { t } = useT()
  return (
    <div className="vendor-search-wrap">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.6rem',
        }}
      >
        <div
          className="field-label"
          style={{
            marginBottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            position: 'relative',
          }}
        >
          <User size={15} /> {t('ap.systemVendor')}
          <Tooltip text={t('common.vendorTooltip')} position="top-right">
            <Info size={14} style={{ color: 'var(--text-4)', cursor: 'help' }} />
          </Tooltip>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant={systemVendor.code ? 'success' : 'warning'}>
            {systemVendor.code ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {systemVendor.code ? t('common.mapped') : t('common.unmapped')}
          </Badge>
          <a
            href={getCarmenUrl('/apVendor/create')}
            target="_blank"
            rel="noopener noreferrer"
            className="vendor-new-btn"
          >
            <Plus size={11} /> {t('common.newVendor')}
          </a>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title={t('common.refreshVendor')}
            className="vendor-refresh-btn"
            style={{
              cursor: refreshing ? 'not-allowed' : 'pointer',
              opacity: refreshing ? 0.6 : 1,
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
          aria-label={t('ap.searchVendor')}
          placeholder={t('ap.searchVendor')}
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
          {filteredVendors.length > 0 ? (
            filteredVendors.map(v => {
              const isInactive = v.active === false
              return (
                <div
                  key={`${v.taxId}-${v.branchNo}`}
                  className={`vendor-dropdown-item${isInactive ? ' vendor-dropdown-item--inactive' : ''}`}
                  style={
                    isInactive
                      ? { opacity: 0.45, cursor: 'not-allowed', pointerEvents: 'none' }
                      : undefined
                  }
                  role="button"
                  tabIndex={isInactive ? -1 : 0}
                  onMouseDown={
                    isInactive
                      ? undefined
                      : () => {
                          setSystemVendor(v)
                          setVendorSearch(
                            `${v.code} — ${v.name} | TaxID : ${v.taxId || '—'} | Branch No. : ${String(v.branchNo ?? '—').padStart(5, '0')}`
                          )
                          setShowVendorDrop(false)
                        }
                  }
                  onKeyDown={
                    isInactive
                      ? undefined
                      : e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSystemVendor(v)
                            setVendorSearch(
                              `${v.code} — ${v.name} | TaxID : ${v.taxId || '—'} | Branch No. : ${String(v.branchNo ?? '—').padStart(5, '0')}`
                            )
                            setShowVendorDrop(false)
                          }
                        }
                  }
                >
                  <div
                    className="vd-name"
                    style={isInactive ? { color: 'var(--text-4)' } : undefined}
                  >
                    {v.code} — {v.name}
                    {isInactive && (
                      <span
                        style={{
                          marginLeft: '0.4rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--rose)',
                          background: 'var(--btn-err-bg, #fee2e2)',
                          borderRadius: '4px',
                          padding: '0 4px',
                        }}
                      >
                        {t('common.inactive')}
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
          ) : (
            <div
              style={{
                padding: '0.75rem 1rem',
                fontSize: '0.83rem',
                color: 'var(--text-4)',
                textAlign: 'center',
              }}
            >
              {t('common.noVendorFound')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
