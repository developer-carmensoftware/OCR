import { Languages } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'

/** Compact single-button language switch (globe + current language).
 *
 *  Two renderings of the same state: the `EN` / `ไทย` code in the header row and
 *  the admin sidebar, where space is tight, and the full endonym where the button
 *  becomes a menu row (the header's `⋯` popover on phones). Both name the language
 *  you are in, not the one you would switch to — see `.lang-toggle__*` in
 *  layout.css. Endonyms are not translated per locale, so they need no dict keys.
 */
export default function LanguageToggle() {
  const { lang, setLang } = useT()
  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
      aria-label={lang === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
    >
      <Languages size={15} strokeWidth={2} />
      <span className="lang-toggle__code">{lang === 'en' ? 'EN' : 'ไทย'}</span>
      <span className="lang-toggle__name">{lang === 'en' ? 'English' : 'ไทย'}</span>
    </button>
  )
}
