import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Loader2, Sparkles, Undo2 } from 'lucide-react'
import CustomSearchSelect from '../common/CustomSearchSelect'
import NumericInput from '../common/NumericInput'
import { useT } from '../../i18n/LanguageContext'
import { fmt, parseNum, round2 } from '../../lib/format'
import { buildJvRows, type JvRow } from '../../lib/ccJv'
import { allowedAccountsForDept, isAccountAllowed } from '../../lib/deptAccounts'
import { GROUP_DEBIT_BY_TRANSACTION } from '../../constants/banks'
import { useGlMasters } from '../../hooks/mapping/useGlMasters'
import { suggestPaymentTypes } from '../../lib/api/mapping'
import type { DetailRow } from './DetailTable'
import type { FieldMapping } from '../../types/api'

/** A correction the reviewer has made but not yet approved. Keyed by config field type. */
export type Overrides = Record<string, FieldMapping>

/** Which of the three things is stopping the post. The review screen says it at the
 *  button; a disabled Approve with no sentence beside it makes the reviewer hunt the
 *  dialog for a tinted row. */
export type BlockReason = 'empty' | 'account' | 'unbalanced'

export interface JvState {
  rows: JvRow[]
  /** Cannot post: no rows at all, or a JV that would not balance, or a blank account on a
   *  row carrying money. Each would be refused by Carmen, slower and less clearly. */
  blocked: boolean
  reason: BlockReason | null
  totalDr: number
  totalCr: number
}

interface Props {
  details: DetailRow[]
  /** The BU's stored config, as loaded. Never mutated — corrections live in `overrides`. */
  config: Record<string, unknown> | null
  configLoading: boolean
  overrides: Overrides
  /** `byUser` false marks the background AI fill below, which the review screen does not
   *  count as unsaved work of the reviewer's. */
  onOverride: (key: string, mapping: FieldMapping, byUser?: boolean) => void
  onUndo: (key: string) => void
  /** Field types the AI chose during ingest (`mapping_guessed`), and ones it could not
   *  fill at all (`unmapped`). The first asks to be checked, the second to be filled. */
  guessedKeys: string[]
  unmappedKeys: string[]
  /** An amount typed on a leg, written back into the detail lines it was summed from. */
  onAmount: (row: JvRow, next: number) => void
  onState: (state: JvState) => void
  bankCode?: string
}

/**
 * The JV as it will post, with every GL rule editable in place.
 *
 * Not a variant of `AccountingReview`. That component is the wizard's data-entry step and
 * owns a Back/Submit/mapping-page footer; this one is a verification surface whose footer
 * belongs to the review screen. The split follows the precedent `HeaderCard` and
 * `ReviewDocCard` already set — one component doing both jobs is what made the review
 * screen read like a form to fill in. The arithmetic is not duplicated: both call
 * `buildJvRows`.
 *
 * **A picker edits a rule, not a row.** `JvRow.key` is the accounting-config entry that
 * produced the row, and two detail lines of one payment type produce two rows sharing a
 * key. Changing either changes both, visibly, because that is what will actually be saved.
 */
export default function JvEditor({
  details,
  config,
  configLoading,
  overrides,
  onOverride,
  onUndo,
  guessedKeys,
  unmappedKeys,
  onAmount,
  onState,
  bankCode,
}: Props) {
  const { t } = useT()
  const { accounts, departments, loading: mastersLoading } = useGlMasters()

  // The config the JV is actually built from: stored, with the reviewer's corrections on
  // top. `mappings` and `paymentAmount` are separate buckets in the stored shape but one
  // namespace in `buildJvRows`, so an override lands in whichever the key belongs to.
  const effective = useMemo(() => {
    if (!config) return null
    const mappings = { ...((config.mappings || {}) as Record<string, FieldMapping>) }
    const paymentAmount = { ...((config.paymentAmount || {}) as Record<string, FieldMapping>) }
    for (const [key, value] of Object.entries(overrides)) {
      if (key in mappings || ['commission', 'tax', 'net'].includes(key)) mappings[key] = value
      else paymentAmount[key] = value
    }
    return { ...config, mappings, paymentAmount }
  }, [config, overrides])

  const rows = useMemo(
    () =>
      effective
        ? buildJvRows(details, effective, { consolidateDebit: !GROUP_DEBIT_BY_TRANSACTION })
        : [],
    [details, effective]
  )

  const totalDr = round2(rows.reduce((s, r) => s + r.debit, 0))
  const totalCr = round2(rows.reduce((s, r) => s + r.credit, 0))
  const imbalanced = Math.abs(totalDr - totalCr) > 0.01
  // A row carrying money with no account posts a GL line Carmen cannot file. Zero-amount
  // legs are display-only (a gateway invoice's 0.00 net) and are dropped before posting,
  // so an empty account on one is not a problem.
  const blankAccount = rows.some(r => (r.debit || r.credit) && !r.acc)
  // Account before balance: a blank picker is one click from fixed and is the usual
  // cause, while an imbalance is often the same problem seen from the other end.
  const reason: BlockReason | null = !rows.length
    ? 'empty'
    : blankAccount
      ? 'account'
      : imbalanced
        ? 'unbalanced'
        : null
  const blocked = reason !== null

  const loading = configLoading || mastersLoading

  useEffect(() => {
    // No reason while the masters are still arriving: there are no rows yet, and "there
    // is nothing to post" is a true sentence about an empty table that would flash under
    // the Approve button on every open.
    onState({ rows, blocked, reason: loading ? null : reason, totalDr, totalCr })
    // `rows` is rebuilt every render; the primitives below are what actually change, and
    // gating on them is what stops an update loop through the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onState, blocked, reason, loading, rows.length, totalDr, totalCr, JSON.stringify(overrides)])

  // ── AI fill for a payment type the reviewer just introduced ────────────────
  //
  // Not fired on open: ingest already suggested for everything that arrived, so the only
  // gap here is one the reviewer created by editing a Transaction cell. Fired once per
  // type, because a second identical answer costs the same as the first.
  const asked = useRef(new Set<string>())
  const missingNow = useMemo(
    () => [...new Set(rows.filter(r => (r.debit || r.credit) && !r.acc).map(r => r.key))],
    [rows]
  )

  useEffect(() => {
    if (loading || !accounts.length) return
    const fresh = missingNow.filter(k => !asked.current.has(k))
    if (!fresh.length) return
    fresh.forEach(k => asked.current.add(k))
    let alive = true
    void suggestPaymentTypes({
      payment_types: fresh,
      accounts: accounts.map(a => ({ code: a.code, name: a.name })),
      departments: departments.map(d => ({
        code: d.code,
        name: d.name,
        allowed_accounts: d.allowedAccounts || [],
      })),
      bank_code: bankCode || '',
    })
      .then(res => {
        if (!alive) return
        for (const [key, m] of Object.entries(res)) {
          if (m?.dept && m?.acc) onOverride(key, { dept: m.dept, acc: m.acc }, false)
        }
      })
      .catch(() => {
        // Silent: the row already shows an empty picker asking to be filled, and a toast
        // about a background guess failing is noise the reviewer cannot act on.
      })
    return () => {
      alive = false
    }
  }, [missingNow, loading, accounts, departments, bankCode, onOverride])

  const change = useCallback(
    (key: string, field: 'dept' | 'acc', value: string) => {
      const current = rows.find(r => r.key === key)
      const next: FieldMapping =
        field === 'dept'
          ? // Changing department can invalidate the account under it. Drop it rather than
            // keep an illegal pair the server would refuse on save.
            {
              dept: value,
              acc: isAccountAllowed(value, current?.acc, departments) ? current?.acc || '' : '',
            }
          : { dept: current?.dept || '', acc: value }
      onOverride(key, next)
    },
    [rows, departments, onOverride]
  )

  if (loading) {
    return (
      <div className="jv-loading">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        <span>{t('review.jvLoading')}</span>
      </div>
    )
  }

  if (!config) {
    return <p className="jv-empty">{t('review.jvNoConfig')}</p>
  }

  // One picker per rule, not per row: rows sharing a key render the same value and the
  // first of them owns the controls, so the reviewer is never asked the same question
  // twice about one rule.
  const seen = new Set<string>()

  return (
    <div className="jv">
      <table className="jv-table">
        <thead>
          <tr>
            <th scope="col" className="jv-c-dept">
              {t('review.jvDept')}
            </th>
            <th scope="col" className="jv-c-acc">
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
          {rows.map((row, i) => {
            const first = !seen.has(row.key)
            seen.add(row.key)
            const changed = row.key in overrides
            const guessed = !changed && guessedKeys.includes(row.key)
            const needed =
              unmappedKeys.includes(row.key) || (!row.acc && !!(row.debit || row.credit))
            const accOptions = allowedAccountsForDept(row.dept, departments, accounts)
            const filtered = accOptions.length < accounts.length

            return (
              <tr
                key={`${row.key}-${i}`}
                className={`jv-row${changed ? ' jv-row--changed' : ''}${needed ? ' jv-row--needed' : ''}`}
              >
                {/* `data-label` is what the cell wears as its own name once the table
                    stacks on a phone — the same one markup path the queue's table uses,
                    no duplicate DOM. */}
                <td data-label={t('review.jvDept')}>
                  {first ? (
                    <CustomSearchSelect
                      value={row.dept || null}
                      onChange={v => change(row.key, 'dept', v)}
                      options={departments}
                      placeholder={t('review.jvDeptPlaceholder')}
                      hasError={!row.dept && !!(row.debit || row.credit)}
                      aria-label={t('review.jvDeptFor', { field: row.desc })}
                    />
                  ) : (
                    <span className="jv-echo text-mono">{row.dept || '—'}</span>
                  )}
                </td>
                <td data-label={t('review.jvAccount')}>
                  {first ? (
                    <CustomSearchSelect
                      value={row.acc || null}
                      onChange={v => change(row.key, 'acc', v)}
                      options={accOptions}
                      notice={
                        filtered
                          ? t('review.jvDeptFilter', {
                              count: String(accOptions.length),
                              dept: row.dept,
                            })
                          : undefined
                      }
                      placeholder={t('review.jvAccountPlaceholder')}
                      hasError={needed}
                      aria-label={t('review.jvAccountFor', { field: row.desc })}
                    />
                  ) : (
                    <span className="jv-echo text-mono">{row.acc || '—'}</span>
                  )}
                </td>
                <td className="jv-desc">
                  <span title={row.desc}>{row.desc}</span>
                  {/* The only thing on this pane asking to be checked: everything else
                      came from a rule a person set. */}
                  {first && guessed && (
                    <span className="jv-tag jv-tag--ai" title={t('review.jvGuessedHint')}>
                      <Sparkles size={11} strokeWidth={2.25} aria-hidden="true" />
                      {t('review.jvGuessed')}
                    </span>
                  )}
                  {first && changed && (
                    <button
                      type="button"
                      className="jv-tag jv-tag--undo"
                      onClick={() => onUndo(row.key)}
                    >
                      <Undo2 size={11} strokeWidth={2.25} aria-hidden="true" />
                      {t('review.jvUndo')}
                    </button>
                  )}
                </td>
                <Amount row={row} side="debit" onAmount={onAmount} />
                <Amount row={row} side="credit" onAmount={onAmount} />
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className={`jv-total${imbalanced ? ' jv-total--bad' : ''}`}>
            <td colSpan={3}>{imbalanced ? t('review.jvImbalanced') : t('review.jvBalanced')}</td>
            <td className="jv-num text-mono" data-label={t('review.jvDebit')}>
              {fmt(totalDr)}
            </td>
            <td className="jv-num text-mono" data-label={t('review.jvCredit')}>
              {fmt(totalCr)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * One amount cell. Editable on the side the leg actually carries; the other side of a JV
 * row is structurally empty, and an input there would invite someone to make the journal
 * one-sided.
 *
 * A leg summed from more than one line is marked, because typing into it changes all of
 * them — see `applyJvAmount` for how the figure is shared out.
 */
function Amount({
  row,
  side,
  onAmount,
}: {
  row: JvRow
  side: 'debit' | 'credit'
  onAmount: (row: JvRow, next: number) => void
}) {
  const { t } = useT()
  const value = row[side]
  const other = row[side === 'debit' ? 'credit' : 'debit']
  const label = t(side === 'debit' ? 'review.jvDebit' : 'review.jvCredit')
  // A leg with nothing on either side is the display-only zero (a gateway invoice's net);
  // it is dropped before posting, so it is not a figure to type into.
  if (!value && other) return <td className="jv-num jv-num--empty">—</td>

  const shared = row.lines.length > 1
  return (
    <td className="jv-num" data-label={label}>
      <NumericInput
        className="jv-amt text-mono"
        // Two lines of one payment type produce two legs with the same description, so
        // the line number is part of the name — otherwise the second is unreachable by
        // anything that finds a control by its label, screen readers included. A summed
        // leg spans every line and has no number to give.
        aria-label={t(side === 'debit' ? 'review.jvDebitFor' : 'review.jvCreditFor', {
          field: shared
            ? row.desc
            : t('review.jvLineOf', { field: row.desc, line: String(row.lines[0] + 1) }),
        })}
        title={shared ? t('review.jvSharedHint', { count: String(row.lines.length) }) : undefined}
        data-shared={shared || undefined}
        value={fmt(value)}
        onChange={v => onAmount(row, parseNum(v))}
      />
    </td>
  )
}
