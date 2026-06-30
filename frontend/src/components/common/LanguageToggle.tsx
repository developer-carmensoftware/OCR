import { Languages } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'

/** Compact single-button language switch (globe + current language). */
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
      <span>{lang === 'en' ? 'EN' : 'ไทย'}</span>
    </button>
  )
}
