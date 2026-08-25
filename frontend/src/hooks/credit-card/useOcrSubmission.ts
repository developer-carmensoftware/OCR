import { useRef, useState } from 'react'
import { submitToCarmen } from '../../lib/api/carmen'
import { logCorrections, diffCorrections } from '../../lib/api/feedback'
import { getAccountingConfig } from '../../lib/api/config'
import { getCarmenUrl } from '../../lib/url'
import { buildGljvPayload } from '../../lib/ccJv'
import { showToast } from '../../lib/toast'
import { appKey } from '../../lib/storage'
import type { ModalConfig } from '../useModal'

// JvRow and the JV body itself both live in lib/ccJv.ts, next to the row builder and
// the contract test that pins them to the Python twin. Re-exported so the wizard's
// existing importers keep one place to reach for it.
import type { JvRow } from '../../lib/ccJv'
export type { JvRow }

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
  // Ref, not the `submitting` state: state updates are async, so two clicks in the
  // same tick both read the old value and both post. submitToCarmen is not
  // idempotent — a double post means a duplicate JV in the ERP.
  const submittingRef = useRef(false)

  async function handleSubmitFinal(rows: JvRow[]) {
    if (submittingRef.current) return
    submittingRef.current = true
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
      // Distinct from carmenRejected (Carmen responded and declined): the submit
      // never got a confirmed response (network drop / early 5xx). We cannot claim
      // the JV was saved, so this must never show a "saved successfully" modal.
      let carmenFailed = false

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
        // The API returns snake_case and the localStorage fallback holds the camelCase
        // shape useMapping writes, so both are read here. Normalising at this boundary
        // is what lets buildGljvPayload take one clean shape — and lets the contract
        // test compare it against the server twin, which reads an ORM row.
        const carmenPayload = buildGljvPayload(rows, {
          docDate: headerData.DocDate,
          bankCode: bank,
          config: {
            filePrefix: cfg.file_prefix || cfg.filePrefix,
            fileSource: cfg.file_source || cfg.fileSource,
            description: cfg.description,
            bankDescriptions: ((carmenConfig as Record<string, unknown>).bank_descriptions ??
              (carmenConfig as Record<string, unknown>).bankDescriptions) as
              Record<string, string> | undefined,
          },
        })
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
        const e = err as { code?: string; message: string }
        // A definitive 409 duplicate is a server rejection, not a transport failure —
        // hand it to the outer catch's dedicated "duplicate document" modal.
        if (e.code === 'DUPLICATE_DOC_NO') throw err
        carmenFailed = true
        carmenError = e.message
        showToast(`Carmen Cloud JV: ${carmenError}`, 'error')
      }

      if (carmenFailed) {
        // Transport / early-server failure: the JV's fate is unknown. Do NOT claim it
        // was saved and do NOT advance — keep the user on Step 3 to verify and retry.
        showModal({
          title: 'Submission failed',
          message:
            `Could not confirm the JV for document ${docNo} reached Carmen Cloud.\n\n` +
            `${carmenError}\n\n` +
            'The document may not have been saved. Please check Carmen before retrying to avoid a duplicate.',
          type: 'error',
          confirmText: 'Back to review',
          onConfirm: closeModal,
        })
      } else if (carmenRejected) {
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
          title: 'JV Saved Successfully!',
          message: `Document number ${docNo} has been successfully saved and sent to Carmen Cloud JV.`,
          type: 'success',
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
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return { submitting, handleSubmitFinal }
}
