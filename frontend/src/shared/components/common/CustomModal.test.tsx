import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CustomModal from './CustomModal'

// framer-motion's useReducedMotion reads window.matchMedia, which jsdom lacks.
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

const baseProps = {
  show: true,
  title: 'Password-Protected PDF',
  message: 'Enter the password',
  type: 'warning' as const,
  inputLabel: 'PDF Password',
  inputType: 'password' as const,
  confirmText: 'Unlock',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

const input = () => screen.getByLabelText('PDF Password') as HTMLInputElement

describe('CustomModal — password affordances', () => {
  it('busy: disables confirm and shows a spinner', () => {
    render(<CustomModal {...baseProps} busy />)
    expect((screen.getByRole('button', { name: 'Unlock' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('busy: disables the password input', () => {
    render(<CustomModal {...baseProps} busy />)
    expect(input().disabled).toBe(true)
  })

  it('errorNonce bump flags the input invalid (aria-invalid + error class)', async () => {
    const { rerender } = render(<CustomModal {...baseProps} errorNonce={0} />)
    expect(input().hasAttribute('aria-invalid')).toBe(false)

    rerender(<CustomModal {...baseProps} errorNonce={1} />)
    await waitFor(() => expect(input().getAttribute('aria-invalid')).toBe('true'))
    expect(input().className).toContain('modal-input--error')
  })

  it('typing clears the invalid state', async () => {
    // errorNonce is a bump signal: mount at 0, then bump to 1 (real usage never
    // mounts pre-flagged). Mirrors the "errorNonce bump" test above.
    const { rerender } = render(<CustomModal {...baseProps} errorNonce={0} />)
    rerender(<CustomModal {...baseProps} errorNonce={1} />)
    await waitFor(() => expect(input().getAttribute('aria-invalid')).toBe('true'))
    fireEvent.change(input(), { target: { value: '12' } })
    expect(input().hasAttribute('aria-invalid')).toBe(false)
    // a later re-render with the same nonce must not re-flag it
    rerender(<CustomModal {...baseProps} errorNonce={1} />)
    expect(input().hasAttribute('aria-invalid')).toBe(false)
  })

  it('reveal toggle switches the input between password and text', () => {
    render(<CustomModal {...baseProps} />)
    expect(input().getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input().getAttribute('type')).toBe('text')

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(input().getAttribute('type')).toBe('password')
  })

  it('Enter in the field confirms when not busy, and does nothing when busy', () => {
    const onConfirm = vi.fn()
    const { rerender } = render(<CustomModal {...baseProps} onConfirm={onConfirm} />)
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledTimes(1)

    rerender(<CustomModal {...baseProps} onConfirm={onConfirm} busy />)
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledTimes(1) // unchanged while busy
  })
})
