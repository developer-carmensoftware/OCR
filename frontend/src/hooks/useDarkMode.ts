import { useEffect } from 'react'

export function useDarkMode(): [boolean, () => void] {
  useEffect(() => {
    document.documentElement.dataset.theme = 'light'
    localStorage.removeItem('theme')
  }, [])

  return [false, () => {}]
}
