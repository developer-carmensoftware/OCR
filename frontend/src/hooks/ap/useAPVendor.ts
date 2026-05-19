import { useState, useMemo } from 'react'
import { apiFetch } from '../../lib/api/client'
import { showToast } from '../../lib/toast'

export interface Vendor {
  code: string
  name: string
  taxId?: string
  active?: boolean
  catCode?: string
  catDesc?: string
  vat1DrAccCode?: string
  vat1DrAccDesc?: string
  vat1DrDeptCode?: string
  vat1DrDeptDesc?: string
  vatCrAccCode?: string
  vatCrAccDesc?: string
  crDeptCode?: string
  crDeptDesc?: string
  taxProfileCode1?: string
  taxProfileDesc1?: string
  branchNo?: string | number
  term?: number
}

interface APVendorProps {
  t?: Record<string, string>
  headerData: { vendorTaxId?: string; vendorBranch?: string }
}

export function useAPVendor({ t, headerData }: APVendorProps) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorDbByTax, setVendorDbByTax] = useState<Record<string, Vendor>>({})
  const [systemVendor, setSystemVendor] = useState<Vendor>({ code: '', name: '' })
  const [vendorSearch, setVendorSearch] = useState('')
  const [showVendorDrop, setShowVendorDrop] = useState(false)
  const [vendorRefreshing, setVendorRefreshing] = useState(false)

  const loadVendors = async (setRefreshing = false) => {
    if (setRefreshing) setVendorRefreshing(true)
    try {
      const r = await apiFetch('/api/v1/ocr/carmen/vendors')
      const data = await r.json() as { Data?: Array<Record<string, unknown>> }
      const list: Vendor[] = (data.Data || []).map(v => ({
        code: (v.VnCode as string) || '',
        name: (v.VnName as string) || '',
        taxId: String(v.VnTaxNo || '').replace(/\D/g, ''),
        active: v.Active as boolean | undefined,
        catCode: v.VnCateCode as string | undefined,
        catDesc: v.VnCateDesc as string | undefined,
        vat1DrAccCode: v.VnVat1DrAccCode as string | undefined,
        vat1DrAccDesc: v.VnVat1DrAccDesc as string | undefined,
        vat1DrDeptCode: v.VnVat1DrDeptCode as string | undefined,
        vat1DrDeptDesc: v.VnVat1DrDeptDesc as string | undefined,
        vatCrAccCode: v.VnVatCrAccCode as string | undefined,
        vatCrAccDesc: v.VnVatCrAccDesc as string | undefined,
        crDeptCode: v.VnCrDeptCode as string | undefined,
        crDeptDesc: v.VnCrDeptDesc as string | undefined,
        taxProfileCode1: v.TaxProfileCode1 as string | undefined,
        taxProfileDesc1: v.TaxProfileDesc1 as string | undefined,
        branchNo: v.BranchNo as string | number | undefined,
        term: (v.VnTerm as number) ?? 0,
      }))
      setVendors(list)
      const db: Record<string, Vendor> = {}
      list.forEach(v => {
        if (!v.taxId) return
        const branch = String(v.branchNo ?? '').padStart(5, '0')
        db[`${v.taxId}-${branch}`] = v
        if (!db[v.taxId]) db[v.taxId] = v
      })
      setVendorDbByTax(db)
      if (setRefreshing) showToast('Vendor list updated', 'success')
    } catch {
      if (setRefreshing) showToast('Failed to load vendor list', 'error')
    } finally {
      if (setRefreshing) setVendorRefreshing(false)
    }
  }

  const autoMatchVendor = (showDrop: boolean) => {
    if (showDrop) return
    setSystemVendor(prev => {
      if (prev.code) return prev
      const raw = String(headerData?.vendorTaxId || '').replace(/\D/g, '')
      const branch = String(headerData?.vendorBranch || '').replace(/\D/g, '').padStart(5, '0')
      const found = vendorDbByTax[`${raw}-${branch}`] || vendorDbByTax[raw]
      if (found && found.active !== false) {
        setVendorSearch(
          `${found.code} — ${found.name} | TaxID : ${found.taxId || '—'} | Branch No. : ${String(found.branchNo ?? '—').padStart(5, '0')}`
        )
        return found
      } else if (raw.length >= 10) {
        setVendorSearch('')
        return { code: '', name: t?.vendorNotFound || 'Not found in system' }
      }
      setVendorSearch('')
      return { code: '', name: '' }
    })
  }

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.toLowerCase()
    return vendors.filter(
      v =>
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        (v.taxId || '').includes(vendorSearch) ||
        String(v.branchNo || '').includes(vendorSearch)
    )
  }, [vendors, vendorSearch])

  const resetVendor = () => {
    setSystemVendor({ code: '', name: '' })
    setVendorSearch('')
  }

  return {
    vendors, vendorDbByTax, systemVendor, setSystemVendor,
    vendorSearch, setVendorSearch, showVendorDrop, setShowVendorDrop,
    vendorRefreshing, filteredVendors,
    loadVendors, refreshVendors: () => loadVendors(true),
    autoMatchVendor, resetVendor,
  }
}
