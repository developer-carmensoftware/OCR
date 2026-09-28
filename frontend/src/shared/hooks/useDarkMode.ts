import { useCallback, useState } from 'react'

/**
 * App-wide light/dark theme. The initial theme is applied in main.tsx (reads
 * localStorage before first paint to avoid a flash); this hook reads/toggles it.
 * `data-theme` lives on <html>, so the whole app responds.
 */
function isDarkNow(): boolean {
  return document.documentElement.dataset.theme === 'dark'
}

export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(isDarkNow)

  const toggle = useCallback(() => {
    const next = !isDarkNow()
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDark(next)
  }, [])

  return [dark, toggle]
}
