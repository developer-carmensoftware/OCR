import { useMemo } from 'react'
import type { DetailRow } from '../credit-card/DetailTable'
import type { ARPreview, ARPreviewRow } from '../../lib/api/arReconcile'
import { useT } from '../../i18n/LanguageContext'
import { fmt, parseNum } from '../../lib/format'

/**
 * The settlement report's JV, as a reconciliation rather than a readout.
 *
 * `ARJvPreview` used to stand here. It is the settings screen's worked example — its
 * heading reads JV PREVIEW, its empty state tells you to configure the bank, and its
 * unmapped warning says the document "would wait for review" to a reviewer who is looking
 * at it *in* the review queue. Borrowed wholesale it answered a different question than
 * the one being asked.
 *
 * What is being checked here is an arithmetic claim: every payment type KBANK printed
 * became a credit line against an account, and the sum of them is the control account's
 * debit. So each printed line sits on the row of the leg it became. In Detail that is one
 * to one and the table is flat. In Summary two or more printed labels fold onto a scheme
 * (`VS INTER UP PREM` + `VS LOCAL UP PREM` → `VS`), and the constituents render beneath
 * the key with their own figures — the merge is the thing under review, so it is shown
 * rather than asserted.
 *
 * Read-only, and not because it was cheaper: the rows come from the server, and the same
 * server rebuilds them on approve. Nothing typed here could reach Carmen. The accounts are
 * per payment type in `ar_reconcile_mappings`, which is a rule and not this document's
 * business; the header fields are read-only for the same reason (see JvHeaderCard's
 * `readOnly`).
 */

interface Props {
  /** The JV the server will post. `null` when this bank has no AR configuration. */
  jv: ARPreview | null
  /** The lines the document actually prints, so the grouping can be checked against them. */
  details: DetailRow[]
}

/** The label the server grouped under, normalised the way `group_key` receives it. */
const labelOf = (d: DetailRow) => (d.Transaction || '').trim() || 'UNKNOWN'

export default function ARReviewPane({ jv, details }: Props) {
  const { t } = useT()

  const { control, groups, orphans, totalThb } = useMemo(() => {
    const rows = jv?.rows ?? []
    // The counterpart leg is the one belonging to no group — `build_ar_jv_rows` writes it
    // first, but identifying it by what it is beats identifying it by where it sits.
    const ctrl = rows.find(r => !r.key) ?? null
    const legs = rows.filter(r => r.key)

    // Which leg a printed line became. Exact key first (Detail keeps the label as
    // printed), then the leading token (Summary folds onto the scheme).
    //
    // ponytail: this reads the server's grouping off the keys it sent rather than
    // re-deriving it. A line that matches nothing falls to `orphans` and is shown as
    // unposted — so a future grouping rule degrades into a visible gap, not a wrong row.
    const legFor = (label: string): ARPreviewRow | undefined =>
      legs.find(l => l.key === label) ?? legs.find(l => label.startsWith(`${l.key} `))

    const bucket = new Map<string, DetailRow[]>(legs.map(l => [l.key, []]))
    const loose: DetailRow[] = []
    for (const d of details) {
      // A line the report prints at zero produces no journal leg (`build_ar_jv_rows`
      // skips it). Showing it anyway is what stops the table quietly disagreeing with
      // the paper it was read from.
      if (!parseNum(d.PayAmt)) {
        loose.push(d)
        continue
      }
      const leg = legFor(labelOf(d))
      if (leg) bucket.get(leg.key)?.push(d)
      else loose.push(d)
    }

    const built = legs.map(leg => {
      const lines = bucket.get(leg.key) ?? []
      return {
        leg,
        lines,
        thb: lines.reduce((s, d) => s + parseNum(d.PayAmt), 0),
        // One printed line whose label *is* the key has nothing to disclose: the row
        // already shows it. Only a real merge earns its constituent lines.
        merged: lines.length > 1 || (lines.length === 1 && labelOf(lines[0]) !== leg.key),
      }
    })

    return {
      control: ctrl,
      groups: built,
      orphans: loose,
      totalThb: built.reduce((s, g) => s + g.thb, 0),
    }
  }, [jv, details])

  if (!jv) {
    return (
      <div className="arv arv-empty" role="status">
        {t('review.arNotConfigured')}
      </div>
    )
  }

  const summary = jv.post_type === 'Summary'
  const imbalanced = !jv.balanced

  return (
    <div className="arv">
      {/* Which grouping produced this table. The reviewer cannot tell Detail from Summary
          by looking at it — a one-scheme day makes them identical — and the rule is what
          they are being asked to accept. */}
      <p className="arv-grouping">
        <span className="arv-posttype">
          {summary ? t('review.arPostTypeSummary') : t('review.arPostTypeDetail')}
        </span>
        {summary ? t('review.arGroupingSummary') : t('review.arGroupingDetail')}
      </p>

      <table className="jv-table">
        <thead>
          <tr>
            <th scope="col">{t('review.arColPaymentType')}</th>
            <th scope="col" className="jv-num arv-c-thb">
              {t('review.arColThb')}
            </th>
            <th scope="col" className="arv-c-dept">
              {t('review.jvDept')}
            </th>
            <th scope="col" className="arv-c-acc">
              {t('review.jvAccount')}
            </th>
            <th scope="col" className="jv-num">
              {t('review.jvDebit')}
            </th>
            <th scope="col" className="jv-num">
              {t('review.jvCredit')}
            </th>
          </tr>
        </thead>

        <tbody>
          {groups.map(({ leg, lines, thb, merged }) => [
            <tr key={leg.key}>
              <td className="arv-key" data-label={t('review.arColPaymentType')}>
                {leg.key}
              </td>
              <td className="jv-num text-mono" data-label={t('review.arColThb')}>
                {fmt(thb)}
              </td>
              <td
                className={`text-mono${leg.dept ? '' : ' missing-cell'}`}
                data-label={t('review.jvDept')}
              >
                {leg.dept || t('review.arNotMapped')}
              </td>
              <td
                className={`text-mono${leg.acc ? '' : ' missing-cell'}`}
                data-label={t('review.jvAccount')}
              >
                {leg.acc || t('review.arNotMapped')}
              </td>
              <td
                className={`jv-num text-mono${leg.debit ? '' : ' jv-num--empty'}`}
                data-label={t('review.jvDebit')}
              >
                {leg.debit ? fmt(leg.debit) : ''}
              </td>
              <td
                className={`jv-num text-mono${leg.credit ? '' : ' jv-num--empty'}`}
                data-label={t('review.jvCredit')}
              >
                {leg.credit ? fmt(leg.credit) : ''}
              </td>
            </tr>,
            // The labels this key was folded from, each with the figure it contributed.
            // Their sum is the Credit cell one row up, so the merge is checkable without
            // repeating a subtotal beside it.
            ...(merged
              ? lines.map(d => (
                  <tr key={`${leg.key}-${d._uid}`} className="arv-row-src">
                    <td className="arv-src" data-label={t('review.arColPaymentType')}>
                      {labelOf(d)}
                    </td>
                    <td className="jv-num text-mono" data-label={t('review.arColThb')}>
                      {fmt(d.PayAmt)}
                    </td>
                    <td className="jv-num--empty" />
                    <td className="jv-num--empty" />
                    <td className="jv-num--empty" />
                    <td className="jv-num--empty" />
                  </tr>
                ))
              : []),
          ])}

          {/* Printed, but journalised nowhere: a zero line, or a label the grouping did
              not claim. Stated on the row rather than left as an absence the reviewer
              would have to notice by counting. */}
          {orphans.map(d => (
            <tr key={`orphan-${d._uid}`} className="arv-row-zero">
              <td data-label={t('review.arColPaymentType')}>
                {labelOf(d)}
                <span className="arv-note">{t('review.arNotPosted')}</span>
              </td>
              <td className="jv-num text-mono" data-label={t('review.arColThb')}>
                {fmt(d.PayAmt)}
              </td>
              <td className="jv-num--empty" />
              <td className="jv-num--empty" />
              <td className="jv-num--empty" />
              <td className="jv-num--empty" />
            </tr>
          ))}

          {/* The counterpart to every line above it — the day's gross takings against the
              control account. Inside the table, so the totals below total what is on
              screen; ruled off, because it is not one of the report's own lines. */}
          {control && (
            <tr className="arv-row-control">
              <td className="arv-key" data-label={t('review.arColPaymentType')}>
                {t('review.arControlLeg')}
              </td>
              <td className="jv-num--empty" />
              <td
                className={`text-mono${control.dept ? '' : ' missing-cell'}`}
                data-label={t('review.jvDept')}
              >
                {control.dept || t('review.arNotMapped')}
              </td>
              <td
                className={`text-mono${control.acc ? '' : ' missing-cell'}`}
                data-label={t('review.jvAccount')}
              >
                {control.acc || t('review.arNotMapped')}
              </td>
              <td
                className={`jv-num text-mono${control.debit ? '' : ' jv-num--empty'}`}
                data-label={t('review.jvDebit')}
              >
                {control.debit ? fmt(control.debit) : ''}
              </td>
              <td
                className={`jv-num text-mono${control.credit ? '' : ' jv-num--empty'}`}
                data-label={t('review.jvCredit')}
              >
                {control.credit ? fmt(control.credit) : ''}
              </td>
            </tr>
          )}
        </tbody>

        <tfoot>
          <tr className={`jv-total${imbalanced ? ' jv-total--bad' : ''}`}>
            <td data-label={t('review.jvDesc')}>
              {imbalanced ? t('review.jvImbalanced') : t('review.jvBalanced')}
            </td>
            <td className="jv-num text-mono" data-label={t('review.arColThb')}>
              {fmt(totalThb)}
            </td>
            <td className="jv-num--empty" />
            <td className="jv-num--empty" />
            <td className="jv-num text-mono" data-label={t('review.jvDebit')}>
              {fmt(jv.total_debit)}
            </td>
            <td className="jv-num text-mono" data-label={t('review.jvCredit')}>
              {fmt(jv.total_credit)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
