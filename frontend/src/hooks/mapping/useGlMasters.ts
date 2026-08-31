import { useEffect, useState } from 'react'
import { fetchAccountCodes, fetchDepartments } from '../../lib/api/carmen'
import { parseDefaultAccount } from '../../lib/deptAccounts'
import type { MasterAccount, MasterDepartment } from './useMappingData'

/**
 * Carmen's account and department lists, fetched once per page load.
 *
 * `useMappingData` is the mapping page's version: it also pulls GL prefixes and refetches
 * everything on every mount, which is right for a page someone opens on purpose and wrong
 * for a modal opened once per document. Approving is a rhythm — open, check, post, next —
 * and re-downloading several hundred account codes between every beat is the delay the
 * reviewer feels.
 *
 * The cache is module-level and deliberately never invalidated: Carmen's chart of accounts
 * does not change during a review session, and `AccountingReview` already caches accounts
 * this way for the same reason. A reload picks up any change.
 */
let cache: { accounts: MasterAccount[]; departments: MasterDepartment[] } | null = null
let inflight: Promise<void> | null = null

export interface GlMasters {
  accounts: MasterAccount[]
  departments: MasterDepartment[]
  loading: boolean
}

export function useGlMasters(): GlMasters {
  const [masters, setMasters] = useState(cache)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) return
    let alive = true
    // One request pair even when two components mount together — the JV editor and
    // anything else on the same screen share the promise rather than racing.
    inflight ??= Promise.all([fetchAccountCodes(), fetchDepartments()])
      .then(([acc, dept]) => {
        cache = {
          accounts: acc
            .filter(a => a.AccCode && a.AccCode !== 'AccCode')
            .map(a => ({
              code: a.AccCode as string,
              name: (a.Description as string) || '',
              name2: a.Description2 as string | undefined,
            })),
          departments: dept
            .filter(d => d.DeptCode && d.DeptCode !== 'CodeDep')
            .map(d => ({
              code: d.DeptCode as string,
              name: (d.Description as string) || '',
              name2: d.Description2 as string | undefined,
              allowedAccounts: parseDefaultAccount(d.DefaultAccount),
            })),
        }
      })
      .catch(() => {
        // An empty master list renders every picker as free text rather than blanking the
        // screen. The dept/account pair is re-checked server-side on save either way.
        cache = { accounts: [], departments: [] }
      })
      .finally(() => {
        inflight = null
      })

    void inflight.then(() => {
      if (!alive) return
      setMasters(cache)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  return { accounts: masters?.accounts ?? [], departments: masters?.departments ?? [], loading }
}
