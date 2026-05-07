import { useState, useEffect, useCallback } from 'react'

/**
 * A custom hook that syncs a value with localStorage.
 * Handles JSON serialization, cross-tab sync via the storage event,
 * and parse errors gracefully.
 *
 * @param {string} key           - The localStorage key
 * @param {*}      defaultValue  - Value used when the key is absent or invalid
 * @returns {[value, setValue]}  - Same API as useState
 */
export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item !== null ? JSON.parse(item) : defaultValue
    } catch {
      return defaultValue
    }
  })

  // Keep localStorage in sync when setValue is called
  const set = useCallback((valOrFn) => {
    setValue(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* quota exceeded etc */ }
      return next
    })
  }, [key])

  // Sync across browser tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key !== key) return
      try {
        setValue(e.newValue !== null ? JSON.parse(e.newValue) : defaultValue)
      } catch {
        setValue(defaultValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key, defaultValue])

  return [value, set]
}
