/**
 * "Which release notes has this browser seen" — the newest date read, as one
 * string.
 *
 * Plain, un-namespaced key: this is a per-person UI pref, not tenant business
 * data, so it deliberately bypasses lib/storage.ts and survives logout and
 * tenant switch (same human, same changelog). See the NOTE in storage.ts.
 *
 * Two readers need to stay in sync — the bell's unread badge and the What's New
 * page that clears it — so writes announce themselves on a window event, the
 * same way `ocr:maintenance` and `ocr:open-topup` already do.
 */

const KEY = 'releaseNotesSeen'

export const RELEASE_SEEN_EVENT = 'ocr:release-seen'

/**
 * Where the What's New page sends you back to. Lives here rather than on the
 * page because the bell writes it and the page reads it — and the page is
 * lazy-loaded, so importing the constant from it would drag the whole route
 * into the main bundle.
 */
export const WHATS_NEW_RETURN_KEY = 'whatsnew:returnTo'

export function readReleaseSeen(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return '' // storage unavailable — everything reads as unseen
  }
}

/** Advance the seen mark. Older dates are ignored: the mark only moves forward. */
export function markReleaseSeen(date: string): void {
  if (!date || date <= readReleaseSeen()) return
  try {
    localStorage.setItem(KEY, date)
  } catch {
    // storage unavailable — the badge just returns next session
  }
  window.dispatchEvent(new CustomEvent(RELEASE_SEEN_EVENT))
}
