import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/emailReview', () => ({ inputTaxOwed: vi.fn() }))

import { inputTaxOwed } from '../api/emailReview'
import { draftWorthOffering } from './useOcrWizard'

const owed = vi.mocked(inputTaxOwed)

describe('draftWorthOffering', () => {
  beforeEach(() => {
    owed.mockReset()
  })

  it('offers a draft that never posted, without asking the server', async () => {
    expect(await draftWorthOffering({ step: 3, carmenJvId: null, cardId: 'c1' })).toBe(true)
    expect(owed).not.toHaveBeenCalled()
  })

  it('offers a posted draft while its input tax is still owed', async () => {
    owed.mockResolvedValue(true)
    expect(await draftWorthOffering({ step: 4, carmenJvId: 'JV-1', cardId: 'c1' })).toBe(true)
    expect(owed).toHaveBeenCalledWith('c1')
  })

  it('drops a posted draft once nothing is owed: filed from the queue, or the card deleted', async () => {
    owed.mockResolvedValue(false)
    expect(await draftWorthOffering({ step: 3, carmenJvId: 'JV-1', cardId: 'c1' })).toBe(false)
  })

  it('still offers it when the check fails, so a blip never loses the work', async () => {
    owed.mockRejectedValue(new Error('offline'))
    expect(await draftWorthOffering({ step: 4, carmenJvId: 'JV-1', cardId: 'c1' })).toBe(true)
  })

  it('offers a posted draft with no card id, which nothing can be asked about', async () => {
    expect(await draftWorthOffering({ step: 4, carmenJvId: 'JV-1', cardId: null })).toBe(true)
    expect(owed).not.toHaveBeenCalled()
  })
})
