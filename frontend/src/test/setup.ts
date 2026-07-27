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
    // The real Storage interface — clearAppStorage() and clearAllDrafts() both
    // enumerate keys, and without these they silently no-op under test.
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  }
}

Object.defineProperty(window, 'localStorage', { value: makeStorage(), writable: true })
Object.defineProperty(window, 'sessionStorage', { value: makeStorage(), writable: true })
Object.defineProperty(window, 'open', { value: vi.fn(), writable: true })
