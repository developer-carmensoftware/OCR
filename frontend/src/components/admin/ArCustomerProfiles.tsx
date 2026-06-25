import { useEffect, useReducer, useCallback } from 'react'
import { toast } from 'sonner'
import { Check, Pencil, RefreshCw, Search, X } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import {
  listArProfiles,
  syncArProfiles,
  updateArProfile,
  type ArCustomerProfile,
} from '../../lib/api/adminClient'

// ── State & reducer ───────────────────────────────────────────────────────────

interface ArState {
  profiles: ArCustomerProfile[]
  search: string
  unmappedOnly: boolean
  loading: boolean
  editing: Record<string, string>
  syncing: boolean
}

type ArAction =
  | { type: 'SET_SEARCH'; value: string }
  | { type: 'SET_UNMAPPED_ONLY'; value: boolean }
  | { type: 'FETCH_START' }
  | { type: 'FETCH_DONE'; profiles: ArCustomerProfile[] }
  | { type: 'FETCH_ERROR' }
  | { type: 'START_EDIT'; id: string; code: string }
  | { type: 'UPDATE_EDIT'; id: string; value: string }
  | { type: 'CANCEL_EDIT'; id: string }
  | { type: 'SAVE_DONE'; id: string; updated: ArCustomerProfile }
  | { type: 'SYNC_START' }
  | { type: 'SYNC_DONE' }

const initialState: ArState = {
  profiles: [],
  search: '',
  unmappedOnly: false,
  loading: true,
  editing: {},
  syncing: false,
}

function reducer(state: ArState, action: ArAction): ArState {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, search: action.value }
    case 'SET_UNMAPPED_ONLY':
      return { ...state, unmappedOnly: action.value }
    case 'FETCH_START':
      return { ...state, loading: true }
    case 'FETCH_DONE':
      return { ...state, loading: false, profiles: action.profiles }
    case 'FETCH_ERROR':
      return { ...state, loading: false }
    case 'START_EDIT':
      return { ...state, editing: { ...state.editing, [action.id]: action.code } }
    case 'UPDATE_EDIT':
      return { ...state, editing: { ...state.editing, [action.id]: action.value } }
    case 'CANCEL_EDIT': {
      const editing = { ...state.editing }
      delete editing[action.id]
      return { ...state, editing }
    }
    case 'SAVE_DONE': {
      const editing = { ...state.editing }
      delete editing[action.id]
      return {
        ...state,
        editing,
        profiles: state.profiles.map(p => (p.id === action.id ? action.updated : p)),
      }
    }
    case 'SYNC_START':
      return { ...state, syncing: true }
    case 'SYNC_DONE':
      return { ...state, syncing: false }
    default:
      return state
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArCustomerProfiles({ onMapped }: { onMapped?: () => void }) {
  const { t } = useT()
  const [state, dispatch] = useReducer(reducer, initialState)
  const { profiles, search, unmappedOnly, loading, editing, syncing } = state

  const load = useCallback(() => {
    dispatch({ type: 'FETCH_START' })
    listArProfiles(search || undefined, unmappedOnly)
      .then(profiles => dispatch({ type: 'FETCH_DONE', profiles }))
      .catch(e => {
        toast.error((e as Error).message)
        dispatch({ type: 'FETCH_ERROR' })
      })
  }, [search, unmappedOnly])

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(id)
  }, [load, search])

  const saveEdit = async (id: string) => {
    const val = editing[id]
    if (val === undefined) return
    try {
      const updated = await updateArProfile(id, val)
      dispatch({ type: 'SAVE_DONE', id, updated })
      toast.success(t('orev.ar.saved'))
      onMapped?.() // refresh parent KPI (unmapped_count badge)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const doSync = async () => {
    dispatch({ type: 'SYNC_START' })
    try {
      const res = await syncArProfiles()
      toast.success(t('orev.ar.synced', { n: res.inserted }))
      load()
      onMapped?.() // sync may insert new unmapped profiles → refresh badge
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      dispatch({ type: 'SYNC_DONE' })
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
              aria-label={t('orev.ar.search')}
              value={search}
              onChange={e => dispatch({ type: 'SET_SEARCH', value: e.target.value })}
            />
          </div>
          <label className="orev-ar-filter">
            <input
              type="checkbox"
              checked={unmappedOnly}
              onChange={e => dispatch({ type: 'SET_UNMAPPED_ONLY', value: e.target.checked })}
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
                          aria-label={t('orev.ar.arCode')}
                          value={editing[p.id]}
                          onChange={e =>
                            dispatch({
                              type: 'UPDATE_EDIT',
                              id: p.id,
                              value: e.target.value.toUpperCase(),
                            })
                          }
                          maxLength={50}
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
                            onClick={() => dispatch({ type: 'CANCEL_EDIT', id: p.id })}
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="orev-ar-btn-edit"
                          onClick={() =>
                            dispatch({ type: 'START_EDIT', id: p.id, code: p.carmen_ar_code ?? '' })
                          }
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
