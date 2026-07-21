/// <reference types="vite/client" />

/** SemVer from the repo-root VERSION file, injected by vite.config.ts `define`. */
declare const __APP_VERSION__: string

declare module '*.css' {
  const content: Record<string, string>
  export default content
}
