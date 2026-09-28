import { toast } from 'sonner'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

/**
 * Tone guidelines:
 *   ✅ Specific: "Extracted 7 lines from BBL statement"
 *   ❌ Generic:  "Success" · "Done"
 *   ✅ Actionable error: give the user a way to recover.
 *   ❌ Vague:    "Submission failed"
 */
export function showToast(msg: string, type: ToastType = 'info'): void {
  if (type === 'success') toast.success(msg)
  else if (type === 'error') toast.error(msg)
  else if (type === 'warning') toast.warning(msg)
  else toast.info(msg)
}

export { toast }
