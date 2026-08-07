/**
 * Email Automation settings — our own screen against the API Carmen calls.
 *
 * Carmen owns the customer-facing version of this screen (CARMEN_INTEGRATION.md §2).
 * This one exists so the contract can be exercised end to end without them: it uses
 * the same endpoints, the same auth (the user's raw Carmen token, proven against
 * their own Carmen on every call) and the same error shapes, so anything that breaks
 * here breaks on their screen too.
 *
 * Three steps, all visible and independently editable — a checklist, not a wizard.
 * `PUT /settings` is a full replace that returns the new state, so each step saves
 * itself the moment it changes and there is no page-level Save button.
 *
 * English only: this is an internal surface, and CLAUDE.md makes English the default.
 */
import { useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2, Mail, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEmailSettings } from '../hooks/email-settings'
import type { EmailRule, EmailRulePayload } from '../lib/api/emailAutomation'
import { showToast } from '../lib/toast'
import '../styles/pages/email-settings.css'

const EMPTY_RULE = {
  bank_code: '',
  bank_sender_email: '',
  filename_patterns: '',
  pdf_password: '',
  is_active: true,
}

/** What each blocker means, in the words the person reading the screen would use. */
const BLOCKER_TEXT: Record<string, string> = {
  not_configured: 'Nothing saved yet',
  no_tax_id: 'No tax ID registered',
  no_rule: 'No active bank rule',
  disabled: 'Switched off',
  not_entitled: 'No active package',
}

function StepMarker({ n, done }: { n: number; done: boolean }) {
  return (
    <span className="email-setup__marker" aria-hidden="true">
      {done ? <Check size={13} strokeWidth={3} /> : n}
    </span>
  )
}

async function copy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    showToast(`${label} copied`, 'success')
  } catch {
    showToast('Could not copy — select it and copy by hand', 'error')
  }
}

function Skeleton() {
  // Mirrors the three real steps so the layout does not jump when data lands.
  const controls = [300, 150, 340]
  return (
    <div className="email-settings-page" aria-busy="true">
      {controls.map((width, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 26 }}>
          <div
            className="sk-block"
            style={{ width: 25, height: 25, borderRadius: '50%', flexShrink: 0 }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div className="sk-block sk-line" style={{ width: ['34%', '26%', '38%'][i] }} />
            <div className="sk-block sk-line" style={{ width: ['62%', '55%', '70%'][i] }} />
            <div
              className="sk-block"
              style={{ width, maxWidth: '100%', height: 34, borderRadius: 8 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EmailSettings() {
  const ctrl = useEmailSettings()
  const { settings, fieldErrors, saving } = ctrl

  const [newTaxId, setNewTaxId] = useState('')
  const [newOwnerEmail, setNewOwnerEmail] = useState('')
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY_RULE)
  const [tokenInput, setTokenInput] = useState('')

  const rules = settings?.rules || []
  const taxIds = settings?.tax_ids || []
  const ownerEmails = settings?.owner_emails || []
  const status = settings?.status
  const step1Done = taxIds.length > 0
  const step2Done = rules.some(r => r.is_active)
  const step3Done = (status?.documents_total || 0) > 0

  const set = (k: keyof typeof EMPTY_RULE, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }))

  /** The current rules in write shape, with one index replaced or appended. */
  const rulesWith = (index: number | 'new', rule: EmailRulePayload | null): EmailRulePayload[] => {
    const base: EmailRulePayload[] = rules.map(r => ({
      bank_code: r.bank_code,
      bank_sender_email: r.bank_sender_email,
      filename_patterns: r.filename_patterns,
      is_active: r.is_active,
    }))
    if (index === 'new') return rule ? [...base, rule] : base
    if (rule === null) return base.filter((_, i) => i !== index)
    base[index] = rule
    return base
  }

  const startEdit = (index: number, rule: EmailRule) => {
    setEditing(index)
    setForm({
      bank_code: rule.bank_code || '',
      bank_sender_email: rule.bank_sender_email || '',
      filename_patterns: rule.filename_patterns.join(', '),
      pdf_password: '', // write-only — blank means "keep the stored one"
      is_active: rule.is_active,
    })
  }

  const submitRule = async () => {
    if (editing === null) return
    const payload: EmailRulePayload = {
      bank_code: form.bank_code || null,
      bank_sender_email: form.bank_sender_email.trim() || null,
      filename_patterns: form.filename_patterns
        .split(',')
        .map(p => p.trim())
        .filter(Boolean),
      is_active: form.is_active,
      // null = keep what is stored; '' would clear it. Only a typed value sets one.
      pdf_password: form.pdf_password || null,
    }
    if (await ctrl.setRules(rulesWith(editing, payload))) setEditing(null)
  }

  const addTaxId = async () => {
    const value = newTaxId.replace(/[\s-]/g, '')
    if (!value) return
    if (await ctrl.setTaxIds([...taxIds, value])) setNewTaxId('')
  }

  const addOwnerEmail = async () => {
    const value = newOwnerEmail.trim().toLowerCase()
    if (!value || ownerEmails.includes(value)) return
    if (await ctrl.setOwnerEmails([...ownerEmails, value])) setNewOwnerEmail('')
  }

  if (ctrl.loading) return <Skeleton />

  const err = ctrl.error

  return (
    <div className="email-settings-page">
      <h1>
        <Mail size={20} /> Email Automation
      </h1>
      <p className="email-settings-page__lede">
        Forward a bank&apos;s fee report to the address below and it is extracted and posted to
        Carmen without anyone opening the app. This screen is our copy of the one Carmen builds — it
        calls the same API with the same Carmen token, so what works here works there.
      </p>

      {err && (
        <div className="email-settings-banner" data-tone={err.status === 409 ? 'warn' : undefined}>
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

      {/* ── Connection: who we are acting for, and with what credential ── */}
      <div className="email-conn">
        <div className="email-conn__row">
          <span className="email-conn__label">Host</span>
          <span className="email-conn__value">{ctrl.host || '—'}</span>
          <span className="email-conn__label">BU</span>
          <span className="email-conn__value">{ctrl.bu || '—'}</span>
          <span className="email-conn__spacer" />
          <label className="email-conn__toggle">
            <input
              type="checkbox"
              checked={settings?.enabled ?? false}
              disabled={saving}
              onChange={e => void ctrl.setEnabled(e.target.checked)}
            />
            Enabled
            {saving && <Loader2 size={13} className="animate-spin" />}
          </label>
        </div>
        {fieldErrors['enabled'] && <p className="email-setup__error">{fieldErrors['enabled']}</p>}

        <div className="email-conn__row email-conn__row--stack">
          <span className="email-conn__label">Your email addresses</span>
          <p className="email-setup__hint">
            Optional second layer. Leave this empty and any mail reaching your address is accepted.
            Add addresses and a message must carry one of them in From, To or Cc — anything else is
            recorded <code>sender_not_allowed</code> and never scanned, at no cost. Add the mailbox
            your bank mail arrives at <em>and</em> anyone who forwards by hand, or their mail will
            be refused.
          </p>
          {ownerEmails.length > 0 && (
            <div className="email-setup__chips">
              {ownerEmails.map(addr => (
                <span key={addr} className="email-setup__chip">
                  {addr}
                  <button
                    type="button"
                    aria-label={`Remove ${addr}`}
                    disabled={saving}
                    onClick={() => void ctrl.setOwnerEmails(ownerEmails.filter(x => x !== addr))}
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="email-setup__addrow">
            <input
              className="email-setup__input"
              type="email"
              placeholder="accounting@yourcompany.com"
              value={newOwnerEmail}
              onChange={e => setNewOwnerEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void addOwnerEmail()}
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!newOwnerEmail.trim() || saving}
              onClick={() => void addOwnerEmail()}
            >
              <Plus size={12} /> Add
            </button>
          </div>
          {Object.entries(fieldErrors)
            .filter(([field]) => field.startsWith('owner_emails'))
            .map(([field, message]) => (
              <p key={field} className="email-setup__error">
                {message}
              </p>
            ))}
        </div>

        <div className="email-conn__row">
          <span className="email-conn__label">Posting credential</span>
          <span className="email-conn__value">
            {ctrl.tokenStatus?.configured
              ? `${ctrl.tokenStatus.fingerprint} · verified ${
                  ctrl.tokenStatus.verified_at
                    ? new Date(ctrl.tokenStatus.verified_at).toLocaleString()
                    : 'never'
                }`
              : 'not set — automated posting is off'}
          </span>
        </div>
        <div className="email-conn__row">
          <div className="email-conn__token-form">
            <input
              className="email-setup__input"
              type="password"
              placeholder="Paste the Carmen token JVs are posted with"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!tokenInput.trim() || saving}
              onClick={async () => {
                if (await ctrl.saveToken(tokenInput.trim())) {
                  setTokenInput('')
                  showToast('Token verified and stored', 'success')
                }
              }}
            >
              Save token
            </button>
            {ctrl.tokenStatus?.configured && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={saving}
                onClick={() => void ctrl.removeToken()}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <ol className="email-setup">
        {/* ── Step 1: tax IDs ── */}
        <li className="email-setup__step" data-done={step1Done}>
          <StepMarker n={1} done={step1Done} />
          <div className="email-setup__body">
            <div className="email-setup__title">Your tax ID</div>
            <p className="email-setup__hint">
              13 digits, no separators. This is the second check, not the routing key: a document
              printing another BU&apos;s tax ID is parked instead of posted. Add more than one if
              this BU covers several legal entities.
            </p>
            {taxIds.length > 0 && (
              <div className="email-setup__chips">
                {taxIds.map(id => (
                  <span key={id} className="email-setup__chip">
                    {id}
                    <button
                      type="button"
                      aria-label={`Remove ${id}`}
                      disabled={saving}
                      onClick={() => void ctrl.setTaxIds(taxIds.filter(x => x !== id))}
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="email-setup__addrow">
              <input
                className="email-setup__input"
                placeholder="0105536000127"
                inputMode="numeric"
                value={newTaxId}
                onChange={e => setNewTaxId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && void addTaxId()}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!newTaxId.trim() || saving}
                onClick={() => void addTaxId()}
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {Object.entries(fieldErrors)
              .filter(([field]) => field.startsWith('tax_ids'))
              .map(([field, message]) => (
                <p key={field} className="email-setup__error">
                  {message}
                </p>
              ))}
          </div>
        </li>

        {/* ── Step 2: bank rules ── */}
        <li className="email-setup__step" data-done={step2Done}>
          <StepMarker n={2} done={step2Done} />
          <div className="email-setup__body">
            <div className="email-setup__title">Your banks</div>
            <p className="email-setup__hint">
              One rule per bank. An attachment matching no rule is never extracted and never charged
              — which is also what keeps signature logos out. Leave the bank blank to let the
              document itself say who issued it.
            </p>

            {rules.map((r, i) => (
              <div key={i} className="email-setup__bank" data-inactive={!r.is_active}>
                <div className="email-setup__bank-main">
                  <span className="email-setup__bank-name">
                    {r.bank_code || 'Other (detected)'}
                  </span>
                  <span className="email-setup__bank-sender">
                    {r.bank_sender_email || 'any sender'}
                  </span>
                </div>
                <div className="email-setup__bank-meta">
                  {r.filename_patterns.length > 0 && (
                    <span className="email-setup__badge">
                      file: {r.filename_patterns.join(', ')}
                    </span>
                  )}
                  {r.has_password && <span className="email-setup__badge">password set</span>}
                  {!r.is_active && <span className="email-setup__badge">off</span>}
                </div>
                <div className="email-setup__bank-actions">
                  <button
                    type="button"
                    aria-label={`Edit ${r.bank_code || 'rule'}`}
                    onClick={() => startEdit(i, r)}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${r.bank_code || 'rule'}`}
                    disabled={saving}
                    onClick={() => void ctrl.setRules(rulesWith(i, null))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}

            {editing === null && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  setEditing('new')
                  setForm(EMPTY_RULE)
                }}
              >
                <Plus size={12} /> {rules.length === 0 ? 'Add your first bank' : 'Add another bank'}
              </button>
            )}

            {editing !== null && (
              <div className="email-setup__form">
                <label className="email-setup__field">
                  <span>Bank</span>
                  <select
                    className="email-setup__input"
                    value={form.bank_code}
                    onChange={e => set('bank_code', e.target.value)}
                  >
                    <option value="">Other — detect from the document</option>
                    {ctrl.banks.map(b => (
                      <option key={b.code} value={b.code}>
                        {b.code} — {b.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="email-setup__field">
                  <span>Sender address</span>
                  <input
                    className="email-setup__input"
                    placeholder="kmerchant@kasikornbank.com"
                    value={form.bank_sender_email}
                    onChange={e => set('bank_sender_email', e.target.value)}
                  />
                  <small>
                    Narrows which rules apply. Leave blank so a manual forward from a colleague
                    still matches.
                  </small>
                </label>
                <label className="email-setup__field">
                  <span>Filename patterns</span>
                  <input
                    className="email-setup__input"
                    placeholder="MDR, Commission"
                    value={form.filename_patterns}
                    onChange={e => set('filename_patterns', e.target.value)}
                  />
                  <small>
                    Comma-separated, matched anywhere in the filename. Required — use{' '}
                    <code>.pdf</code> to accept every PDF from this bank.
                  </small>
                </label>
                <label className="email-setup__field">
                  <span>
                    PDF password{' '}
                    {editing !== 'new' ? '(blank = keep current)' : '(only if the file is locked)'}
                  </span>
                  <input
                    className="email-setup__input"
                    type="password"
                    value={form.pdf_password}
                    onChange={e => set('pdf_password', e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
                {editing !== 'new' && (
                  <label className="email-setup__check">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => set('is_active', e.target.checked)}
                    />
                    Active
                  </label>
                )}
                {Object.entries(fieldErrors)
                  .filter(([field]) => field.startsWith('rules'))
                  .map(([field, message]) => (
                    <p key={field} className="email-setup__error">
                      {message}
                    </p>
                  ))}
                <div className="email-setup__form-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    disabled={saving}
                    onClick={() => void submitRule()}
                  >
                    Save bank
                  </button>
                </div>
              </div>
            )}
          </div>
        </li>

        {/* ── Step 3: forward mail here ── */}
        <li className="email-setup__step" data-done={step3Done}>
          <StepMarker n={3} done={step3Done} />
          <div className="email-setup__body">
            <div className="email-setup__title">Forward the bank&apos;s mail here</div>
            {settings?.ingest_address ? (
              <>
                <p className="email-setup__hint">
                  Set a forwarding rule in the mailbox that receives the bank report, pointing at
                  this address. It is unique to this BU — that tag is how a message is attributed
                  before anything is read.
                </p>
                <div className="email-setup__copybox">
                  <code className="email-setup__addr">{settings.ingest_address}</code>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => void copy(settings.ingest_address as string, 'Address')}
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
              </>
            ) : (
              <p className="email-setup__hint">
                Your address is issued the first time this BU is switched on successfully. Finish
                the steps above and turn it on.
              </p>
            )}

            {step3Done ? (
              <div className="email-setup__live">
                <span className="email-setup__live-dot" />
                Receiving: {status?.documents_total} document
                {status?.documents_total === 1 ? '' : 's'}
                {status?.last_received_at &&
                  ` · last ${new Date(status.last_received_at).toLocaleString()}`}
              </div>
            ) : (
              step1Done &&
              step2Done && (
                <p className="email-setup__waiting">
                  Set up, waiting for the first document to arrive.
                </p>
              )
            )}

            {/* Gmail's half of the handshake. The code is mailed to the address above,
                which no customer can open — so it surfaces here instead. */}
            <div
              className="email-setup__confirm"
              data-has-code={Boolean(settings?.gmail_confirm) || undefined}
            >
              <div className="email-setup__title" style={{ lineHeight: 1.4 }}>
                Gmail confirmation code
              </div>
              {settings?.gmail_confirm ? (
                <>
                  <p className="email-setup__hint" style={{ margin: '4px 0 8px' }}>
                    Paste this into the confirmation prompt on your own Gmail forwarding screen.
                    {settings.gmail_confirm.at &&
                      ` Received ${new Date(settings.gmail_confirm.at).toLocaleString()}.`}
                  </p>
                  <div className="email-setup__copybox" style={{ marginBottom: 0 }}>
                    <code className="email-setup__addr email-setup__confirm-code">
                      {settings.gmail_confirm.code}
                    </code>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => void copy(settings.gmail_confirm!.code, 'Code')}
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                </>
              ) : (
                <p className="email-setup__waiting" style={{ marginTop: 4 }}>
                  Add the forwarding address in Gmail — Google mails a code here and it appears on
                  this screen within a minute or two.
                </p>
              )}
            </div>

            {status && status.blockers.length > 0 && (
              <div className="email-blockers">
                {status.blockers.map(b => (
                  <span key={b} className="email-blockers__chip">
                    {BLOCKER_TEXT[b] || b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </li>
      </ol>
    </div>
  )
}
