import { useState } from 'react'
import { fetchAccountCodes, fetchDepartments, fetchGLPrefixes } from '../../lib/api/carmen'

/**
 * Manages loading of master data from Carmen API:
 * account codes, departments, and GL prefixes.
 */
export function useMappingData() {
  const [masterAccounts, setMasterAccounts] = useState([])
  const [masterDepartments, setMasterDepartments] = useState([])
  const [masterGLPrefixes, setMasterGLPrefixes] = useState([])
  const [loadingOpts, setLoadingOpts] = useState(true)

  const loadInitialData = async () => {
    setLoadingOpts(true)
    try {
      const [accResult, deptResult] = await Promise.all([fetchAccountCodes(), fetchDepartments()])

      const mappedAcc = accResult
        .filter(a => a.AccCode && a.AccCode !== 'AccCode')
        .map(a => ({
          code: a.AccCode,
          name: a.Description,
          name2: a.Description2,
          nature: a.Nature,
          type: a.Type,
        }))

      const mappedDept = deptResult
        .filter(d => d.DeptCode && d.DeptCode !== 'CodeDep')
        .map(d => ({ code: d.DeptCode, name: d.Description, name2: d.Description2 }))

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
        .map(p => ({ code: p.PrefixName, name: p.Description }))
      setMasterGLPrefixes(mappedPrefixes)
    } catch (err) {
      console.warn('GL prefix load failed (non-critical):', err)
    }
  }

  return {
    masterAccounts,
    masterDepartments,
    masterGLPrefixes,
    loadingOpts,
    loadInitialData,
  }
}
