import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Stub sessionStorage / localStorage for all tests
const makeStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
  }
}

Object.defineProperty(window, 'localStorage', { value: makeStorage(), writable: true })
Object.defineProperty(window, 'sessionStorage', { value: makeStorage(), writable: true })
Object.defineProperty(window, 'open', { value: vi.fn(), writable: true })
