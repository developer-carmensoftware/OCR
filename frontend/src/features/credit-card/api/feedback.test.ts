import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logCorrections } from './feedback'
import { apiFetch } from '@/shared/api/client'

vi.mock('@/shared/api/client', () => ({ apiFetch: vi.fn() }))

const sent = () =>
  JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]!.body as string).corrections as Array<{
    field_name: string
  }>

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiFetch).mockResolvedValue(new Response('{"saved":1}', { status: 200 }))
})

describe('logCorrections', () => {
  // Both are header fields the wizard lets a reviewer edit. Sent as their PascalCase keys,
  // the server's FieldName enum 422'd the whole batch — every correction beside them too.
  it('sends Branch No and Bank Company Name under their server names', async () => {
    await logCorrections('DOC-1', 'KTC', [
      { fieldName: 'BranchNo', originalValue: '', correctedValue: '00002' },
      { fieldName: 'BankCompanyName', originalValue: 'a', correctedValue: 'b' },
      { fieldName: 'DocNo', originalValue: 'A', correctedValue: 'B' },
    ])

    expect(sent().map(c => c.field_name)).toEqual(['branch_no', 'bank_company_name', 'doc_no'])
  })

  it('leaves out a field the server does not know, so the rest still land', async () => {
    await logCorrections('DOC-1', 'KTC', [
      { fieldName: 'SomethingNew', originalValue: 'x', correctedValue: 'y' },
      { fieldName: 'DocNo', originalValue: 'A', correctedValue: 'B' },
    ])

    expect(sent().map(c => c.field_name)).toEqual(['doc_no'])
  })

  it('sends nothing when no correction is one the server knows', async () => {
    await logCorrections('DOC-1', 'KTC', [
      { fieldName: 'constructor', originalValue: 'x', correctedValue: 'y' },
    ])

    expect(apiFetch).not.toHaveBeenCalled()
  })
})
