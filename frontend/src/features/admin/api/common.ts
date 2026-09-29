/** Query-string and error helpers shared by the `features/admin/api/*` modules. */

export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null
}

export function buildQs(params: QueryParams): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function unwrapDetail(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { detail?: string }
  return err.detail || fallback
}
