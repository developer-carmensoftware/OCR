import { apiFetch } from './client'
import { API } from './endpoints'

/** Record server-side consent for the given version. Resolves on 2xx, throws otherwise. */
export async function postConsent(version: string): Promise<void> {
  const res = await apiFetch(API.consent.record, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version }),
  })
  if (!res.ok) throw new Error(`consent POST failed: ${res.status}`)
}

/** Whether this tenant already has a server-side consent record for the version. */
export async function getConsentStatus(version: string): Promise<boolean> {
  const res = await apiFetch(API.consent.status(version))
  if (!res.ok) throw new Error(`consent status failed: ${res.status}`)
  const data = (await res.json().catch(() => ({}))) as { consented?: boolean }
  return data.consented === true
}
