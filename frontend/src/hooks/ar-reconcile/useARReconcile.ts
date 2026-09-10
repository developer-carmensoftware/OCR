import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  getARSettings,
  getSamplePaymentTypes,
  previewARJv,
  POST_TYPES,
  saveARSettings,
  type ARBankOption,
  type ARBlocker,
  type ARMappingItem,
  type ARPreview,
  type PostType,
} from '../../lib/api/arReconcile'
import { suggestPaymentTypes } from '../../lib/api/mapping'
import { useMappingData } from '../mapping/useMappingData'
import type { Suggestion } from '../mapping/useMappingSuggestions'
import type { FieldMapping } from '../../types/api'

/**
 * State for the Detailed Credit Card AR Reconciliation settings screen.
 *
 * Two things here are deliberate rather than incidental:
 *
 * **Both mapping sets are held at once.** Detail and Summary are different vocabularies
 * over the same document, each with its own accounts, and the save sends both back — so
 * flipping the toggle to look at Summary and pressing Save cannot delete the Detail rows.
 * It also lets the toggle show what switching would cost before it is switched.
 *
 * **The preview is recomputed on committed change, not per keystroke.** The server owns
 * the JV arithmetic (there is no browser-side builder for this feature, on purpose), so
 * every recompute is a request; a change to a dropdown or the toggle is one, a character
 * typed into the description template is not until the field is left.
 */

const DEFAULT_TEMPLATE = 'Credit Card AR Reconcile {Settlement_Date}'

/**
 * Everything a save would send, flattened — the basis for `dirty`.
 *
 * Spelled out rather than `JSON.stringify` over the state objects, because a row the server
 * sent and a row `addCustomType` built have different key orders for the same values, and a
 * stringify would call that an edit. Listing the fields also keeps this honest by
 * construction: it is exactly the payload in `save()` minus `bank_code`, so a field added
 * there without being added here is a field whose change would not warn.
 */
function fingerprint(
  enabled: boolean,
  postType: PostType,
  template: string,
  debit: FieldMapping,
  sets: Record<string, ARMappingItem[]>
): string {
  return JSON.stringify([
    enabled,
    postType,
    template.trim(),
    debit.dept,
    debit.acc,
    ...POST_TYPES.map(pt =>
      (sets[pt] || []).map(r => [
        r.payment_type_code,
        r.credit_dept_code || '',
        r.credit_account_code || '',
        r.is_active,
      ])
    ),
  ])
}

export interface ARReconcileHook {
  loading: boolean
  saving: boolean
  /** Something on the form differs from what the server last confirmed. The whole screen
   *  is one Save at the foot of a long form, and its own Back link is a hash navigation —
   *  so without this, a mapped table is thrown away by the most convenient click on it. */
  dirty: boolean
  bankCode: string
  setBankCode: (code: string) => void
  /** The selector's options, from the server. FRD §3.1 lists SCB/BBL/BAY beside KBANK so
   *  the Phase 2 roadmap is visible; which of them this release can read is `supported`,
   *  and only the server knows it. */
  banks: ARBankOption[]
  enabled: boolean
  setEnabled: (v: boolean) => void
  postType: PostType
  setPostType: (v: PostType) => void
  template: string
  setTemplate: (v: string) => void
  debit: FieldMapping
  setDebit: (m: FieldMapping) => void
  /** Prefilled from the BU's credit-card `net` mapping — the account this JV must clear. */
  debitDefault: FieldMapping | null
  rows: ARMappingItem[]
  mappedCount: (pt: PostType) => number
  rowCount: (pt: PostType) => number
  setRowMapping: (code: string, field: keyof FieldMapping, value: string) => void
  addCustomType: (code: string) => void
  removeType: (code: string) => void
  suggestions: Record<string, Suggestion | null>
  suggestLoading: boolean
  runSuggest: () => Promise<void>
  acceptSuggestion: (code: string) => void
  rejectSuggestion: (code: string) => void
  preview: ARPreview | null
  previewLoading: boolean
  refreshPreview: () => void
  blockers: ARBlocker[]
  save: () => Promise<void>
  masterAccounts: ReturnType<typeof useMappingData>['masterAccounts']
  masterDepartments: ReturnType<typeof useMappingData>['masterDepartments']
  loadingOpts: boolean
  reloadCodes: () => Promise<void>
}

export function useARReconcile(initialBank = 'KBANK'): ARReconcileHook {
  const { masterAccounts, masterDepartments, loadingOpts, loadInitialData } = useMappingData()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bankCode, setBankCodeState] = useState(initialBank)
  const [enabled, setEnabled] = useState(false)
  const [postType, setPostType] = useState<PostType>('Detail')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [debit, setDebit] = useState<FieldMapping>({ dept: '', acc: '' })
  const [debitDefault, setDebitDefault] = useState<FieldMapping | null>(null)
  const [sets, setSets] = useState<Record<string, ARMappingItem[]>>({ Detail: [], Summary: [] })
  const [blockers, setBlockers] = useState<ARBlocker[]>([])
  const [banks, setBanks] = useState<ARBankOption[]>([])
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | null>>({})
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [preview, setPreview] = useState<ARPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  // What the server last confirmed, as a fingerprint. `null` until the first load lands, so
  // an empty form mid-fetch is never "dirty".
  const [savedPrint, setSavedPrint] = useState<string | null>(null)

  const rows = sets[postType] || []

  // Monotonic guard: switching bank or post type fires a new preview while the previous
  // one is still in flight, and the slower answer must not repaint over the newer one.
  const previewSeq = useRef(0)

  const load = useCallback(async (code: string) => {
    setLoading(true)
    try {
      const s = await getARSettings(code)
      setEnabled(s.enabled)
      setPostType(s.post_type)
      const tmpl = s.jv_description_template || DEFAULT_TEMPLATE
      setTemplate(tmpl)
      const d = { dept: s.debit_dept_code || '', acc: s.debit_account_code || '' }
      setDebit(d)
      setDebitDefault(d.dept || d.acc ? d : null)
      setBlockers(s.blockers || [])
      setBanks(s.banks || [])

      const detail = s.mappings?.Detail || []
      const summary = s.mappings?.Summary || []
      // A BU with no rows yet cannot map anything, and the only other way to get rows is
      // to receive a document and be charged for it. Seed the printed vocabulary instead.
      const seeded = detail.length === 0 && summary.length === 0
      const next = seeded
        ? await getSamplePaymentTypes()
            .catch(() => [] as ARMappingItem[])
            .then(sample => ({
              Detail: sample,
              Summary: dedupe(
                sample.map(i => ({ ...i, payment_type_code: firstToken(i.payment_type_code) }))
              ),
            }))
        : { Detail: detail, Summary: summary }
      setSets(next)
      // Taken from the values just fetched, not from state — the setters above have not
      // applied yet. Seeded rows are part of the baseline on purpose: nobody typed them, so
      // arriving on a fresh BU and leaving again must not ask about discarding anything.
      setSavedPrint(fingerprint(s.enabled, s.post_type, tmpl, d, next))
    } catch (err) {
      console.error('AR settings load failed:', err)
      toast.error('Could not load AR reconciliation settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(bankCode)
  }, [bankCode, load])

  useEffect(() => {
    void loadInitialData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setBankCode = (code: string) => {
    setSuggestions({})
    setBankCodeState(code)
  }

  const setRowMapping = (code: string, field: keyof FieldMapping, value: string) => {
    setSets(prev => ({
      ...prev,
      [postType]: (prev[postType] || []).map(r =>
        r.payment_type_code === code
          ? {
              ...r,
              [field === 'dept' ? 'credit_dept_code' : 'credit_account_code']: value,
            }
          : r
      ),
    }))
  }

  const addCustomType = (raw: string) => {
    const code = raw.trim().toUpperCase()
    if (!code) return
    if ((sets[postType] || []).some(r => r.payment_type_code === code)) {
      toast.error(`${code} is already in the table`)
      return
    }
    setSets(prev => ({
      ...prev,
      [postType]: [
        ...(prev[postType] || []),
        { payment_type_code: code, credit_dept_code: '', credit_account_code: '', is_active: true },
      ],
    }))
  }

  const removeType = (code: string) => {
    setSets(prev => ({
      ...prev,
      [postType]: (prev[postType] || []).filter(r => r.payment_type_code !== code),
    }))
  }

  const runSuggest = async () => {
    const need = rows
      .filter(r => !r.credit_dept_code || !r.credit_account_code)
      .map(r => r.payment_type_code)
    if (need.length === 0) {
      toast.info('Every payment type is already mapped')
      return
    }
    setSuggestLoading(true)
    try {
      const result = await suggestPaymentTypes({
        bank_code: bankCode,
        payment_types: need,
        accounts: masterAccounts.map(a => ({ code: a.code, name: a.name, type: a.type })),
        departments: masterDepartments.map(d => ({
          code: d.code,
          name: d.name,
          allowed_accounts: d.allowedAccounts,
        })),
      })
      const next: Record<string, Suggestion> = {}
      Object.entries(result.suggestions || {}).forEach(([t, val]) => {
        if (val && (val.dept || val.acc))
          next[t] = { dept: val.dept || null, acc: val.acc || null, source: 'ai' }
      })
      setSuggestions(prev => ({ ...prev, ...next }))
      if (Object.keys(next).length === 0) toast.info('No suggestion could be made')
    } catch (err) {
      console.error('AR suggest failed:', err)
      toast.error('AI Auto-Map failed')
    } finally {
      setSuggestLoading(false)
    }
  }

  const acceptSuggestion = (code: string) => {
    const s = suggestions[code]
    if (!s) return
    setSets(prev => ({
      ...prev,
      [postType]: (prev[postType] || []).map(r =>
        r.payment_type_code === code
          ? {
              ...r,
              credit_dept_code: s.dept || r.credit_dept_code,
              credit_account_code: s.acc || r.credit_account_code,
            }
          : r
      ),
    }))
    setSuggestions(prev => ({ ...prev, [code]: null }))
  }

  const rejectSuggestion = (code: string) => setSuggestions(prev => ({ ...prev, [code]: null }))

  const refreshPreview = useCallback(() => {
    const seq = ++previewSeq.current
    setPreviewLoading(true)
    previewARJv({
      bank_code: bankCode,
      post_type: postType,
      jv_description_template: template,
      debit_dept_code: debit.dept,
      debit_account_code: debit.acc,
      mappings: sets[postType] || [],
    })
      .then(p => {
        if (seq === previewSeq.current) setPreview(p)
      })
      .catch(err => {
        if (seq === previewSeq.current) {
          console.error('AR preview failed:', err)
          setPreview(null)
        }
      })
      .finally(() => {
        if (seq === previewSeq.current) setPreviewLoading(false)
      })
  }, [bankCode, postType, template, debit.dept, debit.acc, sets])

  // Every committed change: post type, a dropdown, the bank, a row added or removed.
  // `template` is in the dependency list but the field itself only writes on blur.
  useEffect(() => {
    if (loading) return
    refreshPreview()
  }, [loading, refreshPreview])

  const save = async () => {
    setSaving(true)
    try {
      await saveARSettings({
        bank_code: bankCode,
        enabled,
        post_type: postType,
        jv_description_template: template,
        debit_dept_code: debit.dept || null,
        debit_account_code: debit.acc || null,
        mappings: sets,
      })
      toast.success('Settings saved')
      await load(bankCode)
    } catch (err) {
      console.error('AR settings save failed:', err)
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const rowCount = (pt: PostType) => (sets[pt] || []).length
  const mappedCount = (pt: PostType) =>
    (sets[pt] || []).filter(r => r.credit_dept_code && r.credit_account_code).length

  // `save()` reloads on success, which re-baselines this — so there is no second place
  // that has to remember to clear the flag.
  const dirty =
    savedPrint !== null && fingerprint(enabled, postType, template, debit, sets) !== savedPrint

  return {
    loading,
    saving,
    dirty,
    bankCode,
    setBankCode,
    banks,
    enabled,
    setEnabled,
    postType,
    setPostType,
    template,
    setTemplate,
    debit,
    setDebit,
    debitDefault,
    rows,
    rowCount,
    mappedCount,
    setRowMapping,
    addCustomType,
    removeType,
    suggestions,
    suggestLoading,
    runSuggest,
    acceptSuggestion,
    rejectSuggestion,
    preview,
    previewLoading,
    refreshPreview,
    blockers,
    save,
    masterAccounts,
    masterDepartments,
    loadingOpts,
    reloadCodes: loadInitialData,
  }
}

/** `VS INTER UP PREM` → `VS`. Mirrors `group_key` in ar_reconcile_jv.py, and only for
 *  seeding the Summary rows — the server regroups from the document itself when posting. */
function firstToken(code: string): string {
  const t = code.trim()
  return t.split(' ', 1)[0] || t
}

function dedupe(items: ARMappingItem[]): ARMappingItem[] {
  const seen = new Set<string>()
  return items.filter(i => {
    if (seen.has(i.payment_type_code)) return false
    seen.add(i.payment_type_code)
    return true
  })
}
