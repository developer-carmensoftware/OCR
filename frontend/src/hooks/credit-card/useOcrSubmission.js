import { useState } from 'react'
import { submitToLocal } from '../../lib/api/submit'
import { submitToCarmen } from '../../lib/api/carmen'
import { logCorrections, diffCorrections } from '../../lib/api/feedback'
import { getAccountingConfig } from '../../lib/api/config'
import { getCarmenUrl } from '../../lib/url'
import { normalizeYearToCE } from '../../lib/date'
import { showToast } from '../../lib/toast'

/**
 * Manages the final submission flow: saving to local DB and sending to Carmen GL JV.
 */
export function useOcrSubmission({ showModal, closeModal, setStep, headerData, details, bank, cardId, originalHeader, originalDetails, setJvRows, setCarmenJvId }) {
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmitFinal(rows) {
    setSubmitting(true)
    setJvRows(rows)
    const docNo = headerData.DocNo
    const payload = {
      BankType: bank,
      OriginalFilename: undefined, // set by caller via files[0]?.name
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
        Transaction: row.Transaction || row.transaction || '',
        PayAmt: parseFloat(String(row.PayAmt || row.pay_amt || 0).replace(/,/g, '')) || 0,
        CommisAmt: parseFloat(String(row.CommisAmt || row.commis_amt || 0).replace(/,/g, '')) || 0,
        TaxAmt: parseFloat(String(row.TaxAmt || row.tax_amt || 0).replace(/,/g, '')) || 0,
        Total: parseFloat(String(row.Total || row.total || 0).replace(/,/g, '')) || 0,
        WHTAmount: parseFloat(String(row.WHTAmount || row.wht_amount || 0).replace(/,/g, '')) || 0,
      })),
    }

    try {
      showToast('Submitting data...', 'info')
      await submitToLocal(payload)

      const corrections = diffCorrections(headerData, originalHeader, details, originalDetails)
      if (corrections.length > 0) {
        logCorrections(cardId, bank, corrections)
          .catch(err => console.error('[feedback] Error logging corrections:', err))
      }

      let carmenError = null
      let jvId = null
      let alreadyPosted = false
      try {
        const carmenConfig = await getAccountingConfig().catch(() => {
          try { return JSON.parse(localStorage.getItem('accountingConfig') || '{}') } catch { return {} }
        })
        const carmenPayload = {
          JvhSeq: -1,
          JvhDate: (() => {
            if (headerData.DocDate) {
              const [d, m, y] = headerData.DocDate.split('/')
              const normalizedY = normalizeYearToCE(y)
              const parsed = new Date(`${normalizedY}-${m}-${d}`)
              if (!isNaN(parsed)) return parsed.toISOString()
            }
            return new Date().toISOString()
          })(),
          Prefix: carmenConfig.file_prefix || carmenConfig.filePrefix || '',
          JvhNo: 'Auto',
          JvhSource: carmenConfig.file_source || carmenConfig.fileSource || '',
          Status: 'Draft',
          Description: carmenConfig.description
            ? `${carmenConfig.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
            : '',
          Detail: rows.map(r => ({
            JvhSeq: -1, JvdSeq: -1,
            DeptCode: r.dept, AccCode: r.acc, Description: r.desc,
            CurCode: 'THB', CurRate: 1,
            CrAmount: r.credit, CrBase: r.credit,
            DrAmount: r.debit, DrBase: r.debit,
            DimList: {},
          })),
          DimHList: { Dim: [] },
          UserModified: '',
        }
        const carmenRes = await submitToCarmen(carmenPayload)
        if (carmenRes?.Code !== 0) {
          alreadyPosted = true
          carmenError = carmenRes?.UserMessage || `Carmen error (Code: ${carmenRes?.Code})`
          showToast(`Carmen GL JV: ${carmenError}`, 'warning')
        } else {
          if (carmenRes?.InternalMessage) {
            jvId = carmenRes.InternalMessage
            setCarmenJvId(jvId)
          }
          showToast('Successfully sent data to Carmen GL JV', 'success')
        }
      } catch (err) {
        carmenError = err.message
        showToast(`Carmen GL JV: ${err.message}`, 'error')
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
      if (err.code === 'DUPLICATE_DOC_NO') {
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
          message: err.message,
          type: 'error', confirmText: 'Close', onConfirm: closeModal,
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  return { submitting, handleSubmitFinal }
}
