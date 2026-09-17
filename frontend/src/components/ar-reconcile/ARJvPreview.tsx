import { AlertTriangle, CheckCircle2, Loader2, Receipt } from 'lucide-react'
import '../../styles/pages/ar-reconcile.css'
import Card from '../admin/ui/Card'
import { useT } from '../../i18n/LanguageContext'
import type { ARPreview } from '../../lib/api/arReconcile'

/**
 * The JV this configuration would post, over a worked example.
 *
 * A panel rather than the mockup's modal, and from 1200px up a sticky one beside the
 * settings rather than below them: the whole value is seeing seven credit lines collapse
 * into three *while* the Detail/Summary toggle is flipped. Behind a button — or two
 * scrolls down — it would be consulted once, after the decision.
 *
 * The figures are the ones KBANK actually prints on a KB1P554V2 report, so the grouping
 * shown is the grouping a real document gets — but they are still an example, which the
 * header says rather than leaves to be inferred.
 *
 * It no longer prints the rendered description: that belongs to the template field that
 * produces it, and is shown under it. Two copies of one string on one screen is two
 * places to look when they disagree.
 *
 * **Settings only.** The review dialog borrowed this for a while and it was the wrong
 * component there: its heading, its empty state and its unmapped warning are all written
 * from the point of view of someone configuring a bank, not someone approving a document.
 * `ARReviewPane` answers that question instead.
 */

interface Props {
  preview: ARPreview | null
  loading: boolean
  /** Already translated by the page, which owns the Detail/Summary control. */
  postTypeLabel: string
}

const money = (n: number) =>
  n === 0 ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ARJvPreview({ preview, loading, postTypeLabel }: Props) {
  const { t } = useT()

  return (
    <Card title={t('ar.previewTitle')} icon={<Receipt size={16} />}>
      <div className="ar-preview" aria-busy={loading}>
        {/* A caption, not a card action: in the 420px rail a header control refuses to
            shrink and prints itself over the title. */}
        <p className="ar-preview-note">
          {t('ar.previewNote')}
          {preview
            ? ` · ${t('ar.previewMeta', { date: preview.doc_date, docNo: preview.doc_no })}`
            : ''}
        </p>
        {!preview ? (
          <div className="ar-preview-empty">
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> {t('ar.previewBuilding')}
              </>
            ) : (
              t('ar.previewUnavailable')
            )}
          </div>
        ) : (
          <>
            {preview.unmapped.length > 0 && (
              <div className="ar-preview-warn" role="alert">
                <AlertTriangle size={14} className="cc-flex-shrink-0" />
                <span>{t('ar.previewUnmapped', { types: preview.unmapped.join(', ') })}</span>
              </div>
            )}

            <div className="table-wrapper">
              <table className="ar-preview-table">
                <thead>
                  <tr>
                    <th scope="col">{t('review.jvDept')}</th>
                    <th scope="col">{t('review.jvAccount')}</th>
                    <th scope="col">{t('review.jvDesc')}</th>
                    <th scope="col" className="ar-num">
                      {t('review.jvDebit')}
                    </th>
                    <th scope="col" className="ar-num">
                      {t('review.jvCredit')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={`${r.acc}-${r.desc}-${i}`} className={i === 0 ? 'ar-row-debit' : ''}>
                      <td>{r.dept || <span className="ar-missing">—</span>}</td>
                      <td>
                        {r.acc || <span className="ar-missing">{t('review.arNotMapped')}</span>}
                      </td>
                      <td className="ar-comment">{r.desc}</td>
                      <td className="ar-num">{money(r.debit)}</td>
                      <td className="ar-num">{money(r.credit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>
                      {t('ar.previewLines', {
                        count: preview.rows.length,
                        postType: postTypeLabel,
                      })}
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
                  <CheckCircle2 size={14} /> {t('ar.balanced')}
                </>
              ) : (
                <>
                  <AlertTriangle size={14} />{' '}
                  {t('ar.outBy', {
                    amount: money(Math.abs(preview.total_debit - preview.total_credit)),
                  })}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
