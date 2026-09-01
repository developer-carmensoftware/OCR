import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { fetchTaxProfiles, type TaxProfileItem } from '../../lib/api/carmen'
import { fmt, parseNum, round2 } from '../../lib/format'
import { normalizeYearToCE } from '../../lib/date'
import { resolveTaxProfileForRate } from '../../lib/apTax'
import { BANK_INFO, OCR_BANK_MAP } from '../../constants/banks'
import type { DetailRow } from './DetailTable'
import type { BankCode } from '../../types/api'

interface Props {
  details: DetailRow[]
  headerData: Record<string, string>
  bank: BankCode | ''
  enabled: boolean
  onEnabledChange: (on: boolean) => void
  onUpdate: (key: string, value: string) => void
}

/**
 * The second document this approval files, and only the fields it does not share.
 *
 * Read against `build_input_tax_payload` field by field. `InvhTInvNo`, `InvhTInvDt` and
 * `InvhDesc` are the JV header's document number, date and description — the same strings,
 * resolved the same way. `BfTaxAmt` and `TaxAmt` are the commission and Input Tax debit
 * rows of the JV standing right above, and `TotalAmt` is their sum. `Source`, `UserModified`
 * and `VnCode` are constants, and `Address` is a fact about the bank nobody can check here.
 *
 * What is left is what this record adds: who it is filed against, which month it lands in,
 * which profile it is filed under, and the branch number — the one document field the JV
 * has no use for.
 *
 * A JV and an input-tax record come out of one statement, and until now the review screen
 * only showed the first. The reviewer was agreeing to both.
 *
 * Collapsed by design, which the review screen otherwise refuses (07-human-in-the-loop #9:
 * collapsing made the reviewer work for the answer). The difference is what is behind it:
 * not part of the decision, but a *preview of a second document* derived from figures
 * already on screen. The summary line carries the answer — will it be filed, for how much,
 * at what rate — so a collapsed panel still answers the question it exists to answer.
 *
 * Read-only except `BranchNo`. The rest is either derived (the period from the document
 * date, the profile from the rate between two figures the JV already shows) or looked up
 * from the bank's registered identity, which is a fact about the bank, not this document.
 *
 * This does NOT post. `approve_document` files the record server-side under the BU's own
 * credential; the wizard's `InputTaxReconciliation` is the one that submits, and reusing
 * it here would put a second submit button on a screen that already has Approve.
 */
export default function InputTaxPanel({
  details,
  headerData,
  bank,
  enabled,
  onEnabledChange,
  onUpdate,
}: Props) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [profiles, setProfiles] = useState<TaxProfileItem[]>([])

  useEffect(() => {
    // Only when someone opens it: the record's figures are on the summary line without it,
    // and most documents are approved without ever expanding this.
    if (!open || profiles.length) return
    fetchTaxProfiles()
      .then(setProfiles)
      .catch(() => {
        // The profile name is a nicety; the rate beside it is computed here and is what
        // the reader actually needs.
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const tax = useMemo(() => {
    // Base is the commission, not the gross: VAT on a settlement statement is charged on
    // the fee. Same two sums `build_input_tax_payload` takes.
    const net = round2(details.reduce((s, d) => s + parseNum(d.CommisAmt), 0))
    const vat = round2(details.reduce((s, d) => s + parseNum(d.TaxAmt), 0))
    const ratio = net > 0 ? round2((vat / net) * 100) : 0
    const code = resolveTaxProfileForRate(ratio, profiles)
    const profile = profiles.find(p => p.code === code)
    const rate = profile?.rate ?? Math.round(ratio)
    return {
      net,
      vat,
      ratio,
      rate,
      profile: profile ? `${profile.code} · ${profile.desc}` : code,
      // We post the profile's canonical rate but claim the document's own VAT figure. If
      // base × rate disagrees with what was extracted, the document is not standard-rated
      // and somebody should look before it is filed.
      rateOff: net > 0 && Math.abs(round2(net * (rate / 100)) - vat) > 0.02,
    }
  }, [details, profiles])

  const vendor = bank ? BANK_INFO[OCR_BANK_MAP[bank]] : undefined
  // Carmen accepts the request and rejects the record afterwards when the vendor has no
  // identity, so it has to be caught here rather than read off a response.
  const identityMissing = !vendor?.taxId || !vendor?.name

  const period = (() => {
    const parts = (headerData.DocDate || '').split('/')
    return parts.length === 3 ? `${parts[1]}/${normalizeYearToCE(parts[2])}` : '—'
  })()

  // Nothing to claim. Not an error and not a choice — the statement charged no VAT.
  const nothingToFile = tax.vat <= 0 || tax.net <= 0

  return (
    <div className="itx">
      <div className="itx-head">
        <label className="itx-check">
          <input
            type="checkbox"
            checked={enabled && !nothingToFile}
            disabled={nothingToFile}
            onChange={e => onEnabledChange(e.target.checked)}
          />
          <span>{t('review.secTaxLabel')}</span>
        </label>

        <span className="itx-sum">
          {nothingToFile
            ? t('review.itxNothing')
            : enabled
              ? t('review.itxSummary', { vat: fmt(tax.vat), rate: String(tax.rate) })
              : t('review.itxOff')}
        </span>

        <button
          type="button"
          className="itx-toggle"
          aria-expanded={open}
          aria-controls="itx-body"
          onClick={() => setOpen(o => !o)}
        >
          <ChevronDown size={14} className={open ? 'itx-chev is-open' : 'itx-chev'} />
          <span>{t(open ? 'review.itxHide' : 'review.itxShow')}</span>
        </button>
      </div>

      {open && (
        <div className="itx-body" id="itx-body">
          {identityMissing && !nothingToFile && (
            <p className="itx-warn">
              <AlertTriangle size={14} aria-hidden="true" />
              {t('review.itxNoIdentity')}
            </p>
          )}
          {tax.rateOff && (
            <p className="itx-warn">
              <AlertTriangle size={14} aria-hidden="true" />
              {t('review.itxRateOff', { ratio: tax.ratio.toFixed(2), rate: String(tax.rate) })}
            </p>
          )}

          <dl className="itx-grid">
            <div className="itx-f itx-f--wide">
              <dt>{t('review.itxVendor')}</dt>
              <dd>
                {vendor?.name || '—'}
                {vendor?.taxId && <span className="text-mono itx-taxid">{vendor.taxId}</span>}
              </dd>
            </div>

            {/* The one field this record takes from the document that the JV does not. */}
            <div className="itx-f">
              <dt>
                <label htmlFor="itx-branch">{t('review.fBranch')}</label>
              </dt>
              <dd>
                <input
                  id="itx-branch"
                  type="text"
                  aria-label={t('review.fBranch')}
                  className="rd-f-input text-mono"
                  value={headerData.BranchNo || ''}
                  onChange={e => onUpdate('BranchNo', e.target.value)}
                />
              </dd>
            </div>

            <div className="itx-f">
              <dt>{t('review.itxPeriod')}</dt>
              <dd className="text-mono">{period}</dd>
            </div>

            <div className="itx-f itx-f--wide">
              <dt>{t('review.itxProfile')}</dt>
              <dd>{tax.profile || '—'}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  )
}
