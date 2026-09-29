/**
 * Email Automation settings — our own screen against the API Carmen calls.
 *
 * Carmen owns the customer-facing version of this screen (CARMEN_INTEGRATION.md §2).
 * This one exists so the contract can be exercised end to end without them: it uses
 * the same endpoints, the same auth (the user's raw Carmen token, proven against
 * their own Carmen on every call) and the same error shapes, so anything that breaks
 * here breaks on their screen too.
 *
 * **Nothing in the UI links here any more** (2026-09-08). Every settings button on the review
 * queue opens Carmen's own screen, because that is the screen that owns these values — the
 * same reason `auto_post` has one writer. This page is reached by typing the hash: by support,
 * and by whoever is exercising the contract. The route in `main.tsx` stays for exactly that.
 *
 * **The layout is Carmen's, the parts are ours** (2026-09-10, CARMEN_INTEGRATION.md §2.8).
 * Same sections, same controls, same dirty-form-with-one-Save semantics as the screen they
 * are building, assembled from the `ui-*` kit — so handing this over is "copy this layout",
 * not "design a screen". Three blocks are ours alone and marked as such below: the posting
 * credential, the live status line, and the per-rule document type.
 *
 * English only: this is an internal surface, and CLAUDE.md makes English the default.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'
import Badge from '@/shared/components/common/Badge'
import Button from '@/shared/components/ui/Button'
import Card from '@/shared/components/ui/Card'
import PageHeader from '@/shared/components/ui/PageHeader'
import Switch from '@/shared/components/ui/Switch'
import { EMPTY_RULE, useEmailSettings, type RuleDraft } from '@/features/email-settings/hooks'
import type { EmailDocType } from '@/features/email-settings/api/emailAutomation'
import { showToast } from '@/shared/lib/toast'
import '@/styles/pages/email-settings.css'

/** What each blocker means, in the words the person reading the screen would use. */
const BLOCKER_TEXT: Record<string, string> = {
  not_configured: 'Nothing saved yet',
  no_tax_id: 'No tax ID registered',
  no_rule: 'No active bank rule',
  disabled: 'Switched off',
  not_entitled: 'No active package',
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    showToast(`${label} copied`, 'success')
  } catch {
    showToast('Could not copy — select it and copy by hand', 'error')
  }
}

/** The errors for one field, or for everything under one prefix (`tax_ids[0]`,
 *  `rules[1].filename_patterns`). Rendered beside the input that caused them. */
function FieldError({ errors, prefix }: { errors: Record<string, string>; prefix: string }) {
  const hits = Object.entries(errors).filter(([field]) => field.startsWith(prefix))
  if (hits.length === 0) return null
  return (
    <>
      {hits.map(([field, message]) => (
        <p key={field} className="email-error">
          {message}
        </p>
      ))}
    </>
  )
}

function Skeleton() {
  // Two cards, so the layout does not jump when the data lands.
  return (
    <div className="email-settings-page" aria-busy="true">
      <div className="sk-block sk-line" style={{ width: '30%', height: 24, marginBottom: 20 }} />
      {[150, 320].map((height, i) => (
        <div key={i} className="sk-block" style={{ height, borderRadius: 16, marginBottom: 20 }} />
      ))}
    </div>
  )
}

export default function EmailSettings() {
  const ctrl = useEmailSettings()
  const { draft, dirty, settings, fieldErrors, saving } = ctrl
  const [tokenInput, setTokenInput] = useState('')

  const status = settings?.status
  const blockers = status?.blockers || []
  const received = status?.documents_total || 0

  // The page has no in-app nav links, so this is the realistic way to leave it.
  // ponytail: hash navigation away won't fire beforeunload; add a router guard if the
  // page ever gains links.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const setRule = (index: number, part: Partial<RuleDraft>) =>
    ctrl.patch({ rules: draft.rules.map((r, i) => (i === index ? { ...r, ...part } : r)) })

  const removeRule = (index: number) =>
    ctrl.patch({ rules: draft.rules.filter((_, i) => i !== index) })

  const onSave = async () => {
    if (await ctrl.save()) showToast('Settings saved', 'success')
  }

  if (ctrl.loading) return <Skeleton />

  const err = ctrl.error

  return (
    <div className="email-settings-page">
      <PageHeader
        // One name for the feature, and it is the one the queue page wears. Messages that
        // send a reader here name it too ("Arrived while AI JV Automation was switched
        // off"), so the heading they land on has to be the same words.
        title="AI JV Automation"
        description="Configure email ingestion and bank document matching for this business unit. Forward a bank's fee report to the address below and it is extracted and posted to Carmen without anyone opening the app."
        actions={
          <Button onClick={() => void ctrl.reload()} disabled={saving} aria-label="Reload">
            <RefreshCw size={14} />
          </Button>
        }
      />

      <div className="email-ctx">
        <span>
          URI: <strong>{ctrl.host || '—'}</strong>
        </span>
        <span>
          BU: <strong>{ctrl.bu || '—'}</strong>
        </span>
      </div>

      {err && (
        <div className="email-banner" data-tone={err.status === 409 ? 'warn' : undefined}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {err.status === 401 &&
              'Carmen rejected the token — reopen this page from Carmen to sign in again. '}
            {err.status === 502 && 'Could not reach Carmen to check the token. '}
            {err.status === 429 && 'Too many requests — wait a minute. '}
            {err.message}
          </span>
        </div>
      )}

      <Card title="Service status">
        <Badge variant={status?.ready ? 'ok' : 'warn'}>
          {status?.ready ? 'Ready' : 'Not ready'}
        </Badge>

        <label className="email-field" style={{ marginTop: 'var(--space-4)' }}>
          <span>Ingest email address</span>
          <div className="email-copyrow">
            <input
              className="admin-form-input"
              readOnly
              value={settings?.ingest_address || ''}
              placeholder="issued once AI is enabled and saved"
            />
            <Button
              disabled={!settings?.ingest_address}
              onClick={() => void copy(settings?.ingest_address as string, 'Address')}
            >
              <Copy size={13} /> COPY
            </Button>
          </div>
          <small>
            This address is created after AI is enabled and the settings are saved successfully for
            the first time. It is unique to this BU — that tag is how a message is attributed before
            anything is read. Set a forwarding rule in the mailbox that receives the bank report,
            pointing at it.
          </small>
        </label>

        {/* Ours. Carmen's screen stops at the Ready badge; the count is the only proof on
            the page that a forward actually works. */}
        {received > 0 && (
          <div className="email-live">
            <span className="email-live__dot" />
            Receiving: {received} document{received === 1 ? '' : 's'}
            {status?.last_received_at &&
              ` · last ${new Date(status.last_received_at).toLocaleString()}`}
          </div>
        )}

        {/* Google normally confirms the forward by link, which the poll follows itself, so
            this is only ever reached if they go back to printing a code. */}
        {settings?.gmail_confirm && !settings.gmail_confirmed_at && (
          <div className="email-live" data-tone="warn">
            Gmail asked for a code: <code>{settings.gmail_confirm.code}</code> — paste it into the
            confirmation prompt on your own Gmail forwarding screen.
          </div>
        )}

        {blockers.length > 0 && (
          <div className="email-blockers">
            {blockers.map(b => (
              <span key={b} className="email-blockers__chip">
                {BLOCKER_TEXT[b] || b}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card title="Automation settings">
        <p className="email-note">
          Saving replaces the complete Tax ID and rule lists for this BU.
        </p>

        <div className="email-grid2">
          <div className="email-toggle-card">
            <div>
              <div className="email-toggle-card__title">Enable AI document processing</div>
              <p className="email-hint">
                Turn on to receive and process documents with AI. When off, document scanning is
                paused.
              </p>
              <FieldError errors={fieldErrors} prefix="enabled" />
            </div>
            <Switch
              checked={draft.enabled}
              disabled={saving}
              ariaLabel="Enable AI document processing"
              onChange={enabled => ctrl.patch({ enabled })}
            />
          </div>

          {/* Carmen's own screen owns this decision for a customer (§2.7) — it is here so
              support can set it for a BU whose Carmen has not shipped the control yet, and
              so the field is exercised end to end like every other one on this page.

              It is the one control that lets a document reach Carmen unseen, so the hint
              names what still stops rather than reassuring. */}
          <div className="email-toggle-card">
            <div>
              <div className="email-toggle-card__title">Post scanned documents automatically</div>
              <ul className="email-hint email-hint--bullets">
                <li data-tone="on">On: post immediately without review.</li>
                <li data-tone="off">
                  Off: wait for confirmation in the Review step before posting.
                </li>
              </ul>
              <p className="email-hint">
                A document we read with nothing to flag posts on its own; anything else still waits
                either way — a warning, a GL mapping the AI had to guess, amounts that do not
                reconcile, a missing document number, or an unmapped payment type.
              </p>
            </div>
            <Switch
              checked={draft.auto_post}
              disabled={saving}
              ariaLabel="Post scanned documents automatically"
              onChange={auto_post => ctrl.patch({ auto_post })}
            />
          </div>
        </div>

        <div className="email-grid2">
          <label className="email-field">
            <span>Owner emails</span>
            <textarea
              className="admin-form-input"
              rows={3}
              placeholder="accounting@yourcompany.com"
              value={draft.owner_emails}
              onChange={e => ctrl.patch({ owner_emails: e.target.value })}
            />
            <small>
              Separate multiple values with commas or new lines. Optional second layer: leave empty
              and any mail reaching your address is accepted. Add addresses and a message must carry
              one of them in From, To or Cc — anything else is recorded{' '}
              <code>sender_not_allowed</code> and never scanned, at no cost. Add the mailbox your
              bank mail arrives at <em>and</em> anyone who forwards by hand.
            </small>
            <FieldError errors={fieldErrors} prefix="owner_emails" />
          </label>

          <label className="email-field">
            <span>Company Tax IDs *</span>
            <textarea
              className="admin-form-input"
              rows={3}
              placeholder="0105536000127"
              value={draft.tax_ids}
              onChange={e => ctrl.patch({ tax_ids: e.target.value })}
            />
            <small>
              13 digits each, separated by commas or new lines. This is the second check, not the
              routing key: a document printing another BU&apos;s tax ID is parked instead of posted.
              Add more than one if this BU covers several legal entities.
            </small>
            <FieldError errors={fieldErrors} prefix="tax_ids" />
          </label>
        </div>

        <div className="email-rules-head">
          <span className="email-rules-head__title">Rules</span>
          <Button
            size="sm"
            onClick={() => ctrl.patch({ rules: [...draft.rules, { ...EMPTY_RULE }] })}
          >
            <Plus size={13} /> ADD RULE
          </Button>
        </div>
        <p className="email-hint">
          One rule per bank. An attachment matching no rule is never extracted and never charged —
          which is also what keeps signature logos out. Leave the bank blank to let the document
          itself say who issued it.
        </p>

        {draft.rules.map((rule, i) => (
          <div key={i} className="email-rule" data-inactive={!rule.is_active || undefined}>
            <div className="email-rule__head">
              <span className="email-rule__title">Rule {i + 1}</span>
              <button
                type="button"
                className="email-rule__delete"
                aria-label={`Remove rule ${i + 1}`}
                onClick={() => removeRule(i)}
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="email-rule__grid">
              <label className="email-field">
                <span>Bank</span>
                <select
                  className="admin-form-input"
                  value={rule.bank_code}
                  onChange={e => setRule(i, { bank_code: e.target.value })}
                >
                  <option value="">Other — detect from the document</option>
                  {ctrl.banks.map(b => (
                    <option key={b.code} value={b.code}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Ours. Both documents arrive from the same bank carrying the same tax
                  invoice number, so nothing on the page tells them apart — a settlement
                  report matched by a commission rule is read with the wrong layout. */}
              <label className="email-field">
                <span>Document type</span>
                <select
                  className="admin-form-input"
                  value={rule.doc_type}
                  onChange={e => setRule(i, { doc_type: e.target.value as EmailDocType })}
                >
                  <option value="fee_invoice">Commission invoice — the fee the bank charges</option>
                  <option value="ar_reconcile">
                    Settlement report — splits the control account (KBANK only)
                  </option>
                </select>
              </label>

              <label className="email-field">
                <span>Bank sender email</span>
                <input
                  className="admin-form-input"
                  placeholder="kmerchant@kasikornbank.com"
                  value={rule.bank_sender_email}
                  onChange={e => setRule(i, { bank_sender_email: e.target.value })}
                />
                <small>Blank so a manual forward from a colleague still matches.</small>
              </label>

              <label className="email-field">
                <span>PDF password {rule.has_password ? '(blank = keep current)' : ''}</span>
                <input
                  className="admin-form-input"
                  type="password"
                  autoComplete="new-password"
                  value={rule.pdf_password}
                  onChange={e => setRule(i, { pdf_password: e.target.value })}
                />
                <small>Only if the file is locked.</small>
              </label>
            </div>

            <div className="email-rule__foot">
              <label className="email-field">
                <span>Filename patterns *</span>
                <input
                  className="admin-form-input"
                  placeholder="MDR, Commission"
                  value={rule.filename_patterns}
                  onChange={e => setRule(i, { filename_patterns: e.target.value })}
                />
                <small>
                  Separate multiple values with commas or new lines, matched anywhere in the
                  filename. Required — use <code>.pdf</code> to accept every PDF from this bank.
                </small>
              </label>
              <Switch
                checked={rule.is_active}
                label="Active"
                onChange={is_active => setRule(i, { is_active })}
              />
            </div>

            <FieldError errors={fieldErrors} prefix={`rules[${i}]`} />
          </div>
        ))}
      </Card>

      {/* Ours. Carmen's app posts as the signed-in user, so their screen has no field for
          this; without it here, automated posting is off no matter what else is set. */}
      <Card title="Posting credential">
        <p className="email-note">
          {ctrl.tokenStatus?.configured
            ? `${ctrl.tokenStatus.fingerprint} · verified ${
                ctrl.tokenStatus.verified_at
                  ? new Date(ctrl.tokenStatus.verified_at).toLocaleString()
                  : 'never'
              }`
            : 'Not set — automated posting is off.'}
        </p>
        <div className="email-copyrow">
          <input
            className="admin-form-input"
            type="password"
            placeholder="Paste the Carmen token JVs are posted with"
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            autoComplete="new-password"
          />
          <Button
            variant="primary"
            disabled={!tokenInput.trim() || saving}
            onClick={async () => {
              if (await ctrl.saveToken(tokenInput.trim())) {
                setTokenInput('')
                showToast('Token verified and stored', 'success')
              }
            }}
          >
            Save token
          </Button>
          {ctrl.tokenStatus?.configured && (
            <Button disabled={saving} onClick={() => void ctrl.removeToken()}>
              Delete
            </Button>
          )}
        </div>
      </Card>

      <div className="email-actionbar">
        <Button variant="primary" disabled={!dirty || saving} onClick={() => void onSave()}>
          {saving ? 'SAVING…' : 'SAVE SETTINGS'}
        </Button>
        <Button disabled={!dirty || saving} onClick={ctrl.reset}>
          RESET
        </Button>
      </div>
    </div>
  )
}
