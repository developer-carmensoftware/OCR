import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../api/emailReview', () => ({ inputTaxOwed: vi.fn() }))
vi.mock('@/shared/lib/toast', () => ({ showToast: vi.fn() }))

import { inputTaxOwed } from '../api/emailReview'
import { saveDraft, loadDraft } from '@/shared/lib/draft'
import { draftWorthOffering, useOcrWizard } from './useOcrWizard'

const owed = vi.mocked(inputTaxOwed)

describe('draftWorthOffering', () => {
  beforeEach(() => {
    owed.mockReset()
  })

  it('offers a draft that never posted, without asking the server', async () => {
    expect(await draftWorthOffering(false, 'c1')).toBe(true)
    expect(owed).not.toHaveBeenCalled()
  })

  it('offers a posted draft while its input tax is still owed', async () => {
    owed.mockResolvedValue(true)
    expect(await draftWorthOffering(true, 'c1')).toBe(true)
    expect(owed).toHaveBeenCalledWith('c1')
  })

  it('drops a posted draft once nothing is owed: filed from the queue, or the card deleted', async () => {
    owed.mockResolvedValue(false)
    expect(await draftWorthOffering(true, 'c1')).toBe(false)
  })

  it('still offers it when the check fails, so a blip never loses the work', async () => {
    owed.mockRejectedValue(new Error('offline'))
    expect(await draftWorthOffering(true, 'c1')).toBe(true)
  })

  it('offers a posted draft with no card id, which nothing can be asked about', async () => {
    expect(await draftWorthOffering(true, null)).toBe(true)
    expect(owed).not.toHaveBeenCalled()
  })
})

// The restore check is a round trip (up to a minute while Render wakes). Its answer must not
// land on work the user started meanwhile.
describe('useOcrWizard restore check', () => {
  const posted = (docNo: string) => ({
    step: 4,
    carmenJvId: 'JV-1' as string | null,
    cardId: 'c1',
    bank: 'SCB',
    headerData: { DocNo: docNo },
    details: [],
    warnings: [],
    originalHeader: {},
    originalDetails: [],
    jvRows: [],
  })

  function lateCheck() {
    let answer!: (owedNow: boolean) => void
    owed.mockReturnValue(new Promise<boolean>(r => (answer = r)))
    return (owedNow: boolean) => act(async () => answer(owedNow))
  }

  beforeEach(() => {
    owed.mockReset()
    localStorage.clear()
  })

  it('offers the draft when the answer comes back and nothing else happened', async () => {
    const reply = lateCheck()
    saveDraft('cc', posted('D-1'))
    const { result } = renderHook(() => useOcrWizard())
    await reply(true)
    expect(result.current.modal.show).toBe(true)
  })

  it('opens nothing over a fresh start made while the check was out', async () => {
    const reply = lateCheck()
    saveDraft('cc', posted('D-1'))
    const { result } = renderHook(() => useOcrWizard())
    act(() => result.current.resetAll())
    await reply(true)
    expect(result.current.modal.show).toBe(false)
  })

  it("never clears the new work's draft with a late 'not owed'", async () => {
    const reply = lateCheck()
    saveDraft('cc', posted('D-1'))
    const { result } = renderHook(() => useOcrWizard())
    act(() => result.current.resetAll())
    saveDraft('cc', { ...posted('D-2'), step: 2, carmenJvId: null })
    await reply(false)
    expect(loadDraft<{ headerData: { DocNo: string } }>('cc')?.data.headerData.DocNo).toBe('D-2')
  })
})
