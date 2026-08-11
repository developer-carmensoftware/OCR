import { Moon, Sun } from 'lucide-react'
import { useDarkMode } from '../../hooks/useDarkMode'
import { useT } from '../../i18n/LanguageContext'

/** Square icon button that flips the app between light and dark themes.
 *
 *  The label renders only where the button becomes a menu row (the app header's
 *  `⋯` popover on phones) — see `.theme-toggle__label` in layout.css. Everywhere
 *  else this stays a 36px icon square, so the label is hidden rather than absent:
 *  a lone moon in a list of labelled rows is the one row you have to guess at.
 */
export default function DarkModeToggle() {
  const [dark, toggle] = useDarkMode()
  const { t } = useT()
  const label = dark ? t('nav.themeLight') : t('nav.themeDark')
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={label}
    >
      {dark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
      <span className="theme-toggle__label">{label}</span>
    </button>
  )
}
