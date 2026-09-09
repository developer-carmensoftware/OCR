import { ArrowLeft, CheckCircle2, CircleDot, Loader2, Scale } from 'lucide-react'
import '../styles/pages/ar-reconcile.css'
import ARJvPreview from '../components/ar-reconcile/ARJvPreview'
import ARMappingTable from '../components/ar-reconcile/ARMappingTable'
import CustomSearchSelect from '../components/common/CustomSearchSelect'
import SwapLabel from '../components/common/SwapLabel'
import { useARReconcile } from '../hooks/ar-reconcile'
import { POST_TYPES, type PostType } from '../lib/api/arReconcile'
import { allowedAccountsForDept } from '../lib/deptAccounts'

/**
 * Detailed Credit Card AR Reconciliation — per-bank settings.
 *
 * Single-column `.section` stack, matching Mapping.tsx, which is this screen's sibling:
 * the FRD mockup put the mapping table in a right-hand panel, but the same table gets
 * more width here and the save button, the status line and the pickers stay the ones the
 * rest of the app uses.
 */

const BANKS: { code: string; label: string; supported: boolean }[] = [
  { code: 'KBANK', label: 'KBANK — Kasikornbank (Merchant)', supported: true },
  { code: 'SCB', label: 'SCB — Siam Commercial Bank', supported: false },
  { code: 'BBL', label: 'BBL — Bangkok Bank', supported: false },
  { code: 'BAY', label: 'BAY — Krungsri', supported: false },
]

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
    <div className="container">
      <a className="ar-back" href="#/CreditCardOCR">
        <ArrowLeft size={14} /> Back to the queue
      </a>

      <h1>
        <Scale size={20} /> Detailed Credit Card AR Reconciliation
      </h1>
      <p className="ar-intro">
        Splits the lump credit-card control account into per-scheme receivables when a settlement
        report arrives by email.
      </p>

      {/* ── Readiness ─────────────────────────────────────────────────────── */}
      <div className="section ar-readiness">
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
      <div className="section">
        <div className="section-title">BANK PROFILE</div>

        <div className="ar-field">
          <label htmlFor="ar-bank">Merchant bank</label>
          <select
            id="ar-bank"
            className="modal-input"
            value={ctrl.bankCode}
            onChange={e => ctrl.setBankCode(e.target.value)}
          >
            {BANKS.map(b => (
              <option key={b.code} value={b.code} disabled={!b.supported}>
                {b.label}
                {b.supported ? '' : ' — Phase 2'}
              </option>
            ))}
          </select>
        </div>

        <div className="ar-field ar-toggle-field">
          <div>
            <label htmlFor="ar-enabled">Reconcile settlement reports for this bank</label>
            <p className="ar-hint">
              Off means arriving reports are handed back unread and cost nothing.
            </p>
          </div>
          <label className="ar-switch">
            <input
              id="ar-enabled"
              type="checkbox"
              checked={ctrl.enabled}
              onChange={e => ctrl.setEnabled(e.target.checked)}
            />
            <span className="ar-switch-track" aria-hidden="true" />
          </label>
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
                onClick={() => ctrl.setPostType(pt as PostType)}
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
          <label id="ar-debit-label">Clearing account to debit</label>
          <div className="ar-debit-grid" aria-labelledby="ar-debit-label">
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
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void ctrl.save()}
          disabled={ctrl.saving}
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
    <div className="container">
      <div className="skeleton ar-skel-title" />
      {[0, 1, 2].map(i => (
        <div key={i} className="skeleton-card ar-skel-card">
          <div className="skeleton ar-skel-line" />
          <div className="skeleton ar-skel-block" />
        </div>
      ))}
    </div>
  )
}
