import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import CustomSearchSelect from '../common/CustomSearchSelect'
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
  /** Whether this record would be refused if Approve were pressed now. Reported up rather
   *  than acted on here: the button belongs to the review screen, and the JV has its own
   *  reasons to be unpostable. Mirrors `JvEditor`'s `onState`. */
  onBlocked: (blocked: boolean) => void
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
 * already on screen. The tick box is the outcome — a ticked box files the record — so a
 * collapsed panel still answers the one question it exists to answer.
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
  onBlocked,
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
      // `TotalAmt`, and derived here rather than read off a payload that does not exist yet
      // — `build_input_tax_payload` computes the same `net + tax` server-side.
      total: round2(net + vat),
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
  //
  // Trimmed, because a field of spaces is the empty field Carmen rejects for — untrimmed,
  // one space in either box cleared this warning and unblocked Approve on a record that
  // would then be thrown away silently. `build_input_tax_payload` trims for the same reason.
  const identityMissing = !vendor.taxId.trim() || !vendor.name.trim()

  // Not a field, and now not in the body either. The month the claim is filed in is a fact
  // about the statement — a claim filed in a month the document does not name is exactly
  // the wrong-month error `build_input_tax_payload` refuses to make, and a misread date is
  // corrected on the document date above. Being the one read-only thing among four fields
  // made it look like a field that would not take a value, so it moved up to the summary
  // line, which is where this panel's other facts already live.
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

  // A record with half an identity is one Carmen accepts and then rejects silently, so it
  // is stopped before it is sent. The wizard's own Submit has blocked on this same pair
  // since that incident (InputTaxReconciliation.tsx); the review screen showed the warning
  // and posted anyway. Only while the record will actually be filed — unticking the box is
  // a real answer, and a document with no VAT was never a problem.
  const blocked = enabled && !nothingToFile && identityMissing
  useEffect(() => {
    onBlocked(blocked)
  }, [onBlocked, blocked])

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

          {/* **One grid, two rows, four columns that both rows share.**
              This panel is read, not filled in: it is the whole of the second document an
              approval files, and the reviewer's job is to take it in. So the eight things
              stand in four columns that span the panel — identity over the figures it
              produces — and every label shares a left edge with the one above it.
              What stood here was two rows sized to their own contents: fields packed left,
              ending 25rem short of the right edge, and the record line anchored at both
              edges beneath them. Balanced edges, hollow middle, and the eye had to jump
              three times to read four numbers. Filling the columns costs nothing here (a
              wider box holds the same value) and removes every jump.
              Vendor, Tax ID and Branch are one thing — the vendor's identity — so they run
              together, and the profile, which is a filing choice rather than a fact about
              the bank, comes last and sits above the total its rate produced.
              Each cell is still the dialog's own `.rd-f`, so a field here and a field in the
              document header are the same object; only the track sizing lives on the grid. */}
          <div className="itx-grid">
            {/* The bank's registered identity, which is a fact about the bank — until the
                registry has none, or has one Carmen disagrees with. Then it is two fields
                and a reviewer who can read the tax invoice in front of them. */}
            <div className="rd-f">
              <label className="rd-f-label" htmlFor="itx-vendor">
                {t('review.itxVendor')}
              </label>
              <input
                id="itx-vendor"
                type="text"
                className="rd-f-input"
                placeholder={t('review.itxVendorHint')}
                value={vendor.name}
                onChange={e => onOverride({ vendor_name: e.target.value })}
              />
            </div>

            {/* Its own label rather than a placeholder: a placeholder names a field only
                while it is empty, and this one is the reason Carmen refuses a record. */}
            <div className="rd-f">
              <label className="rd-f-label" htmlFor="itx-taxid">
                {t('review.itxTaxId')}
              </label>
              <input
                id="itx-taxid"
                type="text"
                inputMode="numeric"
                className="rd-f-input text-mono"
                value={vendor.taxId}
                onChange={e => onOverride({ tax_id: e.target.value })}
              />
            </div>

            {/* The one field this record takes from the document that the JV does not, and
                the third part of the vendor's identity — so it stands with the two above
                rather than after the filing choice that follows. */}
            <div className="rd-f">
              <label className="rd-f-label" htmlFor="itx-branch">
                {t('review.fBranch')}
              </label>
              {/* The value that will file when the document names no branch, shown rather
                  than left blank: this panel is a preview of a second document, and an
                  empty box would be a wrong answer about what posts. A placeholder and
                  not a written value — the reviewer types over it, and nothing claims
                  the statement said "00000" when it did not. */}
              <input
                id="itx-branch"
                type="text"
                aria-label={t('review.fBranch')}
                className="rd-f-input text-mono itx-branch"
                placeholder="00000"
                value={headerData.BranchNo || ''}
                onChange={e => onUpdate('BranchNo', e.target.value)}
              />
            </div>

            {/* Carmen's own list, through the same picker every other chosen value on this
                dialog uses — a native `<select>` here was the one control that could not
                take the screen's field treatment and rendered as the browser's own widget
                beside three flat boxes.
                The closed state shows the code alone; the description still names each
                option in the open list and on hover. Naming a profile is the reviewer's to
                do — its rate and wording are read back from Carmen's list server-side,
                never from here.
                A `<span>` label and not a `<label>`: the picker renders its own input and
                has no id to point at, so it is named by `aria-label` the way the JV row's
                two pickers are. */}
            <div className="rd-f">
              <span className="rd-f-label">{t('review.itxProfile')}</span>
              <CustomSearchSelect
                value={tax.code || null}
                onChange={code => onOverride({ profile_code: code })}
                options={profileOptions.map(p => ({ code: p.code, name: p.desc }))}
                placeholder={t('review.itxProfile')}
                aria-label={t('review.itxProfile')}
              />
            </div>
            {/* The rule that says the row below is read rather than typed into. Spans every
                track, so it also draws the grid the two rows share. */}
            <div className="itx-rule" />

            {/* Everything the record says that nobody types: **six values, two rows of
                three, on one set of column edges.**

                Its own grid rather than the four field tracks above. Six cells in four
                tracks is what made this read as scatter — the first row ended one column
                short, the second began one column late, and each figure sat under a
                different edge from the identity above it. Three tracks put the document it
                is filed against directly over what it claims, which is the pairing a
                reviewer is actually checking.

                What the two rows are: `InvhTInvNo` / `InvhTInvDt` / the period the claim
                lands in, then `BfTaxAmt` / `TaxAmt` / `TotalAmt` under Carmen's own column
                headings — which is what settles `Tax` over `VAT` for the middle one. The
                reviewer checks that figure against the ERP they are posting to, and a
                screen that renames it makes them do the matching. All three, not the tax
                alone; `989.87` says nothing about whether 989.87 is right, while the three
                together are the record's whole arithmetic.

                **None of the six is a field, and none looks like one.** The amounts are
                sums over `details` — the lines `buildJvRows` builds the journal from and
                `applyJvAmount` writes every JV amount edit back into — so they follow the
                journal above and cannot be typed into here; a VAT record disagreeing with
                the journal filed beside it is the one outcome worse than no record. The
                other three are the same kind of thing: the document number and date the JV
                header carries, and the month they name. Each is corrected by fixing the
                field it comes from, two panels up. `.itx-fact` is built as `.rd-f` is, so
                the wash is what tells a value from a field — the rule this screen already
                runs on. */}
            <div className="itx-facts">
              <span className="itx-fact">
                <span className="rd-f-label">{t('review.itxTInvNo')}</span>
                <span className="itx-fact-v text-mono">{headerData.DocNo || '—'}</span>
              </span>
              <span className="itx-fact">
                <span className="rd-f-label">{t('review.itxTInvDt')}</span>
                <span className="itx-fact-v text-mono">{headerData.DocDate || '—'}</span>
              </span>
              <span className="itx-fact">
                <span className="rd-f-label">{t('review.itxPeriod')}</span>
                <span className="itx-fact-v text-mono">{period}</span>
              </span>

              {/* Right-aligned, as `.jv-num` right-aligns every figure on this screen, so
                  the three end on one edge and read as a sum rather than as three separate
                  numbers. */}
              <span className="itx-fact itx-fact--amt">
                <span className="rd-f-label">{t('review.itxNet')}</span>
                <span className="itx-fact-v text-mono">{fmt(tax.net)}</span>
              </span>
              <span className="itx-fact itx-fact--amt">
                <span className="rd-f-label">{t('review.itxTax')}</span>
                <span className="itx-fact-v text-mono">{fmt(tax.vat)}</span>
              </span>
              {/* The record's headline figure, and the only one carrying weight — two
                  dimensions of hierarchy where three amounts would otherwise read flat. */}
              <span className="itx-fact itx-fact--amt itx-fact--total">
                <span className="rd-f-label">{t('review.itxTotal')}</span>
                <span className="itx-fact-v text-mono">{fmt(tax.total)}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
