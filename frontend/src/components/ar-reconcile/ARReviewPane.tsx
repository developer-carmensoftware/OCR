import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Sparkles, Undo2 } from 'lucide-react'
import type { DetailRow } from '../credit-card/DetailTable'
import type { ARPreview, ARPreviewRow } from '../../lib/api/arReconcile'
import { useT } from '../../i18n/LanguageContext'
import { fmt, parseNum } from '../../lib/format'
import CustomSearchSelect from '../common/CustomSearchSelect'
import { useGlMasters } from '../../hooks/mapping/useGlMasters'
import { allowedAccountsForDept, isAccountAllowed } from '../../lib/deptAccounts'
import { suggestPaymentTypes } from '../../lib/api/mapping'
import type { FieldMapping } from '../../types/api'

/**
 * The settlement report's JV, as a reconciliation the reviewer can close from here.
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
 * (`VS INTER UP PREM` + `VS LOCAL UP PREM` → `VS`), and the constituents are one click away
 * beneath the key — the merge is the thing under review, so it stays checkable rather than
 * asserted, but collapsed by default rather than a wall of quiet rows under every leg. The
 * toggle leads the row in its own narrow column, same edge every other row-expand in this
 * app uses (`ExtractionsPage`'s admin table) — Dept and Account are wide pickers here, so a
 * control living inside the Payment type cell after them read as stuck in the row's middle
 * rather than sitting at an edge a reviewer would look for it on.
 *
 * Dept/Account on a mapped leg or a new (unmapped) payment type are editable, same shape
 * as `JvEditor`'s own pickers: `overrides` holds what the reviewer typed, an AI fill runs
 * in the background for anything still missing an account, and Approve
 * (`ReviewDocument.tsx`) saves `overrides` via `patchARMappings` — the AR analogue of
 * `patchAccountingConfig` — before posting, so a correction made here becomes the BU's
 * rule the same way a commission fix does on the credit-card path. What stays read-only is
 * the control leg: the clearing account is a once-per-bank setup choice, not a per-document
 * one, and lives only on `#/CreditCardOCR/ar-settings`.
 */

interface Props {
  /** The JV the server will post. `null` when this bank has no AR configuration. */
  jv: ARPreview | null
  /** The lines the document actually prints, so the grouping can be checked against them. */
  details: DetailRow[]
  bankCode: string
  /** Corrections the reviewer has made but not yet saved, keyed by leg key or (for a new
   *  type) the exact printed label. */
  overrides: Record<string, FieldMapping>
  onOverride: (code: string, mapping: FieldMapping, byUser?: boolean) => void
  onUndo: (code: string) => void
  guessedKeys: string[]
  /** Payment types with money attached and still no account, after `overrides` — live,
   *  unlike `jv.unmapped` which is only as fresh as the last document fetch. */
  onState: (state: { unmapped: string[] }) => void
}

/** The label the server grouped under, normalised the way `group_key` receives it. */
const labelOf = (d: DetailRow) => (d.Transaction || '').trim() || 'UNKNOWN'

export default function ARReviewPane({
  jv,
  details,
  bankCode,
  overrides,
  onOverride,
  onUndo,
  guessedKeys,
  onState,
}: Props) {
  const { t } = useT()
  const { accounts, departments } = useGlMasters()
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

  const { control, groups, newTypes, zeroLines } = useMemo(() => {
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
    // mapped yet. Grouped by exact label so two lines sharing one unmapped label ask the
    // reviewer once, not twice — the same "one picker per rule" `JvEditor` follows. A
    // zero-amount line (`build_ar_jv_rows` posts nothing for it) has nothing to map.
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
    }
  }, [jv, details])

  // The dept/acc a row shows: the reviewer's correction if there is one, else what the
  // server sent (empty for a brand-new type, which has no server-side leg yet).
  const effective = useCallback(
    (code: string, dept?: string | null, acc?: string | null): FieldMapping =>
      overrides[code] ?? { dept: dept || '', acc: acc || '' },
    [overrides]
  )

  const unmapped = useMemo(() => {
    const out: string[] = []
    for (const { leg } of groups) {
      const e = effective(leg.key, leg.dept, leg.acc)
      if (!e.dept || !e.acc) out.push(leg.key)
    }
    for (const { label } of newTypes) {
      const e = effective(label)
      if (!e.dept || !e.acc) out.push(label)
    }
    return out
  }, [groups, newTypes, effective])

  useEffect(() => {
    onState({ unmapped })
    // `unmapped` is rebuilt every render; the joined string is what actually changes, and
    // gating on it is what stops an update loop through the parent (same trick JvEditor's
    // own `onState` effect uses).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onState, unmapped.join('|')])

  // ── AI fill for a payment type nothing has mapped yet ───────────────────────
  const asked = useRef(new Set<string>())
  useEffect(() => {
    if (!accounts.length) return
    const targets = unmapped.filter(k => !asked.current.has(k))
    if (!targets.length) return
    targets.forEach(k => asked.current.add(k))
    let alive = true
    void suggestPaymentTypes({
      payment_types: targets,
      accounts: accounts.map(a => ({ code: a.code, name: a.name })),
      departments: departments.map(d => ({
        code: d.code,
        name: d.name,
        allowed_accounts: d.allowedAccounts || [],
      })),
      bank_code: bankCode,
    })
      .then(res => {
        if (!alive) return
        for (const [key, m] of Object.entries(res)) {
          if (m?.dept && m?.acc) onOverride(key, { dept: m.dept, acc: m.acc }, false)
        }
      })
      .catch(() => {
        // Silent: the row already shows an empty picker asking to be filled.
      })
    return () => {
      alive = false
    }
    // `unmapped` is rebuilt every render; the joined string is what actually changes —
    // same trick the effect above uses, and for the same reason (JvEditor's own
    // background-fill effect keys on `missingNow` the same way).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unmapped.join('|'), accounts, departments, bankCode, onOverride])

  const change = useCallback(
    (
      code: string,
      field: 'dept' | 'acc',
      value: string,
      curDept?: string | null,
      curAcc?: string | null
    ) => {
      const cur = effective(code, curDept, curAcc)
      const next: FieldMapping =
        field === 'dept'
          ? {
              dept: value,
              acc: isAccountAllowed(value, cur.acc, departments) ? cur.acc || '' : '',
            }
          : { dept: cur.dept || '', acc: value }
      onOverride(code, next)
    },
    [effective, departments, onOverride]
  )

  if (!jv) {
    return (
      <div className="arv arv-empty" role="status">
        {t('review.arNotConfigured')}
      </div>
    )
  }

  const summary = jv.post_type === 'Summary'
  const imbalanced = !jv.balanced

  /** One Dept + Account picker pair, shared by leg rows and new-type rows. */
  function Pickers({
    code,
    dept,
    acc,
  }: {
    code: string
    dept?: string | null
    acc?: string | null
  }) {
    const e = effective(code, dept, acc)
    const accOptions = allowedAccountsForDept(e.dept, departments, accounts)
    const filtered = accOptions.length < accounts.length
    const needed = !e.dept || !e.acc
    return (
      <>
        <td data-label={t('review.jvDept')}>
          <CustomSearchSelect
            value={e.dept || null}
            onChange={v => change(code, 'dept', v, dept, acc)}
            options={departments}
            placeholder={t('review.jvDeptPlaceholder')}
            hasError={!e.dept}
            aria-label={t('review.jvDeptFor', { field: code })}
          />
        </td>
        <td data-label={t('review.jvAccount')}>
          <CustomSearchSelect
            value={e.acc || null}
            onChange={v => change(code, 'acc', v, dept, acc)}
            options={accOptions}
            notice={
              filtered
                ? t('review.jvDeptFilter', { count: String(accOptions.length), dept: e.dept || '' })
                : undefined
            }
            placeholder={t('review.jvAccountPlaceholder')}
            hasError={needed}
            aria-label={t('review.jvAccountFor', { field: code })}
          />
        </td>
      </>
    )
  }

  /** The AI-guessed badge and Undo button, next to a row's payment-type label — this
   *  table has no description cell to host them in, so the label cell is the closest. */
  function Tags({ code }: { code: string }) {
    const guessed = guessedKeys.includes(code)
    const changed = code in overrides && !guessed
    return (
      <>
        {guessed && (
          <span className="jv-tag jv-tag--ai" title={t('review.jvGuessedHint')}>
            <Sparkles size={11} strokeWidth={2.25} aria-hidden="true" />
            {t('review.jvGuessed')}
          </span>
        )}
        {changed && (
          <button type="button" className="jv-tag jv-tag--undo" onClick={() => onUndo(code)}>
            <Undo2 size={11} strokeWidth={2.25} aria-hidden="true" />
            {t('review.jvUndo')}
          </button>
        )}
      </>
    )
  }

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
            <th scope="col" className="arv-c-toggle">
              <span className="sr-only">{t('review.arExpandCol')}</span>
            </th>
            <th scope="col" className="arv-c-dept">
              {t('review.jvDept')}
            </th>
            <th scope="col" className="arv-c-acc">
              {t('review.jvAccount')}
            </th>
            <th scope="col">{t('review.arColPaymentType')}</th>
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
              <td className="arv-key" data-label={t('review.arColPaymentType')}>
                {t('review.arControlLeg')}
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
            const e = effective(leg.key, leg.dept, leg.acc)
            const rowClass =
              !e.dept || !e.acc
                ? 'jv-row--needed'
                : leg.key in overrides && !guessedKeys.includes(leg.key)
                  ? 'jv-row--changed'
                  : undefined
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
                <Pickers code={leg.key} dept={leg.dept} acc={leg.acc} />
                <td className="arv-key" data-label={t('review.arColPaymentType')}>
                  <span className="jv-desc-in">
                    {leg.key}
                    {merged && (
                      <span className="arv-toggle-count">
                        {t('review.arFoldedCount', { count: String(lines.length) })}
                      </span>
                    )}
                    <Tags code={leg.key} />
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
                      <td className="arv-src" data-label={t('review.arColPaymentType')}>
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
              type yet. Editable for the same reason a mapped leg is — filling it in here
              is what lets this document post without a trip to the settings page. */}
          {newTypes.map(({ label }) => (
            <tr
              key={`new-${label}`}
              className={
                !effective(label).dept || !effective(label).acc
                  ? 'jv-row--needed'
                  : label in overrides && !guessedKeys.includes(label)
                    ? 'jv-row--changed'
                    : undefined
              }
            >
              <td className="jv-num--empty" />
              <Pickers code={label} />
              <td data-label={t('review.arColPaymentType')}>
                <span className="jv-desc-in">
                  {label}
                  <span className="arv-note">{t('review.arNewType')}</span>
                  <Tags code={label} />
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
              <td data-label={t('review.arColPaymentType')}>
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
