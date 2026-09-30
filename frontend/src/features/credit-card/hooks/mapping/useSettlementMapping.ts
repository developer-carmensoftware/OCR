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
} from '@/features/credit-card/api/arReconcile'
import { suggestPaymentTypes } from '@/features/credit-card/api/mapping'
import { useT } from '@/i18n/LanguageContext'
import { isAccountAllowed, mergeSuggestion } from '@/shared/lib/deptAccounts'
import type { AddError } from '@/features/credit-card/components/payment-mapping/types'
import type { Suggestion } from './useMappingSuggestions'
import type { MasterAccount, MasterDepartment } from './useMappingData'
import type { FieldMapping } from '@/shared/types/api'

/**
 * The merged mapping page's Settlement card — decision #3 folded this feature's own
 * credit-side mapping table into `bu_accounting_mapping_entries`, so this hook no
 * longer owns a save of its own or a fetch of the accounting config: `savedMappings`
 * (the page's already-loaded, full merged dict — commission/tax/net, every
 * fee-invoice payment type, and this bank's settlement rows, all in one shape) is
 * injected, and `mappingsToSave` is what the page folds back into its own dict right
 * before the one `PUT /config/accounting` call. Only the post type and the two
 * payment-type sets are this hook's own. `enabled` is read-only (2026-09-29): whether
 * the bank reconciles is its email rule, switched in Carmen's settings, not here.
 *
 * **No `template` state any more (Ticket D, 2026-09-22)** — the JV description is the
 * same field the fee-invoice path always used (`bank_descriptions[bankCode]`), owned by
 * `TopLevelConfigSection`/`useBankConfig`, not this hook. `description` is injected the
 * same way `savedMappings` is, except it is *live*, not a load-once snapshot: a
 * settlement JV's wording has no save button of its own to wait for, so the preview
 * (and, once saved, the real post) must track every keystroke the way
 * `mappingsToSave`'s own dirty-tracking already does for the payment-type rows.
 *
 * **Both post-type sets are held at once**, same reasoning `useARReconcile` always
 * had: Detail and Summary are different vocabularies over the same document, each
 * with its own accounts, and losing Summary's rows because the toggle sat on Detail
 * when Save was pressed would be a real loss, not a display quirk.
 */

const SOURCE_BY_POST_TYPE: Record<PostType, string> = {
  Detail: 'settlement_detail',
  Summary: 'settlement_summary',
}

/** A saved entry this hook owns (either post type's) rather than the fee-invoice list. */
export const isSettlementSource = (source: string | null | undefined): boolean =>
  Boolean(source && source.startsWith('settlement_'))

export interface SettlementRow {
  code: string
  mapping: FieldMapping
}

/** Everything a save would send from this card, flattened — the basis for `dirty`.
 *  Spelled out rather than `JSON.stringify` over the state, for the same reason
 *  `useARReconcile`'s original `fingerprint` was: a row the server sent and a row
 *  `addCustomType` built can differ only in key order for the same values, and a
 *  stringify would call that an edit. No `description` any more — it lives on the
 *  page's own config, whose own save this card no longer gates. */
function fingerprint(
  postType: PostType,
  sets: Record<PostType, Record<string, FieldMapping>>
): string {
  return JSON.stringify([
    postType,
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
  /** Carmen has this bank's settlement rule switched on — shown, not set, here. */
  enabled: boolean
  postType: PostType
  setPostType: (v: PostType) => void
  rows: SettlementRow[]
  mappedCount: (pt: PostType) => number
  rowCount: (pt: PostType) => number
  setRowMapping: (code: string, field: 'dept' | 'acc', value: string) => void
  /** Bulk apply — one write for many rows of the post type in use. */
  applyToMany: (codes: string[], patch: { dept?: string; acc?: string }) => void
  /** Refused when blank or when the code is already in this set or in `taken` (another
   *  set's codes, so one key is never edited from two places). */
  addCustomType: (code: string, taken?: Set<string>) => AddError
  removeType: (code: string) => void
  suggestions: Record<string, Suggestion | null>
  suggestLoading: boolean
  runSuggest: () => Promise<void>
  acceptSuggestion: (code: string) => void
  acceptAllSuggestions: () => void
  rejectSuggestion: (code: string) => void
  /** The payment-type dialog edits a draft: `snapshot` when it opens, `restore` on Cancel,
   *  `dropSnapshot` on Done. Both post types and the open suggestions come back. */
  snapshot: () => void
  restore: () => void
  dropSnapshot: () => void
  preview: ARPreview | null
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
  masterDepartments: MasterDepartment[],
  /** The page's *live*, resolved fee-invoice description for this bank
   *  (`descriptionForBank(description, bankDescriptions, bankCode)`) — what a real post
   *  would use, tracked keystroke-by-keystroke so the preview stays accurate while the
   *  BU is still typing (Ticket D, 2026-09-22). */
  description: string,
  /** Which bank `savedMappings` belongs to (`useBankConfig.mappingsBankCode`). Mappings
   *  are per bank since 20260924000000, and the page re-fetches them *after* the bank
   *  changes — so until this matches `bankCode`, `savedMappings` is still the previous
   *  bank's. Omitted = trust `savedMappings` as given (the pre-scoping behaviour). */
  mappingsBankCode?: string | null
): SettlementMappingHook {
  const { t } = useT()
  const tRef = useRef(t)
  tRef.current = t

  const [loading, setLoading] = useState(true)
  const [hasSettlementLayout, setHasSettlementLayout] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [postType, setPostType] = useState<PostType>('Detail')
  const [sets, setSets] = useState<Record<PostType, Record<string, FieldMapping>>>({
    Detail: {},
    Summary: {},
  })
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | null>>({})
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [preview, setPreview] = useState<ARPreview | null>(null)
  const [savedPrint, setSavedPrint] = useState<string | null>(null)

  const previewSeq = useRef(0)
  const draftRef = useRef<{
    sets: Record<PostType, Record<string, FieldMapping>>
    suggestions: Record<string, Suggestion | null>
  } | null>(null)

  const load = useCallback(async (code: string, mappings: Record<string, FieldMapping>) => {
    setLoading(true)
    setSuggestions({})
    try {
      const s = await getARSettings(code)
      setHasSettlementLayout(s.has_settlement_layout)
      setEnabled(s.enabled)
      setPostType(s.post_type)

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
          Object.keys(detail).length > 0
            ? detail
            : blankRows(
                sample.map(i => i.payment_type_code),
                SOURCE_BY_POST_TYPE.Detail,
                mappings
              ),
        Summary:
          Object.keys(summary).length > 0
            ? summary
            : blankRows(
                dedupe(sample.map(i => firstToken(i.payment_type_code))),
                SOURCE_BY_POST_TYPE.Summary,
                mappings
              ),
      }
      setSets(next)
      setSavedPrint(fingerprint(s.post_type, next))
    } catch (err) {
      console.error('AR settings load failed:', err)
      toast.error(tRef.current('ar.toastLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mappingsBankCode !== undefined && mappingsBankCode !== bankCode) return
    void load(bankCode, savedMappings)
    // `savedMappings` intentionally excluded: it is the page's load-once snapshot, and a
    // later edit elsewhere on the page (commission/tax/net, a fee-invoice payment type)
    // must not re-seed this card's rows out from under the user. `mappingsBankCode` is
    // in: it changes only when a bank's mappings land, never on an edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, mappingsBankCode, load])

  const rows: SettlementRow[] = Object.entries(sets[postType] || {}).map(([code, mapping]) => ({
    code,
    mapping,
  }))

  /** One row's next value — the rule every edit path shares with the fee-invoice list: a
   *  department that forbids the current account (Carmen `DefaultAccount`) clears it. */
  const nextMapping = (cur: FieldMapping | undefined, patch: { dept?: string; acc?: string }) => {
    const next: FieldMapping = {
      dept: cur?.dept || '',
      acc: cur?.acc || '',
      ...patch,
      // Tagged even when the row was saved untagged (before seeds were tagged), or the
      // next load cannot find it and re-seeds it blank.
      source: cur?.source || SOURCE_BY_POST_TYPE[postType],
    }
    if (patch.dept !== undefined && patch.acc === undefined) {
      if (!isAccountAllowed(next.dept, next.acc, masterDepartments)) next.acc = ''
    }
    return next
  }

  const applyToMany = (codes: string[], patch: { dept?: string; acc?: string }) => {
    setSets(prev => {
      const set = { ...prev[postType] }
      for (const code of codes) set[code] = nextMapping(set[code], patch)
      return { ...prev, [postType]: set }
    })
    // A hand edit answers the suggestion; leaving it open would offer to undo the edit.
    setSuggestions(prev => {
      const next = { ...prev }
      for (const code of codes) next[code] = null
      return next
    })
  }

  const setRowMapping = (code: string, field: 'dept' | 'acc', value: string) =>
    applyToMany([code], { [field]: value })

  const addCustomType = (raw: string, taken?: Set<string>): AddError => {
    const code = raw.trim().toUpperCase()
    if (!code) return 'blank'
    if (sets[postType]?.[code] || taken?.has(code)) return 'duplicate'
    setSets(prev => ({
      ...prev,
      [postType]: {
        ...prev[postType],
        [code]: { dept: '', acc: '', source: SOURCE_BY_POST_TYPE[postType] },
      },
    }))
    return null
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

  const acceptSuggestions = (codes: string[]) => {
    setSets(prev => {
      const set = { ...prev[postType] }
      for (const code of codes) {
        const sugg = suggestions[code]
        if (!sugg) continue
        const cur = set[code]
        set[code] = {
          ...nextMapping(cur, {}),
          ...mergeSuggestion(cur || {}, sugg, masterDepartments),
        }
      }
      return { ...prev, [postType]: set }
    })
    setSuggestions(prev => {
      const next = { ...prev }
      for (const code of codes) next[code] = null
      return next
    })
  }

  const acceptSuggestion = (code: string) => acceptSuggestions([code])
  const acceptAllSuggestions = () =>
    acceptSuggestions(Object.keys(sets[postType] || {}).filter(code => suggestions[code]))

  const snapshot = () => {
    draftRef.current = { sets: structuredClone(sets), suggestions: { ...suggestions } }
  }
  const restore = () => {
    if (draftRef.current) {
      setSets(draftRef.current.sets)
      setSuggestions(draftRef.current.suggestions)
    }
    draftRef.current = null
  }
  const dropSnapshot = () => {
    draftRef.current = null
  }

  const rejectSuggestion = (code: string) => setSuggestions(prev => ({ ...prev, [code]: null }))

  const refreshPreview = useCallback(() => {
    const seq = ++previewSeq.current
    previewARJv({
      bank_code: bankCode,
      post_type: postType,
      jv_description_template: description,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCode, postType, description, sets])

  useEffect(() => {
    if (loading || !hasSettlementLayout) return
    refreshPreview()
  }, [loading, hasSettlementLayout, refreshPreview])

  const rowCount = (pt: PostType) => Object.keys(sets[pt] || {}).length
  const mappedCount = (pt: PostType) =>
    Object.values(sets[pt] || {}).filter(m => m.dept && m.acc).length

  const dirty = savedPrint !== null && fingerprint(postType, sets) !== savedPrint

  const mappingsToSave: Record<string, FieldMapping> = { ...sets.Detail, ...sets.Summary }

  return {
    loading,
    hasSettlementLayout,
    enabled,
    postType,
    setPostType,
    rows,
    rowCount,
    mappedCount,
    setRowMapping,
    applyToMany,
    addCustomType,
    removeType,
    suggestions,
    suggestLoading,
    runSuggest,
    acceptSuggestion,
    acceptAllSuggestions,
    rejectSuggestion,
    snapshot,
    restore,
    dropSnapshot,
    preview,
    refreshPreview,
    mappingsToSave,
    dirty,
    reset: () => void load(bankCode, savedMappings),
  }
}

/** Unmapped starting rows for a set of printed codes — nothing here has a dept/acc yet,
 *  only a name to map. */
/** Tagged with their post type's `source`, like `addCustomType`'s rows: `load` reads the
 *  saved dict back by `source`, so a seeded row saved untagged came back as nothing — the
 *  card re-seeded it blank, and the next save wrote those blanks over the real mapping.
 *  A code this bank already maps (untagged, saved before this fix or as a fee-invoice
 *  payment type) keeps its dept/acc for the same reason. */
function blankRows(
  codes: string[],
  source: string,
  saved: Record<string, FieldMapping>
): Record<string, FieldMapping> {
  const out: Record<string, FieldMapping> = {}
  for (const code of codes) {
    out[code] = { dept: saved[code]?.dept || '', acc: saved[code]?.acc || '', source }
  }
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
