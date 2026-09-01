import { useEffect, useState } from 'react'
import { fetchAccountCodes, fetchDepartments, fetchGLPrefixes } from '../../lib/api/carmen'
import { parseDefaultAccount } from '../../lib/deptAccounts'
import type { MasterAccount, MasterDepartment, MasterGLPrefix } from './useMappingData'

/**
 * Carmen's accounts, departments and GL prefixes, fetched once per page load.
 *
 * `useMappingData` is the mapping page's version of the same three lists, and it refetches
 * all of them on every mount — right for a page someone opens on purpose, wrong for a modal
 * opened once per document. Approving is a rhythm — open, check, post, next — and
 * re-downloading several hundred account codes between every beat is the delay the reviewer
 * feels.
 *
 * The cache is module-level and deliberately never invalidated: Carmen's chart of accounts
 * does not change during a review session, and `AccountingReview` already caches accounts
 * this way for the same reason. A reload picks up any change.
 */
let cache: {
  accounts: MasterAccount[]
  departments: MasterDepartment[]
  prefixes: MasterGLPrefix[]
} | null = null
let inflight: Promise<void> | null = null

export interface GlMasters {
  accounts: MasterAccount[]
  departments: MasterDepartment[]
  /** The journal books a JV can be filed under — Carmen's `glPrefix`. */
  prefixes: MasterGLPrefix[]
  loading: boolean
}

export function useGlMasters(): GlMasters {
  const [masters, setMasters] = useState(cache)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) return
    let alive = true
    // One request set even when several components mount together — the JV editor and
    // the JV header share the promise rather than racing for the same three lists.
    inflight ??= Promise.all([fetchAccountCodes(), fetchDepartments(), fetchGLPrefixes()])
      .then(([acc, dept, pre]) => {
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
          prefixes: pre
            .filter(x => x.PrefixName)
            .map(x => ({
              code: x.PrefixName as string,
              name: (x.Description as string) || '',
            })),
        }
      })
      .catch(() => {
        // An empty master list renders every picker as free text rather than blanking the
        // screen. The dept/account pair is re-checked server-side on save either way.
        cache = { accounts: [], departments: [], prefixes: [] }
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

  return {
    accounts: masters?.accounts ?? [],
    departments: masters?.departments ?? [],
    prefixes: masters?.prefixes ?? [],
    loading,
  }
}
