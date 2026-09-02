import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import { fetchTaxProfiles, type TaxProfileItem } from '../../lib/api/carmen'
import type { ItxOverrides } from '../../lib/api/emailReview'
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
  overrides: ItxOverrides
  onOverride: (patch: ItxOverrides) => void
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
 * **Vendor, tax ID, tax profile and branch are fields; the period and the amounts are
 * not.** The line between them is not "derived or not" — the vendor and the profile are
 * derived too, and each field starts at what the machine chose. It is whether a reviewer
 * looking at this statement can know better. A registry entry that is missing or stale
 * and a rate no profile declares are dead ends for the machine (both used to skip the
 * record entirely, behind a warning nobody could act on) and one field for a human. The
 * period and the amounts are not judgements: the period is the month the document names,
 * corrected by fixing the document date two fields up, and the amounts are the JV's — a
 * VAT record disagreeing with the journal it is filed beside is the one outcome worse
 * than no record.
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
  overrides,
  onOverride,
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
    // A profile the reviewer named answers the question the rate lookup asks, so it wins
    // — including when the lookup found nothing, which is the case they picked it for.
    const code = overrides.profile_code || resolveTaxProfileForRate(ratio, profiles)
    const profile = profiles.find(p => p.code === code)
    const rate = profile?.rate ?? Math.round(ratio)
    return {
      net,
      vat,
      ratio,
      rate,
      code,
      // We post the profile's canonical rate but claim the document's own VAT figure. If
      // base × rate disagrees with what was extracted, the document is not standard-rated
      // and somebody should look before it is filed.
      rateOff: net > 0 && Math.abs(round2(net * (rate / 100)) - vat) > 0.02,
    }
  }, [details, profiles, overrides.profile_code])

  const registered = bank ? BANK_INFO[OCR_BANK_MAP[bank]] : undefined
  const vendor = {
    name: overrides.vendor_name ?? registered?.name ?? '',
    taxId: overrides.tax_id ?? registered?.taxId ?? '',
  }
  // Carmen accepts the request and rejects the record afterwards when the vendor has no
  // identity, so it has to be caught here rather than read off a response. Measured on
  // what will post, so typing the missing half clears the warning.
  const identityMissing = !vendor.taxId || !vendor.name

  // Not a field. The month the claim is filed in is a fact about the statement, and a
  // claim filed in a month the document does not name is exactly the wrong-month error
  // `build_input_tax_payload` refuses to make — a misread date is corrected on the
  // document date above, and this follows it.
  const period = (() => {
    const parts = (headerData.DocDate || '').split('/')
    return parts.length === 3 ? `${parts[1]}/${normalizeYearToCE(parts[2])}` : '—'
  })()
  // The list, plus whatever is selected if the fetch has not landed or does not carry it —
  // a select whose own value is not among its options renders blank.
  const profileOptions =
    tax.code && !profiles.some(p => p.code === tax.code)
      ? [{ code: tax.code, desc: '' }, ...profiles]
      : profiles

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

          {/* Two lines, not a grid. Four short facts in a `repeat(auto-fit, minmax(11rem))`
              with two span-2 cells wrapped into a tall ragged block for no gain — these
              read as a sentence, so they are laid out as one. */}
          {/* The bank's registered identity, which is a fact about the bank — until the
              registry has none, or has one Carmen disagrees with. Then it is two fields
              and a reviewer who can read the tax invoice in front of them. */}
          {/* Each label and the field it names are one `.itx-f` unit, so a wrap can only
              fall between fields — never between a label and the box it belongs to, which
              is what turned these two lines into five ragged ones. */}
          <p className="itx-line">
            <span className="itx-f">
              <label className="itx-k" htmlFor="itx-vendor">
                {t('review.itxVendor')}
              </label>
              <input
                id="itx-vendor"
                type="text"
                className="rd-f-input itx-vendor"
                placeholder={t('review.itxVendorHint')}
                value={vendor.name}
                onChange={e => onOverride({ vendor_name: e.target.value })}
              />
            </span>
            <span className="itx-sep" aria-hidden="true">
              ·
            </span>
            {/* Its own label rather than a placeholder: a placeholder names a field only
                while it is empty, and this one is the reason Carmen refuses a record. */}
            <span className="itx-f">
              <label className="itx-k" htmlFor="itx-taxid">
                {t('review.itxTaxId')}
              </label>
              <input
                id="itx-taxid"
                type="text"
                inputMode="numeric"
                className="rd-f-input text-mono itx-taxid"
                value={vendor.taxId}
                onChange={e => onOverride({ tax_id: e.target.value })}
              />
            </span>
          </p>

          <p className="itx-line">
            <span className="itx-f">
              <span className="itx-k">{t('review.itxPeriod')}</span>
              <span className="itx-v text-mono">{period}</span>
            </span>
            <span className="itx-sep" aria-hidden="true">
              ·
            </span>
            {/* Carmen's own list. Naming a profile is the reviewer's to do; its rate and
                wording are read back from that list server-side, never from here. */}
            <span className="itx-f">
              <label className="itx-k" htmlFor="itx-profile">
                {t('review.itxProfile')}
              </label>
              <select
                id="itx-profile"
                className="rd-f-input itx-profile"
                value={tax.code}
                onChange={e => onOverride({ profile_code: e.target.value })}
              >
                {!tax.code && <option value="">—</option>}
                {profileOptions.map(p => (
                  <option key={p.code} value={p.code}>
                    {p.desc ? `${p.code} · ${p.desc}` : p.code}
                  </option>
                ))}
              </select>
            </span>
            <span className="itx-sep" aria-hidden="true">
              ·
            </span>
            {/* The one field this record takes from the document that the JV does not. */}
            <span className="itx-f">
              <label className="itx-k" htmlFor="itx-branch">
                {t('review.fBranch')}
              </label>
              <input
                id="itx-branch"
                type="text"
                aria-label={t('review.fBranch')}
                className="rd-f-input text-mono itx-branch"
                value={headerData.BranchNo || ''}
                onChange={e => onUpdate('BranchNo', e.target.value)}
              />
            </span>
          </p>
        </div>
      )}
    </div>
  )
}
