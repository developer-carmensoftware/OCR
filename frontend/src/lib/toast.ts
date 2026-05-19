import { toast } from 'sonner'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

export function showToast(msg: string, type: ToastType = 'info'): void {
  if (type === 'success') toast.success(msg)
  else if (type === 'error') toast.error(msg)
  else if (type === 'warning') toast.warning(msg)
  else toast.info(msg)
}
