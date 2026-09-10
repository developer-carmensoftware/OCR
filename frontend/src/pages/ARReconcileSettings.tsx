import { useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, CircleDot, Loader2, Scale } from 'lucide-react'
import '../styles/pages/ar-reconcile.css'
import ARJvPreview from '../components/ar-reconcile/ARJvPreview'
import ARMappingTable from '../components/ar-reconcile/ARMappingTable'
import CustomModal from '../components/common/CustomModal'
import CustomSearchSelect from '../components/common/CustomSearchSelect'
import SwapLabel from '../components/common/SwapLabel'
import Switch from '../components/admin/ui/Switch'
import { useARReconcile } from '../hooks/ar-reconcile'
import { POST_TYPES } from '../lib/api/arReconcile'
import { BANKS } from '../constants/banks'
import { allowedAccountsForDept } from '../lib/deptAccounts'

/**
 * Detailed Credit Card AR Reconciliation — per-bank settings.
 *
 * Single-column `.section` stack, matching Mapping.tsx, which is this screen's sibling:
 * the FRD mockup put the mapping table in a right-hand panel, but the same table gets
 * more width here and the save button, the status line and the pickers stay the ones the
 * rest of the app uses.
 */

const QUEUE = '#/CreditCardOCR'

/**
 * The card-acquiring banks, from the app's one bank list.
 *
 * `kind: 'gateway'` is excluded because those four (KTC, GHL, PayPal, SiamPay) are
 * processor *fee invoices*, not merchant settlement reports — there is no control account
 * for this JV to clear.
 *
 * **Which of them the extractor can actually read is not decided here.** This used to be a
 * local array carrying a `supported` flag, which made three places claim to know: the flag,
 * the server's `SUPPORTED_BANKS`, and the `bank_supported` readiness link that already says
 * so in a sentence at the top of this very screen. The server is the one that knows, it
 * refuses an *enabled* bank it cannot read on save, and the chain goes red the moment an
 * unreadable one is picked. One authority, and it updates itself.
 */
const MERCHANT_BANKS = BANKS.filter(b => b.kind === 'bank')

const TAGS = ['{Settlement_Date}', '{Tax_Invoice_No}', '{Bank_Name}'] as const

/** What each readiness link means, in the order the pipeline meets them. */
const BLOCKER_LABEL: Record<string, string> = {
  bank_supported: 'Bank is readable',
  feature_enabled: 'Feature switched on',
  email_rule: 'Email rule tagged for settlement reports',
  mapping_complete: 'Every payment type mapped',
  clearing_account: 'Clearing account chosen',
  auto_post: 'Posts without review',
}

export default function ARReconcileSettings() {
  const ctrl = useARReconcile()
  const [leaving, setLeaving] = useState(false)

  // A long form with one Save at the foot of it, and a mapping table that costs real
  // attention to fill in. Closing the tab asks; the Back link below asks separately,
  // because a hash navigation never fires this event.
  useEffect(() => {
    if (!ctrl.dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [ctrl.dirty])

  if (ctrl.loading) return <ARSkeleton />

  const debitAccounts = allowedAccountsForDept(
    ctrl.debit.dept,
    ctrl.masterDepartments,
    ctrl.masterAccounts
  )
  const debitDiverged =
    !!ctrl.debitDefault &&
    (ctrl.debitDefault.dept !== ctrl.debit.dept || ctrl.debitDefault.acc !== ctrl.debit.acc)

  return (
    <div className="ar-page">
      {/* The most convenient click on the screen, and it is a hash navigation — so it is
          the one that has to ask rather than the one that gets away with not asking. */}
      <a
        className="ar-back"
        href={QUEUE}
        onClick={e => {
          if (!ctrl.dirty) return
          e.preventDefault()
          setLeaving(true)
        }}
      >
        <ArrowLeft size={14} /> Back to the queue
      </a>

      <CustomModal
        show={leaving}
        type="warning"
        confirmVariant="danger"
        title="Leave without saving?"
        message="The mappings and settings changed here have not been saved. Leaving now discards them."
        confirmText="Discard and leave"
        cancelText="Stay on this page"
        onConfirm={() => {
          window.location.href = QUEUE
        }}
        onCancel={() => setLeaving(false)}
      />

      <h1>
        <Scale size={20} /> Detailed Credit Card AR Reconciliation
      </h1>
      <p className="ar-intro">
        Splits the lump credit-card control account into per-scheme receivables when a settlement
        report arrives by email.
      </p>

      {/* ── Readiness ─────────────────────────────────────────────────────── */}
      <div className="ar-section">
        <div className="section-title">READINESS</div>
        <ul className="ar-chain">
          {ctrl.blockers.map(b => (
            <li key={b.key} className={b.ok ? 'ok' : 'todo'}>
              {b.ok ? <CheckCircle2 size={14} /> : <CircleDot size={14} />}
              <span className="ar-chain-label">{BLOCKER_LABEL[b.key] || b.key}</span>
              {b.detail && <span className="ar-chain-detail">{b.detail}</span>}
            </li>
          ))}
        </ul>
        <p className="ar-chain-note">
          Every one of these fails quietly on its own. All of them have to be green before a
          settlement report posts without a person.
        </p>
      </div>

      {/* ── Bank profile & posting ────────────────────────────────────────── */}
      <div className="ar-section">
        <div className="section-title">BANK PROFILE</div>

        <div className="ar-field">
          <label htmlFor="ar-bank">Merchant bank</label>
          <select
            id="ar-bank"
            className="modal-input"
            value={ctrl.bankCode}
            onChange={e => ctrl.setBankCode(e.target.value)}
          >
            {MERCHANT_BANKS.map(b => (
              <option key={b.value} value={b.value}>
                {b.value} — {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ar-field ar-toggle-field">
          <div>
            {/* A sentence beside a switch, not a field label — and the switch is a button,
                so there is nothing for a `<label htmlFor>` to point at. It reaches the
                control as its accessible name instead. */}
            <span>Reconcile settlement reports for this bank</span>
            <p className="ar-hint">
              Off means arriving reports are handed back unread and cost nothing.
            </p>
          </div>
          <Switch
            checked={ctrl.enabled}
            onChange={ctrl.setEnabled}
            ariaLabel="Reconcile settlement reports for this bank"
          />
        </div>

        <fieldset className="ar-field ar-posttype">
          <legend>Post type</legend>
          <div className="segmented-control" role="radiogroup" aria-label="Post type">
            {POST_TYPES.map(pt => (
              <button
                key={pt}
                type="button"
                role="radio"
                aria-checked={ctrl.postType === pt}
                className={`segmented-btn ${ctrl.postType === pt ? 'active' : ''}`}
                onClick={() => ctrl.setPostType(pt)}
              >
                <span className="ar-seg-name">{pt}</span>
                <span className="ar-seg-count">
                  {ctrl.mappedCount(pt)}/{ctrl.rowCount(pt)} mapped
                </span>
              </button>
            ))}
          </div>
          <p className="ar-hint">
            {ctrl.postType === 'Detail'
              ? 'One credit line per printed payment type, e.g. VS INTER UP PREM.'
              : 'One credit line per scheme — VS, MC, JCB — folding the sub-types together.'}{' '}
            Each keeps its own mappings, so switching does not carry the other set over.
          </p>
        </fieldset>

        <div className="ar-field">
          <label htmlFor="ar-template">JV description</label>
          <input
            id="ar-template"
            type="text"
            className="modal-input ar-mono"
            value={ctrl.template}
            onChange={e => ctrl.setTemplate(e.target.value)}
            onBlur={ctrl.refreshPreview}
          />
          <div className="ar-tags">
            {TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                className="ar-tag"
                onClick={() => {
                  ctrl.setTemplate(`${ctrl.template} ${tag}`.trim())
                  ctrl.refreshPreview()
                }}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="ar-field">
          {/* A `<label>` with no control to point at is a label of nothing. The two pickers
              below are a group, so it names the group — the same job `<legend>` does for
              Post type twenty lines up. */}
          <span className="ar-field-label" id="ar-debit-label">
            Clearing account to debit
          </span>
          <div className="ar-debit-grid" role="group" aria-labelledby="ar-debit-label">
            <CustomSearchSelect
              value={ctrl.debit.dept}
              onChange={val => ctrl.setDebit({ ...ctrl.debit, dept: val })}
              options={ctrl.masterDepartments}
              placeholder="Dept..."
            />
            <CustomSearchSelect
              value={ctrl.debit.acc}
              onChange={val => ctrl.setDebit({ ...ctrl.debit, acc: val })}
              options={debitAccounts}
              placeholder="Acc..."
            />
          </div>
          {debitDiverged ? (
            <p className="ar-hint ar-hint-warn">
              Your credit-card mapping settles to {ctrl.debitDefault?.dept} /{' '}
              {ctrl.debitDefault?.acc}. This JV clears what that one credits — if the two differ,
              the control account never reaches zero.
            </p>
          ) : (
            <p className="ar-hint">Taken from the credit-card mapping this JV has to clear.</p>
          )}
        </div>
      </div>

      <ARMappingTable ctrl={ctrl} />

      <ARJvPreview preview={ctrl.preview} loading={ctrl.previewLoading} postType={ctrl.postType} />

      <div className="ar-actions">
        {/* Says which of the two states the button is in, rather than leaving a disabled
            control to be read as broken. */}
        <p className="ar-save-state" role="status">
          {ctrl.dirty ? 'Unsaved changes' : 'Everything here is saved'}
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void ctrl.save()}
          disabled={ctrl.saving || !ctrl.dirty}
        >
          {ctrl.saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <SwapLabel active={ctrl.saving} idle="Save settings" busy="Saving..." />
        </button>
      </div>
    </div>
  )
}

function ARSkeleton() {
  return (
    <div className="ar-page">
      <div className="ar-skel ar-skel-title" />
      {[0, 1, 2].map(i => (
        <div key={i} className="ar-skel-card">
          <div className="ar-skel ar-skel-line" />
          <div className="ar-skel ar-skel-block" />
        </div>
      ))}
    </div>
  )
}
