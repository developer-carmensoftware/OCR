/** Format a backend ISO timestamp (tz-aware, `+00:00`) in the viewer's local
 * timezone as `YYYY-MM-DD HH:mm:ss`. The old `slice(0, 19)` pattern chopped the
 * offset and displayed raw UTC. */
export const fmtDateTime = (s: string | null | undefined): string =>
  s ? new Date(s).toLocaleString('sv-SE') : '—'
