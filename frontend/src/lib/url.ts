export function getCarmenUrl(path = ''): string {
  let base = ''

  try {
    const stored = sessionStorage.getItem('ocr_user')
    if (stored) {
      const user = JSON.parse(stored) as { uri?: string }
      base = user.uri || ''
    }
  } catch {
    // sessionStorage unavailable or JSON parse failed
  }

  if (!base) {
    base = `${window.location.protocol}//${window.location.hostname}`
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base.replace(/\/$/, '')}/#${normalizedPath}`
}
