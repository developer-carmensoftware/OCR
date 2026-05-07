/**
 * Shared toast notification utility.
 * Wraps the `sonner` toast library with a unified API.
 * Import this instead of declaring a local showToast in each hook/component.
 */
import { toast } from 'sonner'

/**
 * Show a toast notification.
 * @param {string} msg - The message to display
 * @param {'info'|'success'|'error'|'warning'} [type='info'] - Toast type
 */
export function showToast(msg, type = 'info') {
  if (type === 'success') toast.success(msg)
  else if (type === 'error') toast.error(msg)
  else if (type === 'warning') toast.warning(msg)
  else toast.info(msg)
}
