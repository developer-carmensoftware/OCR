import { useEffect, useCallback, useReducer } from 'react'
import { toast } from 'sonner'
import { Check, Pencil, RefreshCw, Search, X } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import {
  listArProfiles,
  syncArProfiles,
  updateArProfile,
  type ArCustomerProfile,
} from '../../lib/api/adminClient'

interface ArCustomerProfilesState {
  profiles: ArCustomerProfile[]
  search: string
  unmappedOnly: boolean
  loading: boolean
  editing: Record<string, string>
  syncing: boolean
}

type ArAction =
  | { type: 'SET_PROFILES'; payload: ArCustomerProfile[] }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_UNMAPPED_ONLY'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SYNCING'; payload: boolean }
  | { type: 'START_EDIT'; payload: ArCustomerProfile }
  | { type: 'CANCEL_EDIT'; payload: string }
  | { type: 'UPDATE_EDIT_VALUE'; payload: { id: string; value: string } }
  | { type: 'SAVE_EDIT'; payload: { id: string; updated: ArCustomerProfile } }

const initialState: ArCustomerProfilesState = {
  profiles: [],
  search: '',
  unmappedOnly: false,
  loading: true,
  editing: {},
  syncing: false,
}

function arProfilesReducer(
  state: ArCustomerProfilesState,
  action: ArAction
): ArCustomerProfilesState {
  switch (action.type) {
    case 'SET_PROFILES':
      return { ...state, profiles: action.payload }
    case 'SET_SEARCH':
      return { ...state, search: action.payload }
    case 'SET_UNMAPPED_ONLY':
      return { ...state, unmappedOnly: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_SYNCING':
      return { ...state, syncing: action.payload }
    case 'START_EDIT':
      return {
        ...state,
        editing: { ...state.editing, [action.payload.id]: action.payload.carmen_ar_code ?? '' },
      }
    case 'CANCEL_EDIT': {
      const editing = { ...state.editing }
      delete editing[action.payload]
      return { ...state, editing }
    }
    case 'UPDATE_EDIT_VALUE':
      return {
        ...state,
        editing: { ...state.editing, [action.payload.id]: action.payload.value },
      }
    case 'SAVE_EDIT': {
      const editing = { ...state.editing }
      delete editing[action.payload.id]
      return {
        ...state,
        profiles: state.profiles.map(p =>
          p.id === action.payload.id ? action.payload.updated : p
        ),
        editing,
      }
    }
    default:
      return state
  }
}

export default function ArCustomerProfiles({ onMapped }: { onMapped?: () => void }) {
  const { t } = useT()
  const [state, dispatch] = useReducer(arProfilesReducer, initialState)
  const { profiles, search, unmappedOnly, loading, editing, syncing } = state

  const load = useCallback(() => {
    dispatch({ type: 'SET_LOADING', payload: true })
    listArProfiles(search || undefined, unmappedOnly)
      .then(res => {
        dispatch({ type: 'SET_PROFILES', payload: res })
      })
      .catch(e => toast.error((e as Error).message))
      .finally(() => dispatch({ type: 'SET_LOADING', payload: false }))
  }, [search, unmappedOnly])

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(id)
  }, [load, search])

  const startEdit = (p: ArCustomerProfile) => dispatch({ type: 'START_EDIT', payload: p })

  const cancelEdit = (id: string) => dispatch({ type: 'CANCEL_EDIT', payload: id })

  const saveEdit = async (id: string) => {
    const val = editing[id]
    if (val === undefined) return
    try {
      const updated = await updateArProfile(id, val)
      dispatch({ type: 'SAVE_EDIT', payload: { id, updated } })
      toast.success(t('orev.ar.saved'))
      onMapped?.() // refresh parent KPI (unmapped_count badge)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const doSync = async () => {
    dispatch({ type: 'SET_SYNCING', payload: true })
    try {
      const res = await syncArProfiles()
      toast.success(t('orev.ar.synced', { n: res.inserted }))
      load()
      onMapped?.() // sync may insert new unmapped profiles → refresh badge
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      dispatch({ type: 'SET_SYNCING', payload: false })
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
              onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
              aria-label={t('orev.ar.search')}
            />
          </div>
          <label className="orev-ar-filter">
            <input
              type="checkbox"
              checked={unmappedOnly}
              onChange={e => dispatch({ type: 'SET_UNMAPPED_ONLY', payload: e.target.checked })}
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
                            dispatch({
                              type: 'UPDATE_EDIT_VALUE',
                              payload: { id: p.id, value: e.target.value.toUpperCase() },
                            })
                          }
                          maxLength={50}
                          aria-label={t('orev.ar.arCode')}
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
