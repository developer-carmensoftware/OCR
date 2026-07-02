import { useState } from 'react'
import { toast } from 'sonner'
import {
  approveOrder,
  rejectOrder,
  updateOrderNote,
  type AdminCreditOrder,
} from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

/** Keep the company name when a mutation endpoint returns it null (no Tenant join). */
function withName(updated: AdminCreditOrder, prev: AdminCreditOrder): AdminCreditOrder {
  return {
    ...updated,
    tenant_name: updated.tenant_name ?? prev.tenant_name,
    buyer_name: updated.buyer_name ?? prev.buyer_name,
  }
}

/**
 * Shared order-decision handlers (approve / reject / hold) with busy state +
 * success/error toasts, used by OrderWorkspace (the sole detail surface).
 * Posting to AR is NOT here — it's a single shared function at the page level
 * (`postOrders` in CreditOrdersPage) so the inline row button, the batch bar, and
 * this workspace's "Post to AR" button all go through one implementation.
 */
export function useOrderActions(
  order: AdminCreditOrder,
  onChanged: (updated: AdminCreditOrder) => void
) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)

  const act = async (fn: () => Promise<AdminCreditOrder>) => {
    setBusy(true)
    try {
      const updated = withName(await fn(), order)
      onChanged(updated)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return {
    busy,
    onApprove: () =>
      act(async () => {
        const u = await approveOrder(order.id)
        toast.success(t('orev.toast.approved', { n: order.credits.toLocaleString() }))
        return u
      }),
    onReject: (reason: string) =>
      act(async () => {
        const u = await rejectOrder(order.id, reason)
        toast.success(t('orev.toast.voided'))
        return u
      }),
    onHold: (note: string) =>
      act(async () => {
        const u = await updateOrderNote(order.id, note || undefined)
        toast.success(t('orev.toast.noteSaved'))
        return u
      }),
  }
}
