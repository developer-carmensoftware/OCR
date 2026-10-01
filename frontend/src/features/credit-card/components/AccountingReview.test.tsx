import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { LanguageProvider } from '@/i18n/LanguageContext'
import AccountingReview from './AccountingReview'

vi.mock('@/shared/api/carmen', () => ({ fetchAccountCodes: vi.fn(async () => []) }))

// Which bank each render asked the GL rules for.
const configBanks: Array<string | undefined> = []
vi.mock('@/features/credit-card/hooks', () => ({
  useAccountingConfig: (bank?: string) => {
    configBanks.push(bank)
    return { config: null, loading: false, refresh: () => {} }
  },
}))

describe('AccountingReview', () => {
  // The JV this step builds is the one the wizard posts. Unscoped, the server answers with
  // whichever bank the mapping page saved last, not the bank of the statement on screen.
  it("reads the scanned bank's own GL rules", async () => {
    render(
      <LanguageProvider>
        <AccountingReview
          details={[]}
          bank="KBANK"
          onBack={() => {}}
          onSubmit={() => {}}
          onGoMapping={() => {}}
        />
      </LanguageProvider>
    )
    await waitFor(() => expect(configBanks).toContain('KBANK'))
    expect(configBanks).not.toContain(undefined)
  })
})
