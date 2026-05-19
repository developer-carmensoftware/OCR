import { useState, useEffect } from 'react'
import { fetchAccountCodes, fetchDepartments, fetchGLPrefixes } from '../../lib/api/carmen'

export interface MasterAccount {
  code: string
  name: string
  name2?: string
  nature?: string
  type?: string
}

export interface MasterDepartment {
  code: string
  name: string
  name2?: string
}

export interface MasterGLPrefix {
  code: string
  name: string
}

export interface MappingDataHook {
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  masterGLPrefixes: MasterGLPrefix[]
  loadingOpts: boolean
  loadInitialData: () => Promise<void>
}

export function useMappingData(): MappingDataHook {
  const [masterAccounts, setMasterAccounts] = useState<MasterAccount[]>([])
  const [masterDepartments, setMasterDepartments] = useState<MasterDepartment[]>([])
  const [masterGLPrefixes, setMasterGLPrefixes] = useState<MasterGLPrefix[]>([])
  const [loadingOpts, setLoadingOpts] = useState(true)

  const loadInitialData = async () => {
    setLoadingOpts(true)
    try {
      const [accResult, deptResult] = await Promise.all([fetchAccountCodes(), fetchDepartments()])

      const mappedAcc = accResult
        .filter(a => a.AccCode && a.AccCode !== 'AccCode')
        .map(a => ({
          code: a.AccCode as string,
          name: a.Description as string,
          name2: a.Description2 as string | undefined,
          nature: a.Nature as string | undefined,
          type: a.Type as string | undefined,
        }))

      const mappedDept = deptResult
        .filter(d => d.DeptCode && d.DeptCode !== 'CodeDep')
        .map(d => ({
          code: d.DeptCode as string,
          name: d.Description as string,
          name2: d.Description2 as string | undefined,
        }))

      setMasterAccounts(mappedAcc)
      setMasterDepartments(mappedDept)
    } catch (err) {
      console.error('Failed to load carmen dictionary:', err)
    } finally {
      setLoadingOpts(false)
    }

    try {
      const prefixResult = await fetchGLPrefixes()
      const mappedPrefixes = prefixResult
        .filter(p => p.PrefixName)
        .map(p => ({ code: p.PrefixName as string, name: p.Description as string }))
      setMasterGLPrefixes(mappedPrefixes)
    } catch (err) {
      console.warn('GL prefix load failed (non-critical):', err)
    }
  }

  useEffect(() => {
    void loadInitialData()
  }, [])

  return { masterAccounts, masterDepartments, masterGLPrefixes, loadingOpts, loadInitialData }
}
