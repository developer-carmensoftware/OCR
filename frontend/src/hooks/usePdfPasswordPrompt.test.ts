import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePdfPasswordPrompt, type PdfPasswordModalPayload } from './usePdfPasswordPrompt'
import { PDF_PASSWORD_REQUIRED } from '../lib/api/ocr'

function setup() {
  const openModal = vi.fn()
  const closeModal = vi.fn()
  const onCancel = vi.fn()
  const { result } = renderHook(() => usePdfPasswordPrompt({ openModal, closeModal, onCancel }))
  const lastPayload = (): PdfPasswordModalPayload => {
    const calls = openModal.mock.calls
    return calls[calls.length - 1][0]
  }
  return { result, openModal, closeModal, onCancel, lastPayload }
}

// A rejection shaped like the ApiError the backend returns for a wrong password.
const wrongPassword = () => Object.assign(new Error('wrong'), { code: PDF_PASSWORD_REQUIRED })

// onConfirm is typed () => void but `submit` is async — await its real promise.
const confirm = (p: PdfPasswordModalPayload) => p.onConfirm() as unknown as Promise<void>

describe('usePdfPasswordPrompt', () => {
  it('opens a fresh prompt: cleared field, no error, password input', () => {
    const { result, openModal, lastPayload } = setup()
    act(() => result.current.open({ verify: vi.fn(), onVerified: vi.fn() }))
    expect(openModal).toHaveBeenCalledTimes(1)
    const p = lastPayload()
    expect(p.errorNonce).toBe(0)
    expect(p.inputValue).toBe('')
    expect(p.busy).toBeFalsy()
    expect(p.inputType).toBe('password')
  })

  it('success: shows busy, then closeModal + onVerified with the result', async () => {
    const { result, openModal, closeModal, lastPayload } = setup()
    const verify = vi.fn().mockResolvedValue({ page_count: 1 })
    const onVerified = vi.fn()
    act(() => result.current.open({ verify, onVerified }))
    act(() => lastPayload().onInputChange('1234'))
    await act(async () => {
      await confirm(lastPayload())
    })
    expect(verify).toHaveBeenCalledWith('1234')
    expect(openModal.mock.calls.some(c => c[0].busy === true)).toBe(true)
    expect(closeModal).toHaveBeenCalledTimes(1)
    expect(onVerified).toHaveBeenCalledWith('1234', { page_count: 1 })
    expect(result.current.pdfPassword).toBe('1234')
  })

  it('wrong password: bumps errorNonce, keeps the typed value, never closes', async () => {
    const { result, closeModal, lastPayload } = setup()
    const verify = vi.fn().mockRejectedValue(wrongPassword())
    const onVerified = vi.fn()
    act(() => result.current.open({ verify, onVerified }))
    act(() => lastPayload().onInputChange('0000'))
    await act(async () => {
      await confirm(lastPayload())
    })
    const p = lastPayload()
    expect(p.errorNonce).toBeGreaterThan(0)
    expect(p.inputValue).toBe('0000') // retained so the user can fix it
    expect(p.busy).toBeFalsy()
    expect(onVerified).not.toHaveBeenCalled()
    expect(closeModal).not.toHaveBeenCalled()
  })

  it('each consecutive wrong attempt re-triggers the shake (errorNonce keeps rising)', async () => {
    const { result, lastPayload } = setup()
    const verify = vi.fn().mockRejectedValue(wrongPassword())
    act(() => result.current.open({ verify, onVerified: vi.fn() }))
    act(() => lastPayload().onInputChange('0000'))
    await act(async () => {
      await confirm(lastPayload())
    })
    const first = lastPayload().errorNonce
    await act(async () => {
      await confirm(lastPayload())
    })
    expect(lastPayload().errorNonce).toBeGreaterThan(first)
  })

  it('empty password re-prompts without calling verify', async () => {
    const { result, lastPayload } = setup()
    const verify = vi.fn()
    act(() => result.current.open({ verify, onVerified: vi.fn() }))
    await act(async () => {
      await confirm(lastPayload())
    })
    expect(verify).not.toHaveBeenCalled()
    expect(lastPayload().errorNonce).toBeGreaterThan(0)
  })

  it('non-password error: closes the modal and calls onError', async () => {
    const { result, closeModal, lastPayload } = setup()
    const verify = vi.fn().mockRejectedValue(new Error('network down'))
    const onVerified = vi.fn()
    const onError = vi.fn()
    act(() => result.current.open({ verify, onVerified, onError }))
    act(() => lastPayload().onInputChange('1234'))
    await act(async () => {
      await confirm(lastPayload())
    })
    expect(closeModal).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalled()
    expect(onVerified).not.toHaveBeenCalled()
  })

  it('cancel closes the modal and runs the cleanup callback', () => {
    const { result, closeModal, onCancel, lastPayload } = setup()
    act(() => result.current.open({ verify: vi.fn(), onVerified: vi.fn() }))
    act(() => lastPayload().onCancel())
    expect(closeModal).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('reset clears the remembered password', async () => {
    const { result, lastPayload } = setup()
    const verify = vi.fn().mockResolvedValue({ page_count: 1 })
    act(() => result.current.open({ verify, onVerified: vi.fn() }))
    act(() => lastPayload().onInputChange('1234'))
    await act(async () => {
      await confirm(lastPayload())
    })
    expect(result.current.pdfPassword).toBe('1234')
    act(() => result.current.reset())
    expect(result.current.pdfPassword).toBe('')
  })
})
