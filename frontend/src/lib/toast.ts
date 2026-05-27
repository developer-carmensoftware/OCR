import { toast } from 'sonner'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

/**
 * Tone guidelines:
 *   ✅ Specific: "Extracted 7 lines from BBL statement"
 *   ❌ Generic:  "Success" · "Done"
 *   ✅ Actionable error: pair with `toastAction` so user can recover.
 *   ❌ Vague:    "Submission failed"
 */
export function showToast(msg: string, type: ToastType = 'info'): void {
  if (type === 'success') toast.success(msg)
  else if (type === 'error') toast.error(msg)
  else if (type === 'warning') toast.warning(msg)
  else toast.info(msg)
}

export function toastPromise<T>(
  promise: Promise<T>,
  opts: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((err: unknown) => string)
  }
) {
  return toast.promise(promise, opts)
}

export function toastAction(
  msg: string,
  action: { label: string; onClick: () => void },
  type: ToastType = 'info'
) {
  const fn =
    type === 'success'
      ? toast.success
      : type === 'error'
        ? toast.error
        : type === 'warning'
          ? toast.warning
          : toast.info
  return fn(msg, { action })
}

export { toast }
