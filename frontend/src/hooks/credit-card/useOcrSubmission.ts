import { useState } from 'react'
import { submitToLocal } from '../../lib/api/submit'
import { submitToCarmen } from '../../lib/api/carmen'
import { logCorrections, diffCorrections } from '../../lib/api/feedback'
import { getAccountingConfig } from '../../lib/api/config'
import { getCarmenUrl } from '../../lib/url'
import { normalizeYearToCE } from '../../lib/date'
import { showToast } from '../../lib/toast'
import type { ModalConfig } from '../useModal'

export interface JvRow {
  dept: string
  acc: string
  desc: string
  debit: number
  credit: number
}

interface OcrSubmissionProps {
  showModal: (config: Omit<ModalConfig, 'show'>) => void
  closeModal: () => void
  setStep: (step: number) => void
  headerData: Record<string, string>
  details: Array<Record<string, string | number>>
  bank: string
  cardId: string | null
  originalHeader: Record<string, string>
  originalDetails: Array<Record<string, unknown>>
  setJvRows: (rows: JvRow[]) => void
  setCarmenJvId: (id: string | null) => void
}

export interface OcrSubmissionHook {
  submitting: boolean
  handleSubmitFinal: (rows: JvRow[]) => Promise<void>
}

export function useOcrSubmission({
  showModal, closeModal, setStep,
  headerData, details, bank, cardId,
  originalHeader, originalDetails,
  setJvRows, setCarmenJvId,
}: OcrSubmissionProps): OcrSubmissionHook {
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmitFinal(rows: JvRow[]) {
    setSubmitting(true)
    setJvRows(rows)
    const docNo = headerData.DocNo

    const payload = {
      BankType: bank,
      OriginalFilename: undefined,
      Header: {
        DateProcessed: headerData.DateProcessed || '',
        BankName: headerData.BankName || '',
        DocName: headerData.DocName || '',
        CompanyName: headerData.CompanyName || '',
        DocDate: headerData.DocDate || '',
        DocNo: headerData.DocNo || '',
        MerchantName: headerData.MerchantName || '',
        MerchantId: headerData.MerchantId || '',
        BankCompanyname: headerData.BankCompanyname || '',
        BranchNo: headerData.BranchNo || '',
      },
      Details: details.map(row => ({
        Transaction: String(row.Transaction || row.transaction || ''),
        PayAmt: parseFloat(String(row.PayAmt || row.pay_amt || 0).replace(/,/g, '')) || 0,
        CommisAmt: parseFloat(String(row.CommisAmt || row.commis_amt || 0).replace(/,/g, '')) || 0,
        TaxAmt: parseFloat(String(row.TaxAmt || row.tax_amt || 0).replace(/,/g, '')) || 0,
        Total: parseFloat(String(row.Total || row.total || 0).replace(/,/g, '')) || 0,
        WHTAmount: parseFloat(String(row.WHTAmount || row.wht_amount || 0).replace(/,/g, '')) || 0,
      })),
    }

    try {
      showToast('Submitting data...', 'info')
      await submitToLocal(payload as unknown as Parameters<typeof submitToLocal>[0])

      const corrections = diffCorrections(
        headerData,
        originalHeader,
        details as Array<Record<string, unknown>>,
        originalDetails
      )
      if (corrections.length > 0) {
        logCorrections(cardId || '', bank, corrections).catch(err =>
          console.error('[feedback] Error logging corrections:', err)
        )
      }

      let carmenError: string | null = null
      let jvId: string | null = null
      let alreadyPosted = false
      try {
        const carmenConfig = await getAccountingConfig().catch(() => {
          try {
            return JSON.parse(localStorage.getItem('accountingConfig') || '{}') as Record<string, string>
          } catch {
            return {} as Record<string, string>
          }
        })
        const carmenPayload = {
          JvhSeq: -1,
          JvhDate: (() => {
            if (headerData.DocDate) {
              const [d, m, y] = headerData.DocDate.split('/')
              const normalizedY = normalizeYearToCE(y)
              const parsed = new Date(`${normalizedY}-${m}-${d}`)
              if (!isNaN(parsed.getTime())) return parsed.toISOString()
            }
            return new Date().toISOString()
          })(),
          Prefix: (carmenConfig as Record<string, string>).file_prefix || (carmenConfig as Record<string, string>).filePrefix || '',
          JvhNo: 'Auto',
          JvhSource: (carmenConfig as Record<string, string>).file_source || (carmenConfig as Record<string, string>).fileSource || '',
          Status: 'Draft',
          Description: (carmenConfig as Record<string, string>).description
            ? `${(carmenConfig as Record<string, string>).description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
            : '',
          Detail: rows.map(r => ({
            JvhSeq: -1, JvdSeq: -1, DeptCode: r.dept, AccCode: r.acc,
            Description: r.desc, CurCode: 'THB', CurRate: 1,
            CrAmount: r.credit, CrBase: r.credit, DrAmount: r.debit, DrBase: r.debit,
            DimList: {},
          })),
          DimHList: { Dim: [] },
          UserModified: '',
        }
        const carmenRes = await submitToCarmen(carmenPayload) as Record<string, unknown>
        if (carmenRes?.Code !== 0) {
          alreadyPosted = true
          carmenError = (carmenRes?.UserMessage as string) || `Carmen error (Code: ${carmenRes?.Code})`
          showToast(`Carmen GL JV: ${carmenError}`, 'warning')
        } else {
          if (carmenRes?.InternalMessage) {
            jvId = carmenRes.InternalMessage as string
            setCarmenJvId(jvId)
          }
          showToast('Successfully sent data to Carmen GL JV', 'success')
        }
      } catch (err) {
        carmenError = (err as Error).message
        showToast(`Carmen GL JV: ${carmenError}`, 'error')
      }

      if (alreadyPosted) {
        showModal({
          title: 'Warning: Data Already Posted',
          message: `Document number ${docNo} saved to database.\n\nCarmen: "${carmenError}"`,
          type: 'warning',
          confirmText: 'Back to Step 1',
          onConfirm: () => { closeModal(); setStep(1) },
        })
      } else {
        showModal({
          title: carmenError ? 'Saved Successfully (Carmen issue)' : 'JV Saved Successfully!',
          message: carmenError
            ? `Document number ${docNo} has been saved to the database.\n\nHowever, sending to Carmen GL JV failed:\n${carmenError}`
            : `Document number ${docNo} has been successfully saved and sent to Carmen GL JV.`,
          type: carmenError ? 'warning' : 'success',
          confirmText: 'Proceed to Input Tax Reconciliation',
          cancelText: jvId ? 'View JV' : undefined,
          cancelStyle: jvId ? { background: 'var(--teal)', color: 'white', border: '1px solid var(--teal)' } : undefined,
          onConfirm: () => { closeModal(); setStep(4) },
          onCancel: jvId ? () => window.open(getCarmenUrl(`/glJv/${jvId}/show`), '_blank') : undefined,
        })
      }
    } catch (err) {
      const e = err as { code?: string; message: string }
      if (e.code === 'DUPLICATE_DOC_NO') {
        showModal({
          title: 'Duplicate Document Found',
          message: `Document number ${docNo} is already saved in the system.\nCannot import duplicate document.`,
          type: 'error',
          confirmText: 'OK',
          onConfirm: closeModal,
        })
      } else {
        showModal({
          title: 'Error saving data',
          message: e.message,
          type: 'error',
          confirmText: 'Close',
          onConfirm: closeModal,
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, handleSubmitFinal }
}
