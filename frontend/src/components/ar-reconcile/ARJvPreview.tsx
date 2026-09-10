import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import '../../styles/pages/ar-reconcile.css'
import type { ARPreview } from '../../lib/api/arReconcile'

/**
 * The JV this configuration would post, over a worked example.
 *
 * A panel rather than the mockup's modal: it is a readout, and the whole value is seeing
 * seven credit lines collapse into three *while* the Detail/Summary toggle is flipped.
 * Behind a button it would be consulted once, after the decision.
 *
 * The figures are the ones KBANK actually prints on a KB1P554V2 report, so the grouping
 * shown is the grouping a real document gets — but they are still an example, which the
 * header says rather than leaves to be inferred.
 */

interface Props {
  preview: ARPreview | null
  loading: boolean
  postType: string
  /** What the figures are. The settings screen shows an example; the review screen shows
   *  the document actually waiting, and must not call it one. */
  label?: string
}

const money = (n: number) =>
  n === 0 ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ARJvPreview({
  preview,
  loading,
  postType,
  label = 'Worked example',
}: Props) {
  return (
    <div className="ar-section ar-preview" aria-busy={loading}>
      <div className="section-title cc-section-title-container">
        <span>JV PREVIEW</span>
        <span className="ar-preview-note">
          {label}
          {preview ? ` · ${preview.doc_date} · Tax Inv.# ${preview.doc_no}` : ''}
        </span>
      </div>

      {!preview ? (
        <div className="ar-preview-empty">
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" /> Building preview...
            </>
          ) : (
            'Preview unavailable — check that this bank is configured.'
          )}
        </div>
      ) : (
        <>
          <div className="ar-preview-desc">
            <span className="ar-preview-desc-label">Description</span>
            <span className="ar-preview-desc-value">{preview.description || '(empty)'}</span>
          </div>

          {preview.unmapped.length > 0 && (
            <div className="ar-preview-warn" role="alert">
              <AlertTriangle size={14} className="cc-flex-shrink-0" />
              <span>
                Unmapped, so this would wait for review:{' '}
                <strong>{preview.unmapped.join(', ')}</strong>
              </span>
            </div>
          )}

          <div className="table-wrapper">
            <table className="ar-preview-table">
              <thead>
                <tr>
                  <th scope="col">Dept</th>
                  <th scope="col">Acc Code</th>
                  <th scope="col">Comment</th>
                  <th scope="col" className="ar-num">
                    Debit
                  </th>
                  <th scope="col" className="ar-num">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={`${r.acc}-${r.desc}-${i}`} className={i === 0 ? 'ar-row-debit' : ''}>
                    <td>{r.dept || <span className="ar-missing">—</span>}</td>
                    <td>{r.acc || <span className="ar-missing">not mapped</span>}</td>
                    <td className="ar-comment">{r.desc}</td>
                    <td className="ar-num">{money(r.debit)}</td>
                    <td className="ar-num">{money(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    {preview.rows.length} lines · {postType}
                  </td>
                  <td className="ar-num">{money(preview.total_debit)}</td>
                  <td className="ar-num">{money(preview.total_credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className={`ar-balance ${preview.balanced ? 'ok' : 'bad'}`}>
            {preview.balanced ? (
              <>
                <CheckCircle2 size={14} /> Debit = Credit
              </>
            ) : (
              <>
                <AlertTriangle size={14} /> Out by{' '}
                {money(Math.abs(preview.total_debit - preview.total_credit))} — this JV cannot post
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
