/**
 * Whether a BU's PMS days post by themselves (CA-119), and the Carmen credential they are
 * read and posted with — #/pms, on the session JWT. The session's tenant is the only BU these
 * calls can see or touch. How a day posts (prefix, sides) is the BU's PMS setting in Carmen.
 */

import { apiFetch } from '@/shared/api/client'
import { API } from '@/shared/api/endpoints'

export interface PmsSettings {
  auto_post: boolean
  /** Whether a Carmen credential is stored: nothing can be read or posted without one. */
  has_credential: boolean
}

async function failure(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => ({}))) as {
    detail?: unknown
    errors?: { message?: string }[]
  }
  const detail =
    typeof body.detail === 'string' ? body.detail : (body.errors?.[0]?.message ?? fallback)
  return new Error(detail)
}

export async function getPmsSettings(): Promise<PmsSettings> {
  const res = await apiFetch(API.pms.settings)
  if (!res.ok) throw await failure(res, "Couldn't load the posting settings")
  return res.json()
}

export async function putPmsSettings(body: { auto_post: boolean }): Promise<PmsSettings> {
  const res = await apiFetch(API.pms.settings, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await failure(res, "Couldn't save the posting settings")
  return res.json()
}

/** Store the token Carmen's menu opened this page with as the BU's credential. The server
 *  proves it against Carmen first, so a refused one is an error, not a stored dud. */
export async function putPmsCredential(token: string): Promise<PmsSettings> {
  const res = await apiFetch(API.pms.credential, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw await failure(res, "Couldn't store the Carmen access")
  return res.json()
}
