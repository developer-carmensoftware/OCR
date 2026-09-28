import { useEffect, useRef } from 'react'
import { showToast } from '@/shared/lib/toast'
import { saveDraft, loadDraft, clearDraft, draftPromptMessage } from '@/shared/lib/draft'
import type { ModalState } from '@/shared/types/modal'
import type { APLineItem, APDraftState, useAPExtraction } from './useAPExtraction'
import type { useAPVendor } from './useAPVendor'

/**
 * Snapshot written to localStorage — wizard position plus everything unrecoverable.
 * Changing these fields means bumping DRAFT_VERSION in shared/lib/draft.ts, same commit.
 */
interface ApDraft extends APDraftState {
  step: number
  systemVendor: { code: string; name: string }
  // The vendor input renders `vendorSearch`, not `systemVendor`, and autoMatchVendor
  // early-returns on `prev.code` — so without this a restored invoice shows a blank
  // Vendor field while submitting the right vendor. Both have to be restored together.
  vendorSearch: string
  // Without this, ungrouping a restored invoice silently loses the merged source rows.
  groupSources: Record<string, APLineItem[]>
}

// Long enough to collapse a burst of typing into one write, short enough that a drop
// never costs more than the last few characters. lineItems gets a fresh identity on every
// keystroke, so without this the whole invoice is re-serialized per character on the main
// thread — tens of KB at 50-100 rows.
// ponytail: ceiling — unmounting inside this window drops the last edit. Flushing on
// cleanup would fire on every dependency change and defeat the debounce.
const DRAFT_SAVE_DEBOUNCE_MS = 400

interface Args {
  step: number
  setStep: (step: number) => void
  setModal: (modal: ModalState) => void
  extraction: ReturnType<typeof useAPExtraction>
  vendor: ReturnType<typeof useAPVendor>
  groupSources: Record<string, APLineItem[]>
  setGroupSources: (sources: Record<string, APLineItem[]>) => void
  loadGLData: () => void
}

/** The AP wizard's unsent copy on disk: saved as it changes, offered back once on entry. */
export function useAPDraft({
  step,
  setStep,
  setModal,
  extraction,
  vendor,
  groupSources,
  setGroupSources,
  loadGLData,
}: Args) {
  // StrictMode double-mounts in dev; without this the restore prompt opens twice.
  const restorePromptedRef = useRef(false)

  // Keep an unsent copy on disk. Both session clocks (our JWT and Carmen's token) expire
  // without warning mid-wizard, and everything above is React state that dies with the
  // unmount — this is the only thing standing between a drop and a re-scan. AP is the
  // longer of the two workflows, so it is the one most likely to be caught by it.
  useEffect(() => {
    if (step <= 1) return
    // Step 5 is terminal — the invoice is in Carmen and there is nothing left to recover.
    // Without this the last write survives until "New Invoice" is clicked, so closing the
    // tab on the success screen means the next visit offers to restore finished work.
    // (Credit card is deliberately different: its step 4 is a second Carmen post that
    // still has to happen, so its draft lives until Finish → resetAll.)
    if (step >= 5) {
      clearDraft('ap')
      return
    }
    const id = window.setTimeout(() => {
      saveDraft<ApDraft>('ap', {
        step,
        headerData: extraction.headerData,
        lineItems: extraction.lineItems,
        fieldMappings: extraction.fieldMappings,
        apInvoiceId: extraction.apInvoiceId,
        warnings: extraction.warnings,
        isDuplicate: extraction.isDuplicate,
        systemVendor: vendor.systemVendor,
        vendorSearch: vendor.vendorSearch,
        groupSources,
      })
    }, DRAFT_SAVE_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [
    step,
    extraction.headerData,
    extraction.lineItems,
    extraction.fieldMappings,
    extraction.apInvoiceId,
    extraction.warnings,
    extraction.isDuplicate,
    vendor.systemVendor,
    vendor.vendorSearch,
    groupSources,
  ])

  // Offer the saved invoice back, once, on entry. Never automatic: a silent restore would
  // bury a fresh scan, and on a shared PC it would surface a colleague's invoice unasked.
  useEffect(() => {
    if (restorePromptedRef.current) return
    restorePromptedRef.current = true
    const draft = loadDraft<ApDraft>('ap')
    if (!draft) return
    setModal({
      show: true,
      title: 'Unfinished invoice found',
      message: draftPromptMessage(
        draft.data.headerData?.documentNumber || draft.data.headerData?.vendorName,
        draft.at
      ),
      type: 'info',
      confirmText: 'Restore',
      cancelText: 'Discard',
      onConfirm: () => {
        extraction.restoreDraft(draft.data)
        vendor.setSystemVendor(draft.data.systemVendor || { code: '', name: '' })
        // Must accompany setSystemVendor — this is the text the vendor input renders.
        vendor.setVendorSearch(draft.data.vendorSearch || '')
        setGroupSources(draft.data.groupSources || {})
        setStep(draft.data.step)
        // Step 4 normally gets its chart of accounts from the 3→4 transition
        // (goToAccount). Landing there directly has to fetch it itself.
        if (draft.data.step >= 4) loadGLData()
        setModal({ show: false })
        showToast('Restored your unfinished invoice', 'success')
      },
      onCancel: () => {
        clearDraft('ap')
        setModal({ show: false })
      },
    })
    // Mount-only: the prompt answers a question about the past, not about live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
