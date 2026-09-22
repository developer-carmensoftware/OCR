import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  getARSettings,
  getSamplePaymentTypes,
  previewARJv,
  POST_TYPES,
  type ARMappingItem,
  type ARPreview,
  type PostType,
} from '../../lib/api/arReconcile'
import { suggestPaymentTypes } from '../../lib/api/mapping'
import { useT } from '../../i18n/LanguageContext'
import type { Suggestion } from './useMappingSuggestions'
import type { MasterAccount, MasterDepartment } from './useMappingData'
import type { FieldMapping } from '../../types/api'

/**
 * The merged mapping page's Settlement card — decision #3 folded this feature's own
 * credit-side mapping table into `bu_accounting_mapping_entries`, so this hook no
 * longer owns a save of its own or a fetch of the accounting config: `savedMappings`
 * (the page's already-loaded, full merged dict — commission/tax/net, every
 * fee-invoice payment type, and this bank's settlement rows, all in one shape) is
 * injected, and `mappingsToSave` is what the page folds back into its own dict right
 * before the one `PUT /config/accounting` call. Only the posting profile itself
 * (enabled / post type / template) and the two payment-type sets are this hook's own.
 *
 * **Both post-type sets are held at once**, same reasoning `useARReconcile` always
 * had: Detail and Summary are different vocabularies over the same document, each
 * with its own accounts, and losing Summary's rows because the toggle sat on Detail
 * when Save was pressed would be a real loss, not a display quirk.
 */

const DEFAULT_TEMPLATE = 'Credit Card AR Reconcile {Settlement_Date}'
const SOURCE_BY_POST_TYPE: Record<PostType, string> = {
  Detail: 'settlement_detail',
  Summary: 'settlement_summary',
}

export interface SettlementRow {
  code: string
  mapping: FieldMapping
}

/** Everything a save would send from this card, flattened — the basis for `dirty`.
 *  Spelled out rather than `JSON.stringify` over the state, for the same reason
 *  `useARReconcile`'s original `fingerprint` was: a row the server sent and a row
 *  `addCustomType` built can differ only in key order for the same values, and a
 *  stringify would call that an edit. */
function fingerprint(
  enabled: boolean,
  postType: PostType,
  template: string,
  sets: Record<PostType, Record<string, FieldMapping>>
): string {
  return JSON.stringify([
    enabled,
    postType,
    template.trim(),
    ...POST_TYPES.map(pt =>
      Object.entries(sets[pt] || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, m]) => [code, m.dept || '', m.acc || ''])
    ),
  ])
}

export interface SettlementMappingHook {
  loading: boolean
  hasSettlementLayout: boolean
  enabled: boolean
  setEnabled: (v: boolean) => void
  postType: PostType
  setPostType: (v: PostType) => void
  template: string
  setTemplate: (v: string) => void
  rows: SettlementRow[]
  mappedCount: (pt: PostType) => number
  rowCount: (pt: PostType) => number
  setRowMapping: (code: string, field: 'dept' | 'acc', value: string) => void
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
  /** Both post-type sets, source-tagged, in the shape the page's own mapping dict
   *  already is — merge this in (spread after the page's own entries so a settlement
   *  key never shadows a fee-invoice one of the same literal string, and vice versa
   *  only matters for a single-word scheme, which is the case decision #3 says is
   *  fine to share) right before the page's one save call. */
  mappingsToSave: Record<string, FieldMapping>
  dirty: boolean
  reset: () => void
}

export function useSettlementMapping(
  bankCode: string,
  savedMappings: Record<string, FieldMapping>,
  masterAccounts: MasterAccount[],
  masterDepartments: MasterDepartment[]
): SettlementMappingHook {
  const { t } = useT()
  const tRef = useRef(t)
  tRef.current = t

  const [loading, setLoading] = useState(true)
  const [hasSettlementLayout, setHasSettlementLayout] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [postType, setPostType] = useState<PostType>('Detail')
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [sets, setSets] = useState<Record<PostType, Record<string, FieldMapping>>>({
    Detail: {},
    Summary: {},
  })
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | null>>({})
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [preview, setPreview] = useState<ARPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [savedPrint, setSavedPrint] = useState<string | null>(null)

  const previewSeq = useRef(0)

  const load = useCallback(async (code: string, mappings: Record<string, FieldMapping>) => {
    setLoading(true)
    setSuggestions({})
    try {
      const s = await getARSettings(code)
      setHasSettlementLayout(s.has_settlement_layout)
      setEnabled(s.enabled)
      setPostType(s.post_type)
      const tmpl = s.jv_description_template || DEFAULT_TEMPLATE
      setTemplate(tmpl)

      const bySource = (source: string): Record<string, FieldMapping> => {
        const out: Record<string, FieldMapping> = {}
        for (const [code2, m] of Object.entries(mappings)) {
          if (m.source === source) out[code2] = m
        }
        return out
      }
      const detail = bySource(SOURCE_BY_POST_TYPE.Detail)
      const summary = bySource(SOURCE_BY_POST_TYPE.Summary)

      // A BU with no rows yet cannot map anything, and the only other way to get rows is
      // to receive a document and be charged for it. Seed the printed vocabulary instead
      // — per post type, not only when both are empty: a BU that mapped Detail by hand
      // and never switched to Summary must not be stuck at "0/0 mapped" with no seed
      // offered.
      const needsSample =
        s.has_settlement_layout &&
        (Object.keys(detail).length === 0 || Object.keys(summary).length === 0)
      const sample = needsSample
        ? await getSamplePaymentTypes(code).catch(() => [] as ARMappingItem[])
        : []
      const next: Record<PostType, Record<string, FieldMapping>> = {
        Detail:
          Object.keys(detail).length > 0 ? detail : blankRows(sample.map(i => i.payment_type_code)),
        Summary:
          Object.keys(summary).length > 0
            ? summary
            : blankRows(dedupe(sample.map(i => firstToken(i.payment_type_code)))),
      }
      setSets(next)
      setSavedPrint(fingerprint(s.enabled, s.post_type, tmpl, next))
    } catch (err) {
      console.error('AR settings load failed:', err)
      toast.error(tRef.current('ar.toastLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(bankCode, savedMappings)
    // `savedMappings` intentionally excluded: it is the page's load-once snapshot, and a
    // later edit elsewhere on the page (commission/tax/net, a fee-invoice payment type)
    // must not re-seed this card's rows out from under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, load])

  const rows: SettlementRow[] = Object.entries(sets[postType] || {}).map(([code, mapping]) => ({
    code,
    mapping,
  }))

  const setRowMapping = (code: string, field: 'dept' | 'acc', value: string) => {
    setSets(prev => ({
      ...prev,
      [postType]: {
        ...prev[postType],
        [code]: { ...(prev[postType][code] || {}), [field]: value },
      },
    }))
  }

  const addCustomType = (raw: string) => {
    const code = raw.trim().toUpperCase()
    if (!code) return
    if (sets[postType]?.[code]) {
      toast.error(t('ar.toastDuplicateType', { code }))
      return
    }
    setSets(prev => ({
      ...prev,
      [postType]: {
        ...prev[postType],
        [code]: { dept: '', acc: '', source: SOURCE_BY_POST_TYPE[postType] },
      },
    }))
  }

  const removeType = (code: string) => {
    setSets(prev => {
      const next = { ...prev[postType] }
      delete next[code]
      return { ...prev, [postType]: next }
    })
  }

  const runSuggest = async () => {
    const need = rows.filter(r => !r.mapping.dept || !r.mapping.acc).map(r => r.code)
    if (need.length === 0) {
      toast.info(t('ar.toastAllMapped'))
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
      Object.entries(result.suggestions || {}).forEach(([code, val]) => {
        if (val && (val.dept || val.acc))
          next[code] = { dept: val.dept || null, acc: val.acc || null, source: 'ai' }
      })
      setSuggestions(prev => ({ ...prev, ...next }))
      if (Object.keys(next).length === 0) toast.info(t('ar.toastNoSuggestion'))
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
      [postType]: {
        ...prev[postType],
        [code]: {
          ...(prev[postType][code] || {}),
          dept: s.dept || prev[postType][code]?.dept || '',
          acc: s.acc || prev[postType][code]?.acc || '',
        },
      },
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
      // The page's whole live dict plus this card's own two sets — the same "send
      // everything, let the server look up only what it needs" contract the merged
      // page's save uses.
      mappings: { ...savedMappings, ...sets.Detail, ...sets.Summary },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, postType, template, sets])

  useEffect(() => {
    if (loading || !hasSettlementLayout) return
    refreshPreview()
  }, [loading, hasSettlementLayout, refreshPreview])

  const rowCount = (pt: PostType) => Object.keys(sets[pt] || {}).length
  const mappedCount = (pt: PostType) =>
    Object.values(sets[pt] || {}).filter(m => m.dept && m.acc).length

  const dirty = savedPrint !== null && fingerprint(enabled, postType, template, sets) !== savedPrint

  const mappingsToSave: Record<string, FieldMapping> = { ...sets.Detail, ...sets.Summary }

  return {
    loading,
    hasSettlementLayout,
    enabled,
    setEnabled,
    postType,
    setPostType,
    template,
    setTemplate,
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
    mappingsToSave,
    dirty,
    reset: () => void load(bankCode, savedMappings),
  }
}

/** Unmapped starting rows for a set of printed codes — nothing here has a dept/acc yet,
 *  only a name to map. */
function blankRows(codes: string[]): Record<string, FieldMapping> {
  const out: Record<string, FieldMapping> = {}
  for (const code of codes) out[code] = { dept: '', acc: '' }
  return out
}

/** `VS INTER UP PREM` → `VS`. Mirrors `group_key` in cc_jv.py, and only for seeding the
 *  Summary rows — the server regroups from the document itself when posting. */
function firstToken(code: string): string {
  const trimmed = code.trim()
  return trimmed.split(' ', 1)[0] || trimmed
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>()
  return items.filter(i => {
    if (seen.has(i)) return false
    seen.add(i)
    return true
  })
}
