import { useState } from 'react'
import { submitToCarmen } from '../../lib/api/carmen'
import { logCorrections, diffCorrections } from '../../lib/api/feedback'
import { getAccountingConfig } from '../../lib/api/config'
import { codeToSource } from '../../lib/bankTransforms'
import { getCarmenUrl } from '../../lib/url'
import { normalizeYearToCE } from '../../lib/date'
import { showToast } from '../../lib/toast'
import { appKey } from '../../lib/storage'
import { round2 } from '../../lib/format'
import type { ModalConfig } from '../useModal'

/**
 * Parse a "DD/MM/YYYY" or "DD/MM/BBBB" (Buddhist Era) date string into an
 * ISO-8601 timestamp. Falls back to the current timestamp when the input is
 * absent, malformed, or results in an invalid Date.
 */
function parseJvhDate(docDate: string | undefined): string {
  if (docDate) {
    const [d, m, y] = docDate.split('/')
    const normalizedY = normalizeYearToCE(y)
    const parsed = new Date(`${normalizedY}-${m}-${d}`)
    if (!isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return new Date().toISOString()
}

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
  showModal,
  closeModal,
  setStep,
  headerData,
  details,
  bank,
  cardId,
  originalHeader,
  originalDetails,
  setJvRows,
  setCarmenJvId,
}: OcrSubmissionProps): OcrSubmissionHook {
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmitFinal(rows: JvRow[]) {
    setSubmitting(true)
    setJvRows(rows)
    const docNo = headerData.DocNo

    try {
      showToast('Submitting data...', 'info')

      const corrections = diffCorrections(
        headerData,
        originalHeader,
        details as Array<Record<string, unknown>>,
        originalDetails
      )
      if (corrections.length > 0) {
        logCorrections(headerData.DocNo || '', bank, corrections).catch(err =>
          console.error('[feedback] Error logging corrections:', err)
        )
      }

      let carmenError: string | null = null
      let jvId: string | null = null
      let carmenRejected = false

      try {
        const carmenConfig = await getAccountingConfig().catch(() => {
          try {
            return JSON.parse(localStorage.getItem(appKey('accountingConfig')) || '{}') as Record<
              string,
              string
            >
          } catch {
            return {} as Record<string, string>
          }
        })
        const cfg = carmenConfig as Record<string, string>
        const carmenPayload = {
          JvhSeq: -1,
          JvhDate: parseJvhDate(headerData.DocDate),
          Prefix: cfg.file_prefix || cfg.filePrefix || '',
          JvhNo: 'Auto',
          // Source follows the scanned bank (single authority), not stale saved
          // config; fall back to stored config only when the bank is unknown.
          JvhSource: (bank && codeToSource(bank)) || cfg.file_source || cfg.fileSource || '',
          Status: 'Draft',
          Description: cfg.description
            ? `${cfg.description}${headerData.DocDate ? ` - ${headerData.DocDate}` : ''}`
            : '',
          // Drop display-only zero legs (e.g. gateway net=0.00 shown in Step 3 for a
          // standard layout) — never post empty GL lines to Carmen.
          Detail: rows
            .filter(r => r.debit || r.credit)
            .map(r => ({
              JvhSeq: -1,
              JvdSeq: -1,
              DeptCode: r.dept,
              AccCode: r.acc,
              Description: r.desc,
              CurCode: 'THB',
              CurRate: 1,
              CrAmount: round2(r.credit),
              CrBase: round2(r.credit),
              DrAmount: round2(r.debit),
              DrBase: round2(r.debit),
              DimList: {},
            })),
          DimHList: { Dim: [] },
          UserModified: '',
        }
        const metadata = {
          doc_no: headerData.DocNo || undefined,
          company_name: headerData.CompanyName || undefined,
          bank_code: bank || undefined,
          branch_no: headerData.BranchNo || undefined,
        }
        const carmenRes = (await submitToCarmen(carmenPayload, cardId, metadata)) as Record<
          string,
          unknown
        >
        if (carmenRes?.Code !== 0) {
          carmenRejected = true
          carmenError =
            (carmenRes?.UserMessage as string) || `Carmen error (Code: ${carmenRes?.Code})`
          showToast(`Carmen Cloud JV: ${carmenError}`, 'warning')
        } else {
          if (carmenRes?.InternalMessage) {
            jvId = carmenRes.InternalMessage as string
            setCarmenJvId(jvId)
          }
          showToast('Successfully sent data to Carmen Cloud JV', 'success')
        }
      } catch (err) {
        carmenError = (err as Error).message
        showToast(`Carmen Cloud JV: ${carmenError}`, 'error')
      }

      if (carmenRejected) {
        showModal({
          title: 'Warning: Data Already Posted',
          message: `Document number ${docNo} saved to database.\n\nCarmen: "${carmenError}"`,
          type: 'warning',
          confirmText: 'Back to Step 1',
          onConfirm: () => {
            closeModal()
            setStep(1)
          },
        })
      } else {
        showModal({
          title: carmenError ? 'Saved Successfully (Carmen issue)' : 'JV Saved Successfully!',
          message: carmenError
            ? `Document number ${docNo} has been saved to the database.\n\nHowever, sending to Carmen Cloud JV failed:\n${carmenError}`
            : `Document number ${docNo} has been successfully saved and sent to Carmen Cloud JV.`,
          type: carmenError ? 'warning' : 'success',
          confirmText: 'Proceed to Input Tax Reconciliation',
          cancelText: jvId ? 'View JV' : undefined,
          cancelStyle: jvId
            ? { background: 'var(--teal)', color: 'white', border: '1px solid var(--teal)' }
            : undefined,
          onConfirm: () => {
            closeModal()
            setStep(4)
          },
          onCancel: jvId
            ? () => window.open(getCarmenUrl(`/glJv/${jvId}/show`), '_blank')
            : undefined,
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
