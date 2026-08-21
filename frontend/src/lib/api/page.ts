/**
 * The envelope every paged list endpoint returns. Mirrors `app.models.schemas.common.Page`.
 *
 * `total` counts all matching rows, not `data.length` — it is what tells the UI whether
 * a "load more" button belongs on screen at all.
 */
export interface Page<T> {
  total: number
  limit: number
  offset: number
  data: T[]
}
