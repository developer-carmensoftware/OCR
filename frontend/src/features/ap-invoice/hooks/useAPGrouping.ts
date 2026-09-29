import { useRef, useState } from 'react'
import { groupSelected } from '@/features/ap-invoice/lib/apGroup'
import type { APLineItem, useAPExtraction } from './useAPExtraction'

interface Args {
  extraction: ReturnType<typeof useAPExtraction>
  t: (key: 'ap.groupedItems') => string
}

/**
 * Group-by-description on the review table: which rows were merged into which, and the
 * two verbs. `groupSources` keeps the original rows behind each grouped one, so ungroup
 * is exact — and the AP draft persists it for the same reason.
 */
export function useAPGrouping({ extraction, t }: Args) {
  // groupSources maps a _groupId to the original source rows that were merged into that grouped row.
  // Source rows are always flat (never contain other _groupId rows) so ungroup is always one level.
  const [groupSources, setGroupSources] = useState<Record<string, APLineItem[]>>({})
  const groupIdCounter = useRef(0)

  // Derived: true when any row in the current list is a grouped row.
  const isGrouped = extraction.lineItems.some(it => it._groupId)

  // Derived: how many rows would be in the list after fully expanding all groups.
  const originalLineItemsCount = extraction.lineItems.reduce(
    (n, it) =>
      n + (it._groupId && groupSources[it._groupId] ? groupSources[it._groupId].length : 1),
    0
  )

  // Flatten the source rows behind each selected item. If an item is itself a grouped row we
  // substitute its original source rows (making nested-group→merge always produce flat sources).
  const flattenSources = (items: APLineItem[]): APLineItem[] =>
    items.flatMap(it =>
      it._groupId && groupSources[it._groupId] ? groupSources[it._groupId] : [it]
    )

  // Group by description: merge the user-selected rows into named grouped rows.
  // Items may span multiple tax profiles — each distinct (taxType, profile) becomes one row,
  // all sharing the user-supplied description. Leaves non-selected rows untouched.
  const groupByDescription = (indices: number[], description: string): boolean => {
    const items = extraction.lineItems
    // Drop duplicate / out-of-range indices: the modal can hand us stale indices captured against a
    // longer list (a previous group shrank it), and a bad index would surface undefined rows.
    const sorted = [...new Set(indices)]
      .filter(i => i >= 0 && i < items.length)
      .sort((a, b) => a - b)
    if (sorted.length < 2) return false
    const selected = sorted.map(i => items[i])
    const desc = description.trim() || items[sorted[0]]?.description || t('ap.groupedItems')
    const buckets = groupSelected(selected, desc)

    const newSources: Record<string, APLineItem[]> = {}
    const absorbedIds = new Set(
      selected.flatMap(it => (it._groupId ? [it._groupId] : [])) as string[]
    )
    const mergedRows: APLineItem[] = buckets.map(({ row, bucket }) => {
      const gid = `g_${++groupIdCounter.current}`
      newSources[gid] = flattenSources(bucket)
      return { ...row, _uid: crypto.randomUUID(), _groupId: gid }
    })

    setGroupSources(prev => {
      const next = { ...prev }
      absorbedIds.forEach(id => delete next[id])
      Object.assign(next, newSources)
      return next
    })

    const drop = new Set(sorted)
    const insertAt = sorted[0]
    const next: APLineItem[] = []
    items.forEach((it, i) => {
      if (i === insertAt) mergedRows.forEach(r => next.push(r))
      if (!drop.has(i)) next.push(it)
    })
    extraction.setLineItems(next)
    return true
  }

  const ungroupItems = () => {
    extraction.setLineItems(prev =>
      prev.flatMap(it =>
        it._groupId && groupSources[it._groupId] ? groupSources[it._groupId] : [it]
      )
    )
    setGroupSources({})
  }

  return {
    groupSources,
    setGroupSources,
    isGrouped,
    originalLineItemsCount,
    groupByDescription,
    ungroupItems,
  }
}
