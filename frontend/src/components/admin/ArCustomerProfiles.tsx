import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Pencil, RefreshCw, Search, X } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import {
  listArProfiles,
  syncArProfiles,
  updateArProfile,
  type ArCustomerProfile,
} from '../../lib/api/adminClient'

export default function ArCustomerProfiles({ onMapped }: { onMapped?: () => void }) {
  const { t } = useT()
  const [profiles, setProfiles] = useState<ArCustomerProfile[]>([])
  const [search, setSearch] = useState('')
  const [unmappedOnly, setUnmappedOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState(false)

  const load = () => {
    setLoading(true)
    listArProfiles(search || undefined, unmappedOnly)
      .then(setProfiles)
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(id)
  }, [search, unmappedOnly])

  const startEdit = (p: ArCustomerProfile) =>
    setEditing(prev => ({ ...prev, [p.id]: p.carmen_ar_code ?? '' }))

  const cancelEdit = (id: string) =>
    setEditing(prev => {
      const n = { ...prev }
      delete n[id]
      return n
    })

  const saveEdit = async (id: string) => {
    const val = editing[id]
    if (val === undefined) return
    try {
      const updated = await updateArProfile(id, val)
      setProfiles(ps => ps.map(p => (p.id === id ? updated : p)))
      cancelEdit(id)
      toast.success(t('orev.ar.saved'))
      onMapped?.() // refresh parent KPI (unmapped_count badge)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const doSync = async () => {
    setSyncing(true)
    try {
      const res = await syncArProfiles()
      toast.success(t('orev.ar.synced', { n: res.inserted }))
      load()
      onMapped?.() // sync may insert new unmapped profiles → refresh badge
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="orev-ar-panel">
      <div className="orev-ar-toolbar">
        <div>
          <h3 className="orev-ar-heading">{t('orev.ar.heading')}</h3>
          <p className="orev-ar-sub">{t('orev.ar.sub')}</p>
        </div>
        <div className="orev-ar-actions">
          <div className="orev-search-wrap">
            <Search size={14} className="orev-search-icon" />
            <input
              type="text"
              className="orev-search"
              placeholder={t('orev.ar.search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <label className="orev-ar-filter">
            <input
              type="checkbox"
              checked={unmappedOnly}
              onChange={e => setUnmappedOnly(e.target.checked)}
            />
            <span>{t('orev.ar.unmappedOnly')}</span>
          </label>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={doSync}
            disabled={syncing}
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {t('orev.ar.sync')}
          </button>
        </div>
      </div>

      <div className="orev-ar-table-wrap">
        <table className="orev-ar-table">
          <thead>
            <tr>
              <th>{t('orev.ar.colCompany')}</th>
              <th>{t('orev.ar.colTaxId')}</th>
              <th>{t('orev.ar.colBranch')}</th>
              <th>{t('orev.ar.arCode')}</th>
              <th>{t('orev.ar.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="orev-ar-empty">
                  Loading…
                </td>
              </tr>
            ) : profiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="orev-ar-empty">
                  {t('orev.list.noMatch')}
                </td>
              </tr>
            ) : (
              profiles.map(p => {
                const isEditing = editing[p.id] !== undefined
                return (
                  <tr key={p.id}>
                    <td className="orev-ar-name">{p.buyer_name}</td>
                    <td className="text-mono">{p.buyer_tax_id || '—'}</td>
                    <td>{p.buyer_branch === '00000' ? 'HQ' : p.buyer_branch || '—'}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="orev-ar-input"
                          value={editing[p.id]}
                          onChange={e =>
                            setEditing(prev => ({ ...prev, [p.id]: e.target.value.toUpperCase() }))
                          }
                          maxLength={50}
                          autoFocus
                        />
                      ) : p.carmen_ar_code ? (
                        <span className="orev-ar-code">{p.carmen_ar_code}</span>
                      ) : (
                        <span className="orev-ar-missing">{t('orev.ar.noCode')}</span>
                      )}
                    </td>
                    <td className="orev-ar-act-cell">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="orev-ar-btn-save"
                            onClick={() => saveEdit(p.id)}
                          >
                            <Check size={14} /> {t('orev.ar.save')}
                          </button>
                          <button
                            type="button"
                            className="orev-ar-btn-cancel"
                            onClick={() => cancelEdit(p.id)}
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="orev-ar-btn-edit"
                          onClick={() => startEdit(p)}
                        >
                          <Pencil size={12} /> {t('orev.ar.edit')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="orev-ar-footer">
        <span>{t('orev.ar.count', { n: profiles.length })}</span>
      </div>
    </div>
  )
}
