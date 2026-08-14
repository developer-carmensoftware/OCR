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

// jsdom (v30) ships no <dialog> methods at all. Without these a modal dialog
// never gets its `open` attribute, so everything inside it is display:none and
// invisible to getByRole. The top layer and ::backdrop are the browser's; what
// matters under test is that the content is there and reachable.
const dialog = window.HTMLDialogElement?.prototype
if (dialog && !dialog.showModal) {
  dialog.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialog.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  dialog.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}
