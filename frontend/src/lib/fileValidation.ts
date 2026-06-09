/**
 * Client-side upload guards. Mirrors the backend MAX_FILE_SIZE_MB so the user
 * gets an instant, friendly error instead of waiting for the upload to finish
 * and bouncing off a 413.
 */

// Keep in sync with backend `MAX_FILE_SIZE_MB` (backend/.env).
export const MAX_FILE_SIZE_MB = 20
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

/** Returns an error message if any file is too large, otherwise null. */
export function checkFilesSize(files: File[]): string | null {
  const tooBig = files.find(f => f.size > MAX_FILE_SIZE_BYTES)
  if (!tooBig) return null
  const mb = (tooBig.size / 1024 / 1024).toFixed(1)
  return `"${tooBig.name}" is ${mb}MB — over the ${MAX_FILE_SIZE_MB}MB limit. Please upload a smaller file.`
}
