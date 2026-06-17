import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { translate, type Lang, type TKey } from './dict'

const STORAGE_KEY = 'lang'

/** Default to Thai for this Thai-facing purchase flow; persisted override wins. */
function readLang(): Lang {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'en' ? 'en' : 'th'
}

type Vars = Record<string, string | number>

interface LanguageCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TKey, vars?: Vars) => string
}

const Ctx = createContext<LanguageCtx | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l)
    // Switching re-renders every consumer at once and Thai/English text reflows
    // at different widths — a hard cut looks janky. Crossfade it with the native
    // View Transitions API (Chromium/Safari); plain swap where unsupported.
    const startVT = (document as Document & { startViewTransition?: (cb: () => void) => void })
      .startViewTransition
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (startVT && !reduce) {
      startVT.call(document, () => flushSync(() => setLangState(l)))
    } else {
      setLangState(l)
    }
  }, [])

  const t = useCallback((key: TKey, vars?: Vars) => translate(lang, key, vars), [lang])

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useT(): LanguageCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useT must be used within a LanguageProvider')
  return ctx
}
