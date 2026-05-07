import { useState, useMemo } from 'react'
import { apiFetch } from '../../lib/api/client'
import { showToast } from '../../lib/toast'

/**
 * Manages vendor list loading, search filtering,
 * and auto-matching vendor by Tax ID from extracted header data.
 */
export function useAPVendor({ t, headerData }) {
  const [vendors, setVendors] = useState([])
  const [vendorDbByTax, setVendorDbByTax] = useState({})
  const [systemVendor, setSystemVendor] = useState({ code: '', name: '' })
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorDrop, setShowVendorDrop] = useState(false)
  const [vendorRefreshing, setVendorRefreshing] = useState(false)

  const loadVendors = async (setRefreshing = false) => {
    if (setRefreshing) setVendorRefreshing(true)
    try {
      const r = await apiFetch('/api/v1/ocr/carmen/vendors')
      const data = await r.json()
      const list = (data.Data || []).map(v => ({
        code: v.VnCode || '',
        name: v.VnName || '',
        taxId: String(v.VnTaxNo || '').replace(/\D/g, ''),
        active: v.Active,
        catCode: v.VnCateCode,
        catDesc: v.VnCateDesc,
        vat1DrAccCode: v.VnVat1DrAccCode,
        vat1DrAccDesc: v.VnVat1DrAccDesc,
        vat1DrDeptCode: v.VnVat1DrDeptCode,
        vat1DrDeptDesc: v.VnVat1DrDeptDesc,
        vatCrAccCode: v.VnVatCrAccCode,
        vatCrAccDesc: v.VnVatCrAccDesc,
        crDeptCode: v.VnCrDeptCode,
        crDeptDesc: v.VnCrDeptDesc,
        taxProfileCode1: v.TaxProfileCode1,
        taxProfileDesc1: v.TaxProfileDesc1,
        branchNo: v.BranchNo,
        term: v.VnTerm ?? 0,
      }))
      setVendors(list)
      const db = {}
      list.forEach(v => { if (v.taxId) db[v.taxId] = v })
      setVendorDbByTax(db)
      if (setRefreshing) showToast('Vendor list updated', 'success')
    } catch {
      if (setRefreshing) showToast('Failed to load vendor list', 'error')
    } finally {
      if (setRefreshing) setVendorRefreshing(false)
    }
  }

  // Auto-match vendor by Tax ID when header changes
  const autoMatchVendor = (showDrop) => {
    if (showDrop) return
    const raw = String(headerData?.vendorTaxId || '').replace(/\D/g, '')
    const found = vendorDbByTax[raw]
    if (found && found.active !== false) {
      setSystemVendor(found)
      setVendorSearch(`${found.code} — ${found.name} | TaxID : ${found.taxId || '—'} | Branch No. : ${String(found.branchNo ?? '—').padStart(5, '0')}`)
    } else if (raw.length >= 10) {
      setSystemVendor({ code: '', name: t?.vendorNotFound || 'Not found in system' })
      setVendorSearch('')
    } else {
      setSystemVendor({ code: '', name: '' })
      setVendorSearch('')
    }
  }

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.toLowerCase()
    return vendors.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.code.toLowerCase().includes(q) ||
      v.taxId.includes(vendorSearch) ||
      String(v.branchNo || '').includes(vendorSearch)
    )
  }, [vendors, vendorSearch])

  const resetVendor = () => {
    setSystemVendor({ code: '', name: '' })
    setVendorSearch('')
  }

  return {
    vendors, vendorDbByTax,
    systemVendor, setSystemVendor,
    vendorSearch, setVendorSearch,
    showVendorDrop, setShowVendorDrop,
    vendorRefreshing,
    filteredVendors,
    loadVendors,
    refreshVendors: () => loadVendors(true),
    autoMatchVendor,
    resetVendor,
  }
}
