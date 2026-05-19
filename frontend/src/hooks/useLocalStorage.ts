import { useState, useEffect, useCallback } from 'react'

export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (valOrFn: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const set = useCallback(
    (valOrFn: T | ((prev: T) => T)) => {
      setValue(prev => {
        const next = typeof valOrFn === 'function' ? (valOrFn as (prev: T) => T)(prev) : valOrFn
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          /* quota exceeded */
        }
        return next
      })
    },
    [key]
  )

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return
      try {
        setValue(e.newValue !== null ? (JSON.parse(e.newValue) as T) : defaultValue)
      } catch {
        setValue(defaultValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key, defaultValue])

  return [value, set]
}
