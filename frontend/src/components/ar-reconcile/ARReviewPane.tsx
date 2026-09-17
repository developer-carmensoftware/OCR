import { useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { DetailRow } from '../credit-card/DetailTable'
import type { ARPreview, ARPreviewRow } from '../../lib/api/arReconcile'
import { useT } from '../../i18n/LanguageContext'
import { fmt, parseNum } from '../../lib/format'

/**
 * The settlement report's JV, as a reconciliation rather than a readout.
 *
 * Read-only, on purpose — reverted 2026-09-16 back to this after a short-lived attempt at
 * inline editing (payment-type mapping since 2026-09-11, the clearing account and the JV
 * description template briefly on top of that) made the modal read like a second copy of
 * `#/CreditCardOCR/ar-settings`. One edit surface, not two: every GL account for this
 * feature — the control leg included — is a bank-level setting, and settings belong on the
 * settings screen. What is checked here is an arithmetic claim: every payment type KBANK
 * printed became a credit line against an account, and the sum of them is the control
 * account's debit. So each printed line sits on the row of the leg it became. In Detail
 * that is one to one and the table is flat. In Summary two or more printed labels fold onto
 * a scheme (`VS INTER UP PREM` + `VS LOCAL UP PREM` → `VS`), and the constituents are one
 * click away beneath the key — the merge is the thing under review, so it stays checkable
 * rather than asserted, but collapsed by default rather than a wall of quiet rows under
 * every leg. The toggle leads the row in its own narrow column, same edge every other
 * row-expand in this app uses (`ExtractionsPage`'s admin table).
 *
 * A blank cell (`missing-cell`, "Not mapped") is not something to fix from here: an
 * unmapped payment type or a missing clearing account both block Approve
 * (`ReviewDocument.tsx`'s `arBlockReason`), which points at `#/CreditCardOCR/ar-settings`
 * rather than opening a picker in place.
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
  // Which merged legs have their folded-in labels open. Closed by default: the merge is
  // what is under review, but seeing it costs a click rather than a wall of quiet rows
  // under every scheme leg before the reviewer has asked for any of them.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggleExpanded = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const { control, groups, newTypes, zeroLines, anyMerged } = useMemo(() => {
    const rows = jv?.rows ?? []
    // The counterpart leg is the one belonging to no group — `build_ar_jv_rows` writes it
    // first, but identifying it by what it is beats identifying it by where it sits.
    const ctrl = rows.find(r => !r.key) ?? null
    const legs = rows.filter(r => r.key)

    // Which leg a printed line became. Exact key first (Detail keeps the label as
    // printed), then the leading token (Summary folds onto the scheme).
    //
    // ponytail: this reads the server's grouping off the keys it sent rather than
    // re-deriving it. A line that matches nothing falls to `newTypes`/`zeroLines`.
    const legFor = (label: string): ARPreviewRow | undefined =>
      legs.find(l => l.key === label) ?? legs.find(l => label.startsWith(`${l.key} `))

    const bucket = new Map<string, DetailRow[]>(legs.map(l => [l.key, []]))
    const loose: DetailRow[] = []
    for (const d of details) {
      if (parseNum(d.PayAmt)) {
        const leg = legFor(labelOf(d))
        if (leg) {
          bucket.get(leg.key)?.push(d)
          continue
        }
      }
      loose.push(d)
    }

    const built = legs.map(leg => {
      const lines = bucket.get(leg.key) ?? []
      return {
        leg,
        lines,
        // One printed line whose label *is* the key has nothing to disclose: the row
        // already shows it. Only a real merge earns its constituent lines.
        merged: lines.length > 1 || (lines.length === 1 && labelOf(lines[0]) !== leg.key),
      }
    })

    // Printed, journalised nowhere, and worth money: a real payment type nobody has
    // mapped yet. Grouped by exact label so two lines sharing one unmapped label read as
    // one row, not two. A zero-amount line (`build_ar_jv_rows` posts nothing for it) has
    // nothing to map.
    const fresh = new Map<string, DetailRow[]>()
    const zero: DetailRow[] = []
    for (const d of loose) {
      if (!parseNum(d.PayAmt)) {
        zero.push(d)
        continue
      }
      const label = labelOf(d)
      const arr = fresh.get(label)
      if (arr) arr.push(d)
      else fresh.set(label, [d])
    }

    return {
      control: ctrl,
      groups: built,
      newTypes: [...fresh.entries()].map(([label, lines]) => ({ label, lines })),
      zeroLines: zero,
      // Whether the disclosure column has anything to disclose anywhere in the table. False
      // for every Detail document and for a Summary day that settled one scheme, and the
      // column collapses rather than ruling an empty gutter down the left edge.
      anyMerged: built.some(g => g.merged),
    }
  }, [jv, details])

  if (!jv) {
    return (
      <div className="arv arv-empty" role="status">
        {t('review.arNotConfigured')}
      </div>
    )
  }

  const imbalanced = !jv.balanced

  /** One Dept + Account cell pair, shared by the control leg, mapped legs and new-type
   *  rows — a value, not a control; a blank one reads "Not mapped" and is fixed on
   *  `#/CreditCardOCR/ar-settings`, not here. */
  function Cells({ dept, acc }: { dept?: string | null; acc?: string | null }) {
    return (
      <>
        <td className={`text-mono${dept ? '' : ' missing-cell'}`} data-label={t('review.jvDept')}>
          {dept || t('review.arNotMapped')}
        </td>
        <td className={`text-mono${acc ? '' : ' missing-cell'}`} data-label={t('review.jvAccount')}>
          {acc || t('review.arNotMapped')}
        </td>
      </>
    )
  }

  return (
    <div className="arv">
      {/* No caption naming Detail/Summary here (cut 2026-09-16): the row shapes already
          say it — "VS INTER UP PREM" vs a folded "VS", one row per printed type vs one per
          scheme. A reviewer reads their own BU's configuration off the table itself. */}
      <table className={`jv-table${anyMerged ? '' : ' arv-flat'}`}>
        <thead>
          <tr>
            <th scope="col" className="arv-c-toggle">
              <span className="sr-only">{t('review.arExpandCol')}</span>
            </th>
            <th scope="col" className="arv-c-dept">
              {t('review.jvDept')}
            </th>
            <th scope="col" className="arv-c-acc">
              {t('review.jvAccount')}
            </th>
            <th scope="col">{t('review.jvDesc')}</th>
            <th scope="col" className="jv-num">
              {t('review.jvDebit')}
            </th>
            <th scope="col" className="jv-num">
              {t('review.jvCredit')}
            </th>
          </tr>
        </thead>

        <tbody>
          {/* The debit leg — the day's gross takings against the control account — leads,
              matching the debit-first convention on `JvEditor`'s own table. Ruled off below
              it rather than above, since it is the odd one out and everything after it is a
              report line. Read-only: the clearing account is a once-per-bank setup choice,
              not a per-document one — see `#/CreditCardOCR/ar-settings`. */}
          {control && (
            <tr className="arv-row-control">
              <td className="jv-num--empty" />
              <Cells dept={control.dept} acc={control.acc} />
              <td className="arv-key" data-label={t('review.jvDesc')}>
                {control.desc}
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

          {groups.map(({ leg, lines, merged }) => {
            const rowClass = !leg.dept || !leg.acc ? 'jv-row--needed' : undefined
            const open = expanded.has(leg.key)
            return [
              <tr key={leg.key} className={rowClass}>
                <td className={merged ? 'arv-c-toggle' : 'jv-num--empty'}>
                  {merged && (
                    <button
                      type="button"
                      className="arv-toggle-btn"
                      aria-expanded={open}
                      aria-label={
                        open
                          ? t('review.arCollapseFolded', { field: leg.key })
                          : t('review.arExpandFolded', {
                              field: leg.key,
                              count: String(lines.length),
                            })
                      }
                      onClick={() => toggleExpanded(leg.key)}
                    >
                      {open ? (
                        <ChevronDown size={14} strokeWidth={2.25} aria-hidden="true" />
                      ) : (
                        <ChevronRight size={14} strokeWidth={2.25} aria-hidden="true" />
                      )}
                    </button>
                  )}
                </td>
                <Cells dept={leg.dept} acc={leg.acc} />
                <td className="arv-key" data-label={t('review.jvDesc')}>
                  <span className="jv-desc-in">
                    {leg.desc}
                    {merged && (
                      <span className="arv-toggle-count">
                        {t('review.arFoldedCount', { count: String(lines.length) })}
                      </span>
                    )}
                  </span>
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
              // Collapsed by default and opened from the toggle above — the merge is
              // checkable without being a wall of quiet rows under every scheme leg before
              // anyone asked to see it.
              ...(merged && expanded.has(leg.key)
                ? lines.map(d => (
                    <tr key={`${leg.key}-${d._uid}`} className="arv-row-src">
                      <td className="jv-num--empty" />
                      <td className="jv-num--empty" />
                      <td className="jv-num--empty" />
                      <td className="arv-src" data-label={t('review.jvDesc')}>
                        {labelOf(d)}
                      </td>
                      <td className="jv-num--empty" />
                      <td className="jv-num--empty" />
                    </tr>
                  ))
                : []),
            ]
          })}

          {/* Printed, worth money, journalised nowhere: nobody has mapped this payment
              type yet. Fixed on `#/CreditCardOCR/ar-settings`, not here — a new payment
              type is exactly the "bank-level setting" this modal stopped editing. */}
          {newTypes.map(({ label }) => (
            <tr key={`new-${label}`} className="jv-row--needed">
              <td className="jv-num--empty" />
              <Cells dept={null} acc={null} />
              <td data-label={t('review.jvDesc')}>
                <span className="jv-desc-in">
                  {label}
                  <span className="arv-note">{t('review.arNewType')}</span>
                </span>
              </td>
              <td className="jv-num--empty" />
              <td className="jv-num--empty" />
            </tr>
          ))}

          {/* Printed at zero: `build_ar_jv_rows` posts nothing for it regardless of
              mapping, so there is nothing here to map — stated, not editable. */}
          {zeroLines.map(d => (
            <tr key={`zero-${d._uid}`} className="arv-row-zero">
              <td className="jv-num--empty" />
              <td className="jv-num--empty" />
              <td className="jv-num--empty" />
              <td data-label={t('review.jvDesc')}>
                {labelOf(d)}
                <span className="arv-note">{t('review.arNotPosted')}</span>
              </td>
              <td className="jv-num--empty" />
              <td className="jv-num--empty" />
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className={`jv-total${imbalanced ? ' jv-total--bad' : ''}`}>
            <td colSpan={4} data-label={t('review.jvDesc')}>
              {imbalanced ? t('review.jvImbalanced') : t('review.jvBalanced')}
            </td>
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
