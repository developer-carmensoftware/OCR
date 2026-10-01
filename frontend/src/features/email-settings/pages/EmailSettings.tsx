/**
 * AI JV Automation settings — the customer's one screen for this feature (decision #34,
 * 2026-10-01; CARMEN_INTEGRATION.md §2.8).
 *
 * **Two ways in, both deliberate.** Carmen's menu opens it through the same SSO link as the
 * queue (`#/email-settings?token=&bu=&uri=`), after minting the BU's posting token if it
 * needs one; and the queue's fix buttons open it in this tab. Carmen decides who sees its
 * menu item and we check nothing twice, so there is no role gate here — the same reach every
 * BU user already has when they approve a document. Nothing else links here (no Home tile, no
 * queue header link): the menu is the front door.
 *
 * It talks to `/api/v1/carmen/settings*` with the user's raw Carmen token, proven against
 * their own Carmen on every call — the endpoints Carmen was to call from a screen of its own,
 * unchanged. `PUT /settings` is still the one writer of every field, `auto_post` included.
 *
 * **Layout: settings sections, read like an instrument panel** (DESIGN.md "Settings pages").
 * One status line answers whether documents are arriving and, if not, what to do next. Each
 * section names its purpose on the left and holds only its controls on the right. Bank rules
 * are one summary row each, edited in place, so a BU with five banks can see all five at
 * once. Every control still edits the hook's single draft, saved by one sticky bar.
 *
 * English only, as CLAUDE.md makes English the default for a new surface.
 */
import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import Button from '@/shared/components/ui/Button'
import PageHeader from '@/shared/components/ui/PageHeader'
import Switch from '@/shared/components/ui/Switch'
import {
  EMPTY_RULE,
  splitList,
  useEmailSettings,
  type RuleDraft,
} from '@/features/email-settings/hooks'
import type { BankCode, EmailDocType } from '@/features/email-settings/api/emailAutomation'
import { showToast } from '@/shared/lib/toast'
import '@/styles/pages/email-settings.css'

/** What each blocker asks of the reader, and the control on this page that answers it. A
 *  blocker with no control (a missing package) links to where it is answered instead. */
const NEXT_STEP: Record<string, { text: string; target?: string; href?: string }> = {
  // Save is disabled until something changes, so this starts at the first control instead.
  not_configured: { text: 'Fill in the settings below, then save', target: 'email-enabled' },
  not_entitled: { text: 'Get a monthly package', href: '#/pricing' },
  disabled: { text: 'Switch on document processing', target: 'email-enabled' },
  no_tax_id: { text: 'Add a company tax ID', target: 'email-tax-ids' },
  no_rule: { text: 'Add an active bank rule', target: 'email-add-rule' },
}

const DOC_TYPE_LABEL: Record<EmailDocType, string> = {
  fee_invoice: 'Commission invoice',
  ar_reconcile: 'Settlement report',
}

/** Under the select, so the option text stays short enough to read in a half-width field. */
const DOC_TYPE_HELP: Record<EmailDocType, string> = {
  fee_invoice: 'The fee the bank charges you, posted as an expense.',
  ar_reconcile: 'Splits the credit-card control account into receivables per card scheme.',
}

/** Day, month, year and time: the activity log is read in Thailand, where 10/1 means January. */
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

async function copyAddress(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    showToast('Address copied', 'success')
  } catch {
    showToast('Could not copy. Select the address and copy it by hand.', 'error')
  }
}

/** Move to the control a next step names, and put the keyboard there too. */
function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.focus({ preventScroll: true })
}

/** Errors whose field starts with `prefix` (`tax_ids`, `rules[1].filename_patterns`),
 *  rendered under the input that caused them. */
function FieldError({ errors, prefix }: { errors: Record<string, string>; prefix: string }) {
  const hits = Object.entries(errors).filter(([field]) => field.startsWith(prefix))
  if (hits.length === 0) return null
  return (
    <>
      {hits.map(([field, message]) => (
        <p key={field} className="email-error" role="alert">
          {message}
        </p>
      ))}
    </>
  )
}

/** The rule fields the editor renders an error under; anything else about a rule is printed
 *  at the bottom of its editor, so an unknown field's message is never lost. */
const RULE_FIELDS = [
  'bank_code',
  'doc_type',
  'bank_sender_email',
  'pdf_password',
  'filename_patterns',
]

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: ReactNode
  children: ReactNode
}) {
  return (
    <section className="email-section" aria-labelledby={`${id}-title`}>
      <div className="email-section__intro">
        <h2 id={`${id}-title`} className="email-section__title">
          {title}
        </h2>
        <p className="email-section__desc">{description}</p>
      </div>
      <div className="email-section__body">{children}</div>
    </section>
  )
}

function RuleRow({
  rule,
  index,
  open,
  banks,
  errors,
  saving,
  onToggle,
  onChange,
  onRemove,
}: {
  rule: RuleDraft
  index: number
  open: boolean
  banks: BankCode[]
  errors: Record<string, string>
  saving: boolean
  onToggle: () => void
  onChange: (part: Partial<RuleDraft>) => void
  onRemove: () => void
}) {
  const n = index + 1
  const bank = banks.find(b => b.code === rule.bank_code)
  const patterns = splitList(rule.filename_patterns)
  const prefix = `rules[${index}]`
  const ruleErrors = Object.keys(errors).filter(f => f.startsWith(prefix))
  const otherErrors = ruleErrors.filter(f => !RULE_FIELDS.some(k => f.startsWith(`${prefix}.${k}`)))
  const editorId = `email-rule-${index}`
  const fieldId = (name: string) => `${editorId}-${name}`

  return (
    <li
      className="email-rule"
      data-open={open || undefined}
      data-inactive={!rule.is_active || undefined}
    >
      <div className="email-rule__summary">
        <button
          type="button"
          className="email-rule__toggle"
          aria-expanded={open}
          aria-controls={editorId}
          onClick={onToggle}
        >
          <span className="sr-only">Rule {n}: </span>
          <span className="email-rule__bank">
            <span className="email-rule__code">{rule.bank_code || 'Other'}</span>
            <span className="email-rule__bankname">
              {rule.bank_code ? bank?.name || 'Bank' : 'Any other bank'}
            </span>
            {ruleErrors.length > 0 && <span className="email-rule__alert">Needs attention</span>}
          </span>
          <span className="email-rule__type">{DOC_TYPE_LABEL[rule.doc_type]}</span>
          <span className="email-rule__patterns">
            {patterns.length > 0 ? (
              patterns.map(p => (
                <span key={p} className="email-chip">
                  {p}
                </span>
              ))
            ) : (
              <span className="email-rule__missing">No filename patterns</span>
            )}
          </span>
          <span className="email-rule__flags">
            {(rule.has_password || rule.pdf_password) && (
              <Lock size={14} role="img" aria-label="PDF password set" />
            )}
          </span>
          <ChevronDown className="email-rule__chevron" size={16} aria-hidden="true" />
        </button>
        <Switch
          checked={rule.is_active}
          disabled={saving}
          ariaLabel={`Rule ${n} active`}
          onChange={is_active => onChange({ is_active })}
        />
      </div>

      {open && (
        <div className="email-rule__editor" id={editorId} role="group" aria-label={`Rule ${n}`}>
          <div className="email-rule__grid">
            <div className="email-field">
              <label htmlFor={fieldId('bank')}>Bank</label>
              <select
                id={fieldId('bank')}
                className="admin-form-input"
                value={rule.bank_code}
                onChange={e => onChange({ bank_code: e.target.value })}
              >
                <option value="">Other (detect from the document)</option>
                {banks.map(b => (
                  <option key={b.code} value={b.code}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
              <FieldError errors={errors} prefix={`${prefix}.bank_code`} />
            </div>

            {/* Ours. Both documents arrive from the same bank carrying the same tax
                invoice number, so nothing on the page tells them apart — a settlement
                report matched by a commission rule is read with the wrong layout. */}
            <div className="email-field">
              <label htmlFor={fieldId('type')}>Document type</label>
              <select
                id={fieldId('type')}
                className="admin-form-input"
                value={rule.doc_type}
                onChange={e => onChange({ doc_type: e.target.value as EmailDocType })}
              >
                <option value="fee_invoice">Commission invoice</option>
                <option value="ar_reconcile">Settlement report (KBANK only)</option>
              </select>
              <p className="email-help">{DOC_TYPE_HELP[rule.doc_type]}</p>
              <FieldError errors={errors} prefix={`${prefix}.doc_type`} />
            </div>

            <div className="email-field">
              <label htmlFor={fieldId('sender')}>Bank sender email</label>
              <input
                id={fieldId('sender')}
                className="admin-form-input"
                type="email"
                placeholder="kmerchant@kasikornbank.com"
                value={rule.bank_sender_email}
                onChange={e => onChange({ bank_sender_email: e.target.value })}
              />
              <p className="email-help">Leave blank so a colleague&apos;s forward still matches.</p>
              <FieldError errors={errors} prefix={`${prefix}.bank_sender_email`} />
            </div>

            <div className="email-field">
              <label htmlFor={fieldId('password')}>PDF password</label>
              <input
                id={fieldId('password')}
                className="admin-form-input"
                type="password"
                autoComplete="new-password"
                value={rule.pdf_password}
                onChange={e => onChange({ pdf_password: e.target.value })}
              />
              <p className="email-help">
                {rule.has_password
                  ? 'A password is stored. Leave blank to keep it.'
                  : 'Only if the bank locks the file.'}
              </p>
              <FieldError errors={errors} prefix={`${prefix}.pdf_password`} />
            </div>

            <div className="email-field email-field--wide">
              <label htmlFor={fieldId('patterns')}>
                Filename patterns <span className="email-tag">Required</span>
              </label>
              <input
                id={fieldId('patterns')}
                className="admin-form-input email-mono"
                placeholder="MDR, Commission"
                value={rule.filename_patterns}
                onChange={e => onChange({ filename_patterns: e.target.value })}
              />
              <p className="email-help">
                Any part of the filename. Separate several with commas. <code>.pdf</code> accepts
                every PDF from this bank.
              </p>
              <FieldError errors={errors} prefix={`${prefix}.filename_patterns`} />
            </div>
          </div>

          {otherErrors.map(f => (
            <p key={f} className="email-error" role="alert">
              {errors[f]}
            </p>
          ))}

          <div className="email-rule__editor-foot">
            <Button size="sm" variant="danger" aria-label={`Remove rule ${n}`} onClick={onRemove}>
              <Trash2 size={14} aria-hidden="true" /> Remove rule
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

function Skeleton() {
  // The real page's shape — header, status line, two sections — so nothing jumps on load.
  return (
    <div className="email-settings-page" aria-busy="true" aria-label="Loading settings">
      <div className="sk-block sk-line" style={{ width: '28%', height: 26, marginBottom: 12 }} />
      <div className="sk-block sk-line" style={{ width: '46%', height: 14, marginBottom: 32 }} />
      <div className="sk-block" style={{ height: 48, borderRadius: 12, marginBottom: 40 }} />
      {[120, 150].map((height, i) => (
        <div key={i} className="email-section">
          <div>
            <div
              className="sk-block sk-line"
              style={{ width: '60%', height: 16, marginBottom: 10 }}
            />
            <div className="sk-block sk-line" style={{ width: '85%', height: 12 }} />
          </div>
          <div className="sk-block" style={{ height, borderRadius: 16 }} />
        </div>
      ))}
    </div>
  )
}

export default function EmailSettings() {
  const ctrl = useEmailSettings()
  const { draft, dirty, settings, fieldErrors, saving } = ctrl
  const [tokenInput, setTokenInput] = useState('')
  /** Which rule rows are expanded, by index into `draft.rules`. */
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  /** A rule just added, whose Bank select takes focus once it has rendered. */
  const [focusRule, setFocusRule] = useState<number | null>(null)

  // Closing or reloading the tab. Its one in-app link (Back to queue) asks on its own click.
  // ponytail: the browser's Back button is a hashchange, which nothing guards — add a router
  // guard if someone loses an edit that way.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // A rule the server refused opens itself, so the reader sees the field it is about.
  useEffect(() => {
    const failed = Object.keys(fieldErrors)
      .map(f => /^rules\[(\d+)\]/.exec(f)?.[1])
      .filter((i): i is string => i !== undefined)
      .map(Number)
    if (failed.length) setOpen(prev => new Set([...prev, ...failed]))
  }, [fieldErrors])

  useEffect(() => {
    if (focusRule === null) return
    document.getElementById(`email-rule-${focusRule}-bank`)?.focus()
    setFocusRule(null)
  }, [focusRule])

  const toggleRule = (index: number) =>
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  const setRule = (index: number, part: Partial<RuleDraft>) =>
    ctrl.patch({ rules: draft.rules.map((r, i) => (i === index ? { ...r, ...part } : r)) })

  const addRule = () => {
    const index = draft.rules.length
    ctrl.patch({ rules: [...draft.rules, { ...EMPTY_RULE }] })
    setOpen(prev => new Set(prev).add(index))
    setFocusRule(index)
  }

  const removeRule = (index: number) => {
    ctrl.patch({ rules: draft.rules.filter((_, i) => i !== index) })
    // Rows after the removed one move up a place; their open state moves with them.
    setOpen(prev => new Set([...prev].filter(i => i !== index).map(i => (i > index ? i - 1 : i))))
  }

  const discard = () => {
    ctrl.reset()
    setOpen(new Set())
  }

  const onSave = async () => {
    if (await ctrl.save()) showToast('Settings saved', 'success')
  }

  if (ctrl.loading) return <Skeleton />

  const err = ctrl.error
  const banner = err && (
    <div className="email-banner" role="alert" data-tone={err.status === 409 ? 'warn' : undefined}>
      <AlertTriangle size={16} aria-hidden="true" />
      <span>
        {err.status === 401 &&
          'Carmen did not accept your sign-in. Reopen this page from Carmen to continue. '}
        {err.status === 502 && 'Could not reach your Carmen to check your sign-in. Try again. '}
        {err.status === 429 && 'Too many requests. Wait a minute, then try again. '}
        {err.message}
      </span>
    </div>
  )

  const header = (
    <>
      <PageHeader
        title="AI JV Automation"
        description="Bank fee reports forwarded to your address are read and turned into journal entries for Carmen."
        actions={
          <>
            {/* The fix buttons arrive here in the queue's own tab, so the way back is a
                link rather than the browser's Back — and it is the one exit that can ask. */}
            <a
              className="btn btn-outline btn-sm"
              href="#/CreditCardOCR"
              onClick={e => {
                if (dirty && !window.confirm('Leave without saving your changes?')) {
                  e.preventDefault()
                }
              }}
            >
              Back to queue
            </a>
            <Button
              size="sm"
              onClick={() => void ctrl.reload()}
              disabled={saving}
              aria-label="Reload settings"
            >
              <RefreshCw size={14} aria-hidden="true" />
            </Button>
          </>
        }
      />
      {ctrl.bu && (
        <p className="email-context">
          Business unit <strong>{ctrl.bu}</strong>
          {ctrl.host && (
            <>
              {' · '}
              <span className="email-mono">{ctrl.host}</span>
            </>
          )}
        </p>
      )}
    </>
  )

  // Nothing loaded (no session, Carmen refused, unreachable): an empty form would only
  // invite a save that fails the same way, so the page says what happened and stops.
  if (!settings) {
    return (
      <div className="email-settings-page">
        {header}
        {banner}
      </div>
    )
  }

  const status = settings.status
  const ready = status.ready
  const received = status.documents_total || 0
  const address = settings.ingest_address
  const entitled = settings.entitled !== false
  const token = ctrl.tokenStatus
  const tokenTone = !token?.configured ? 'warn' : token.verified_at ? 'ok' : 'bad'

  return (
    <div className="email-settings-page">
      {header}
      {banner}

      <section
        className="email-status"
        data-tone={ready ? 'ok' : 'warn'}
        aria-label="Service status"
        aria-live="polite"
      >
        <div className="email-status__main" data-tone={ready ? 'ok' : 'warn'}>
          <span className="email-dot" aria-hidden="true" />
          <p className="email-status__text">
            <strong>{ready ? 'Receiving documents' : 'Not receiving documents yet'}</strong>
            {received > 0 && (
              <span className="email-status__meta">
                {received} document{received === 1 ? '' : 's'}
                {status.last_received_at && ` · last received ${when(status.last_received_at)}`}
              </span>
            )}
          </p>
        </div>
        {!ready && status.blockers.length > 0 && (
          <ul className="email-status__steps" aria-label="To start receiving">
            {status.blockers.map(b => {
              const step = NEXT_STEP[b] || { text: b }
              return (
                <li key={b}>
                  {step.href ? (
                    <a className="email-step" href={step.href}>
                      {step.text}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="email-step"
                      onClick={() => step.target && jumpTo(step.target)}
                    >
                      {step.text}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="email-sections">
        <Section
          id="email-address"
          title="Forwarding address"
          description="Forward bank fee reports here, with a mailbox rule or by hand. It belongs to this business unit only."
        >
          <div className="email-panel">
            {address ? (
              <div className="email-address">
                <code className="email-address__value">{address}</code>
                <Button size="sm" onClick={() => void copyAddress(address)}>
                  <Copy size={14} aria-hidden="true" /> Copy address
                </Button>
              </div>
            ) : (
              <p className="email-empty">
                Your address is created the first time you save with document processing switched
                on.
              </p>
            )}
            {settings.gmail_confirmed_at && (
              <p className="email-meta" data-tone="ok">
                <Check size={14} aria-hidden="true" />
                <span>Gmail forwarding confirmed {when(settings.gmail_confirmed_at)}</span>
              </p>
            )}
            {/* Google normally confirms the forward by link, which the poll follows itself,
                so this is only ever reached if they go back to printing a code. */}
            {settings.gmail_confirm && !settings.gmail_confirmed_at && (
              <p className="email-meta" data-tone="warn">
                Gmail asked for a confirmation code: <code>{settings.gmail_confirm.code}</code>.
                Paste it into the forwarding screen of your own Gmail.
              </p>
            )}
          </div>
        </Section>

        <Section
          id="email-processing"
          title="Processing"
          description="Whether forwarded documents are read, and whether they wait for a person before posting."
        >
          <div className="email-row">
            <div className="email-row__text">
              <span className="email-row__title">Process incoming documents</span>
              <p className="email-help">
                When off, forwarded documents are recorded but not read, and nothing is charged.
              </p>
              {!entitled && !draft.enabled && (
                <p className="email-row__note">
                  Needs an active monthly package. <a href="#/pricing">View plans</a>
                </p>
              )}
              <FieldError errors={fieldErrors} prefix="enabled" />
            </div>
            <Switch
              id="email-enabled"
              checked={draft.enabled}
              disabled={saving || (!entitled && !draft.enabled)}
              ariaLabel="Process incoming documents"
              onChange={enabled => ctrl.patch({ enabled })}
            />
          </div>

          {/* The one control that lets a document reach Carmen unseen, so the help names
              what still stops rather than reassuring. `PUT /settings` stays its one writer,
              and the hook sends the field only when this switch moved. */}
          <div className="email-row">
            <div className="email-row__text">
              <span className="email-row__title">Post without review</span>
              <p className="email-help">
                Documents with nothing to check post to Carmen on their own. Switch it on once the
                review queue has been getting documents right.
              </p>
              <p className="email-help email-help--quiet">
                Always waits for review: a warning, a guessed GL mapping, unbalanced amounts, a
                missing document number, an unmapped payment type.
              </p>
            </div>
            <Switch
              checked={draft.auto_post}
              disabled={saving}
              ariaLabel="Post without review"
              onChange={auto_post => ctrl.patch({ auto_post })}
            />
          </div>
        </Section>

        <Section
          id="email-rules"
          title="Bank rules"
          description={
            <>
              Only attachments that match a rule are read and charged. Start broad, then narrow:{' '}
              <code>.pdf</code> accepts every PDF from that bank.
            </>
          }
        >
          {draft.rules.length > 0 ? (
            <>
              <div className="email-rules__head" aria-hidden="true">
                <div className="email-rules__cols">
                  <span>Bank</span>
                  <span>Document type</span>
                  <span>Filename patterns</span>
                </div>
                <span>Active</span>
              </div>
              <ul className="email-rules__list">
                {draft.rules.map((rule, i) => (
                  <RuleRow
                    key={i}
                    rule={rule}
                    index={i}
                    open={open.has(i)}
                    banks={ctrl.banks}
                    errors={fieldErrors}
                    saving={saving}
                    onToggle={() => toggleRule(i)}
                    onChange={part => setRule(i, part)}
                    onRemove={() => removeRule(i)}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="email-rules__empty">
              No rules yet, so nothing is read. Add one rule for each bank that sends you fee
              reports.
            </p>
          )}
          <div className="email-rules__foot">
            <Button id="email-add-rule" size="sm" onClick={addRule} disabled={saving}>
              <Plus size={14} aria-hidden="true" /> Add rule
            </Button>
          </div>
        </Section>

        <Section
          id="email-company"
          title="Your company"
          description="Confirms that a document belongs to this business unit, and can limit who may send one."
        >
          <div className="email-panel">
            <div className="email-field">
              <label htmlFor="email-tax-ids">
                Company tax IDs <span className="email-tag">Required</span>
              </label>
              <textarea
                id="email-tax-ids"
                className="admin-form-input email-mono"
                rows={2}
                placeholder="0105536000127"
                value={draft.tax_ids}
                onChange={e => ctrl.patch({ tax_ids: e.target.value })}
              />
              <p className="email-help">
                13 digits each, separated by commas or new lines. A document printing another
                business unit&apos;s tax ID waits for review instead of posting.
              </p>
              <FieldError errors={fieldErrors} prefix="tax_ids" />
            </div>

            {/* Named the way the queue names it ("Sender is not one of your email addresses"),
                so a reader sent here by that row's fix button finds the field they were told. */}
            <div className="email-field">
              <label htmlFor="email-owner-emails">
                Your email addresses <span className="email-tag">Optional</span>
              </label>
              <textarea
                id="email-owner-emails"
                className="admin-form-input"
                rows={2}
                placeholder="accounting@yourcompany.com"
                value={draft.owner_emails}
                onChange={e => ctrl.patch({ owner_emails: e.target.value })}
              />
              <p className="email-help">
                Leave empty to accept mail from any sender. If you add addresses, include the
                mailbox your bank mail arrives at and everyone who forwards by hand.
              </p>
              <FieldError errors={fieldErrors} prefix="owner_emails" />
            </div>
          </div>
        </Section>

        <Section
          id="email-credential"
          title="Posting credential"
          description="The key Carmen issues so approved and automatic entries can post."
        >
          {/* Carmen issues it (its menu mints one before opening this page,
              CARMEN_INTEGRATION.md §2.8), so the customer reads its status and nothing more.
              Pasting one by hand is support's fallback, folded away so a customer is not
              handed a box they have nothing to put in. */}
          <div className="email-panel">
            <p className="email-cred" data-tone={tokenTone}>
              <span className="email-dot" aria-hidden="true" />
              <strong>
                {tokenTone === 'ok'
                  ? 'Connected'
                  : tokenTone === 'bad'
                    ? 'No longer accepted by Carmen'
                    : 'Not connected'}
              </strong>
              {token?.configured && token.fingerprint && (
                <span className="email-mono email-cred__fp">{token.fingerprint}</span>
              )}
              {tokenTone === 'ok' && token?.verified_at && (
                <span className="email-cred__meta">checked {when(token.verified_at)}</span>
              )}
            </p>
            {tokenTone !== 'ok' && (
              <p className="email-help">
                Nothing can post until Carmen connects this business unit. Reopen this page from
                Carmen&apos;s menu, or contact support.
              </p>
            )}
            <details className="email-manual-token">
              <summary>
                <ChevronRight
                  className="email-manual-token__chevron"
                  size={14}
                  aria-hidden="true"
                />
                Set a token manually
              </summary>
              <div className="email-copyrow">
                <input
                  className="admin-form-input"
                  type="password"
                  placeholder="Paste the Carmen token JVs are posted with"
                  aria-label="Carmen posting token"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  autoComplete="new-password"
                />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!tokenInput.trim() || saving}
                  onClick={async () => {
                    if (await ctrl.saveToken(tokenInput.trim())) {
                      setTokenInput('')
                      showToast('Token checked and stored', 'success')
                    }
                  }}
                >
                  Save token
                </Button>
                {token?.configured && (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={saving}
                    onClick={() => {
                      // Deleting our copy stops every JV of this BU from posting, and it does
                      // not revoke the token in Carmen — worth one question.
                      if (
                        window.confirm(
                          'Delete the stored token? Documents will stop posting until a new one is set.'
                        )
                      ) {
                        void ctrl.removeToken()
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </details>
          </div>
        </Section>
      </div>

      <div className="email-actionbar" data-dirty={dirty || undefined}>
        <span className="email-actionbar__state" aria-live="polite">
          {saving ? 'Saving changes…' : dirty ? 'You have unsaved changes' : 'No unsaved changes'}
        </span>
        <Button size="sm" onClick={discard} disabled={!dirty || saving}>
          Discard changes
        </Button>
        <Button
          id="email-save"
          size="sm"
          variant="primary"
          disabled={!dirty || saving}
          onClick={() => void onSave()}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
