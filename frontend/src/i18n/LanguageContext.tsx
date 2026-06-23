import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { translate, type Lang, type TKey } from './dict'

// ponytail: the real provider wraps the whole app at the root (main.tsx), so the
// only consumers without one are unit tests that render a hook/component in
// isolation. Fall back to a static English context there instead of throwing.
const FALLBACK_CTX: LanguageCtx = {
  lang: 'en',
  setLang: () => {},
  t: (key, vars) => translate('en', key, vars),
}

const STORAGE_KEY = 'lang'

/** English is the default UI language app-wide; persisted override wins. */
function readLang(): Lang {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'th' ? 'th' : 'en'
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
  return useContext(Ctx) ?? FALLBACK_CTX
}
