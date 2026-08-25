import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InputTaxReconciliation from './InputTaxReconciliation'
import { submitInputTax, fetchTaxProfiles } from '../../lib/api/carmen'
import { getAccountingConfig } from '../../lib/api/config'
import type { BankCode } from '../../types/api'

vi.mock('../../lib/api/carmen', () => ({
  submitInputTax: vi.fn(),
  fetchTaxProfiles: vi.fn(),
}))
vi.mock('../../lib/api/config', () => ({ getAccountingConfig: vi.fn() }))

// framer-motion's useReducedMotion (inside CustomModal) reads window.matchMedia.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }
})

beforeEach(() => {
  vi.mocked(fetchTaxProfiles).mockResolvedValue([{ code: 'VAT07', desc: 'VAT 7%', rate: 7 }])
  vi.mocked(submitInputTax).mockResolvedValue({ Code: 0 })
  // No saved config anywhere: the state left behind by clearAppStorage() on a session
  // drop, which is what put a blank TaxId on the wire.
  vi.mocked(getAccountingConfig).mockRejectedValue(new Error('empty'))
  localStorage.clear()
})

function setup(bank: BankCode | '' = 'KBANK') {
  const onFinish = vi.fn()
  render(
    <InputTaxReconciliation
      details={[{ CommisAmt: '500', TaxAmt: '35' }]}
      headerData={{ DocNo: '240826E00035168', DocDate: '24/08/2026' }}
      bank={bank}
      onBack={vi.fn()}
      onFinish={onFinish}
    />
  )
  return { onFinish, addButton: screen.getByRole('button', { name: /Add Input Tax/i }) }
}

async function confirmSubmit(addButton: HTMLElement) {
  await waitFor(() => expect(addButton).toBeEnabled())
  fireEvent.click(addButton)
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
}

describe('InputTaxReconciliation — vendor identity', () => {
  it("posts the issuing bank's registered identity with no saved config at all", async () => {
    const { addButton } = setup('KBANK')
    await confirmSubmit(addButton)

    await waitFor(() => expect(submitInputTax).toHaveBeenCalled())
    expect(vi.mocked(submitInputTax).mock.calls[0][0]).toMatchObject({
      VnName: 'Kasikornbank Public Company Limited',
      TaxId: '0107536000315',
      Address: '400/22 Phahonyothin Road, Samsen Nai, Phaya Thai, Bangkok 10400',
    })
  })

  it('blocks the post when no bank identity can be resolved', async () => {
    const { addButton } = setup('')
    await waitFor(() => expect(screen.getByText(/could not be resolved/i)).toBeInTheDocument())
    expect(addButton).toBeDisabled()
  })
})

describe('InputTaxReconciliation — Carmen verdict', () => {
  it('treats a non-zero Code as a failure, not a finished step', async () => {
    vi.mocked(submitInputTax).mockResolvedValue({ Code: -1, UserMessage: 'Tax ID is required' })
    const { onFinish, addButton } = setup('KBANK')
    await confirmSubmit(addButton)

    await waitFor(() => expect(screen.getByText('Tax ID is required')).toBeInTheDocument())
    expect(onFinish).not.toHaveBeenCalled()
  })
})
