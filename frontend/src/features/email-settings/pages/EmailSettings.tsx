/**
 * AI JV Automation settings — the customer's one screen for this feature (decision #34,
 * 2026-10-01; CARMEN_INTEGRATION.md §2.8).
 *
 * **Two ways in, both deliberate.** Carmen's menu opens it through the same SSO link as the
 * queue (`#/CreditCardOCR/email-settings?token=&posting_token=&bu=&uri=`), carrying a BU
 * posting token minted fresh for this open, which the hook stores first (decision #35); and
 * the queue's fix buttons open it in this tab. Carmen decides who sees its
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
 * section names its purpose in one sentence on the left and holds its controls in one card on
 * the right. Inside the cards the page shows only state, controls and errors: our own staff
 * set it up at onboarding, so each field's explanation sits behind an (i) beside its label
 * (`InfoTip`). Bank rules are one summary row each, edited in place, so a BU with five banks
 * can see all five at once. Every control still edits the hook's single draft, saved by one
 * sticky bar.
 *
 * English only, as CLAUDE.md makes English the default for a new surface.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import Tooltip from '@/shared/components/common/Tooltip'
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

/** Behind the select's (i), so the option text stays short enough for a half-width field. */
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

/**
 * The explanation behind a heading or a label, on demand.
 *
 * Our own staff set this page up at onboarding, so it shows only state, controls and errors;
 * the why lives here (2026-10-01). Hover or keyboard focus shows it, a tap focuses it on a
 * phone, Escape hides it, and `aria-describedby` reads it to a screen reader. Kept outside the
 * `<label>` it sits beside, so the input's accessible name does not grow an "About …".
 */
function InfoTip({ label, text }: { label: string; text: string }) {
  const id = useId()
  return (
    <Tooltip text={text} multiline id={id} position="top-right">
      <button type="button" className="email-info" aria-label={label} aria-describedby={id}>
        <Info size={14} aria-hidden="true" />
      </button>
    </Tooltip>
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

/** A section: its title and one-sentence purpose in the intro column, its controls in one
 *  card beside it. The sentence stays visible (the column would be empty without it); the
 *  field-level detail inside the card is what moved behind (i). */
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

/** One rule as a summary row. The row opens the rule dialog; the switch beside it (outside
 *  the button: no control inside a control) turns the rule on or off and saves at once. */
function RuleRow({
  rule,
  index,
  banks,
  errors,
  saving,
  onOpen,
  onToggleActive,
}: {
  rule: RuleDraft
  index: number
  banks: BankCode[]
  errors: Record<string, string>
  saving: boolean
  onOpen: () => void
  onToggleActive: (active: boolean) => void
}) {
  const n = index + 1
  const bank = banks.find(b => b.code === rule.bank_code)
  const patterns = splitList(rule.filename_patterns)
  const ruleErrors = Object.keys(errors).filter(f => f.startsWith(`rules[${index}]`))

  return (
    <li className="email-rule" data-inactive={!rule.is_active || undefined}>
      <div className="email-rule__summary">
        <button
          type="button"
          className="email-rule__toggle"
          aria-haspopup="dialog"
          onClick={onOpen}
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
          <ChevronRight className="email-rule__chevron" size={16} aria-hidden="true" />
        </button>
        <Switch
          checked={rule.is_active}
          disabled={saving}
          ariaLabel={`Rule ${n} active`}
          onChange={onToggleActive}
        />
      </div>
    </li>
  )
}

/** Every focusable element inside `root`, in DOM order — what Tab may land on. */
const focusablesIn = (root: HTMLElement | null) =>
  [
    ...(root?.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]'
    ) ?? []),
  ].filter(el => el.tabIndex >= 0 && !el.hasAttribute('disabled'))

/**
 * Add or edit one bank rule, saved the moment its primary button is pressed (2026-10-01).
 *
 * A dialog rather than a row that expands in place: a rule is a small self-contained record,
 * and an expanding row added at the bottom of the list opened its form beside the save bar,
 * a scroll away from where the user pressed Add rule. The page's other unsaved edits are left
 * alone (`saveRules` sends the server's copy of them), and a refused save keeps the dialog open
 * with the server's message under the field it names.
 *
 * The shell follows `PaymentMappingDialog` and `CustomModal`: portal, `aria-modal`, Tab kept
 * inside, Escape and the backdrop close, focus goes back to whatever opened it.
 * ponytail: third copy of that focus trap; make it a shared hook if a fourth dialog needs it.
 */
function RuleDialog({
  index,
  errorIndex,
  initial,
  banks,
  errors,
  serverError,
  saving,
  onSave,
  onRemove,
  onClose,
}: {
  /** null = a new rule, appended at the end. */
  index: number | null
  /** Where the server reports this rule's errors: its own index, or the end of the list
   *  for a new one (the index it took in the payload that was refused). */
  errorIndex: number
  initial: RuleDraft
  banks: BankCode[]
  errors: Record<string, string>
  serverError: string | null
  saving: boolean
  onSave: (rule: RuleDraft) => Promise<boolean>
  onRemove: () => Promise<boolean>
  onClose: () => void
}) {
  const [rule, setRule] = useState<RuleDraft>(initial)
  /** A page-level error is this dialog's to show only once this dialog has tried to save. */
  const [attempted, setAttempted] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const isNew = index === null
  const prefix = `rules[${errorIndex}]`
  const ruleErrors = Object.keys(errors).filter(f => f.startsWith(prefix))
  const otherErrors = ruleErrors.filter(f => !RULE_FIELDS.some(k => f.startsWith(`${prefix}.${k}`)))
  const touched = JSON.stringify(rule) !== JSON.stringify(initial)
  const canSave = splitList(rule.filename_patterns).length > 0 && !saving
  const fieldId = (name: string) => `email-rule-dialog-${name}`
  const set = (part: Partial<RuleDraft>) => setRule(prev => ({ ...prev, ...part }))

  // Open on the first field; give the keyboard back to the opener on close (unmount).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    document.getElementById('email-rule-dialog-bank')?.focus()
    return () => opener?.focus()
  }, [])

  const close = () => {
    if (touched && !window.confirm('Discard this rule?')) return
    onClose()
  }
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  // On the document, not the overlay: while a save runs its button is disabled, which drops
  // focus to <body>, and a key pressed there never reaches the dialog's own handler. Escape
  // closes from anywhere; Tab from outside the box comes back into it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const stops = focusablesIn(dialogRef.current)
      if (!stops.length) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      const at = document.activeElement
      const outside = !dialogRef.current?.contains(at)
      if (outside || (e.shiftKey ? at === first || at === dialogRef.current : at === last)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const title = isNew ? 'Add bank rule' : `Edit ${initial.bank_code || 'Other'} rule`

  return createPortal(
    <div className="email-dialog-overlay">
      <button
        type="button"
        className="email-dialog-backdrop"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
      />
      <div
        ref={dialogRef}
        className="email-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="email-dialog__head">
          <h2 id={titleId} className="email-dialog__title">
            {title}
          </h2>
        </header>

        <div className="email-dialog__body">
          {attempted && !saving && serverError && ruleErrors.length === 0 && (
            <p className="email-dialog__error" role="alert">
              {serverError}
            </p>
          )}
          <div className="email-rule__grid">
            <div className="email-field">
              <label htmlFor={fieldId('bank')}>Bank</label>
              <select
                id={fieldId('bank')}
                className="admin-form-input"
                value={rule.bank_code}
                onChange={e => set({ bank_code: e.target.value })}
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
              <div className="email-label-row">
                <label htmlFor={fieldId('type')}>Document type</label>
                <InfoTip label="About document type" text={DOC_TYPE_HELP[rule.doc_type]} />
              </div>
              <select
                id={fieldId('type')}
                className="admin-form-input"
                value={rule.doc_type}
                onChange={e => set({ doc_type: e.target.value as EmailDocType })}
              >
                <option value="fee_invoice">Commission invoice</option>
                <option value="ar_reconcile">Settlement report (KBANK only)</option>
              </select>
              <FieldError errors={errors} prefix={`${prefix}.doc_type`} />
            </div>

            <div className="email-field">
              <div className="email-label-row">
                <label htmlFor={fieldId('sender')}>Bank sender email</label>
                <InfoTip
                  label="About bank sender email"
                  text="Leave blank so a colleague's forward still matches."
                />
              </div>
              <input
                id={fieldId('sender')}
                className="admin-form-input"
                type="email"
                placeholder="kmerchant@kasikornbank.com"
                value={rule.bank_sender_email}
                onChange={e => set({ bank_sender_email: e.target.value })}
              />
              <FieldError errors={errors} prefix={`${prefix}.bank_sender_email`} />
            </div>

            <div className="email-field">
              <div className="email-label-row">
                <label htmlFor={fieldId('password')}>PDF password</label>
                <InfoTip label="About PDF password" text="Only if the bank locks the file." />
              </div>
              {/* A stored password is state, not explanation, so it shows in the field. */}
              <input
                id={fieldId('password')}
                className="admin-form-input"
                type="password"
                autoComplete="new-password"
                placeholder={rule.has_password ? 'Stored. Leave blank to keep it.' : undefined}
                value={rule.pdf_password}
                onChange={e => set({ pdf_password: e.target.value })}
              />
              <FieldError errors={errors} prefix={`${prefix}.pdf_password`} />
            </div>

            <div className="email-field email-field--wide">
              <div className="email-label-row">
                <label htmlFor={fieldId('patterns')}>
                  Filename patterns <span className="email-tag">Required</span>
                </label>
                <InfoTip
                  label="About filename patterns"
                  text="Any part of the filename. Separate several with commas. .pdf accepts every PDF from this bank."
                />
              </div>
              <input
                id={fieldId('patterns')}
                className="admin-form-input email-mono"
                placeholder="MDR, Commission"
                value={rule.filename_patterns}
                onChange={e => set({ filename_patterns: e.target.value })}
              />
              <FieldError errors={errors} prefix={`${prefix}.filename_patterns`} />
            </div>
          </div>

          {otherErrors.map(f => (
            <p key={f} className="email-error" role="alert">
              {errors[f]}
            </p>
          ))}
        </div>

        <footer className="email-dialog__foot">
          {!isNew && (
            <Button
              size="sm"
              variant="danger"
              disabled={saving}
              onClick={async () => {
                if (!window.confirm(`Remove the ${initial.bank_code || 'Other'} rule?`)) return
                setAttempted(true)
                if (await onRemove()) onClose()
                else dialogRef.current?.focus()
              }}
            >
              <Trash2 size={14} aria-hidden="true" /> Remove rule
            </Button>
          )}
          <span className="email-dialog__spacer" />
          <Button size="sm" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!canSave}
            onClick={async () => {
              setAttempted(true)
              if (await onSave(rule)) onClose()
              // Refused: the button was disabled mid-save, so focus fell out of the box.
              else dialogRef.current?.focus()
            }}
          >
            {saving ? 'Saving…' : isNew ? 'Add rule' : 'Save rule'}
          </Button>
        </footer>
      </div>
    </div>,
    document.body
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
  /** The rule dialog: closed, a new rule (`index: null`), or the rule at `index`. */
  const [dialog, setDialog] = useState<{ index: number | null } | null>(null)

  // Closing or reloading the tab. Its one in-app link (Back to queue) asks on its own click.
  // ponytail: the browser's Back button is a hashchange, which nothing guards — add a router
  // guard if someone loses an edit that way.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Every rule change saves at once (`saveRules`), so `draft.rules` is always the server's
  // list and its indexes are the ones a refusal's `rules[i]` errors name.
  const saveRule = async (index: number | null, rule: RuleDraft) => {
    const rules =
      index === null ? [...draft.rules, rule] : draft.rules.map((r, i) => (i === index ? rule : r))
    const ok = await ctrl.saveRules(rules)
    if (ok) showToast(index === null ? 'Rule added' : 'Rule saved', 'success')
    return ok
  }

  const removeRule = async (index: number) => {
    const ok = await ctrl.saveRules(draft.rules.filter((_, i) => i !== index))
    if (ok) showToast('Rule removed', 'success')
    return ok
  }

  const toggleActive = async (index: number, is_active: boolean) => {
    const name = draft.rules[index].bank_code || 'Other'
    const ok = await ctrl.saveRules(
      draft.rules.map((r, i) => (i === index ? { ...r, is_active } : r))
    )
    if (ok) showToast(`${name} rule switched ${is_active ? 'on' : 'off'}`, 'success')
  }

  const onSave = async () => {
    if (await ctrl.save()) showToast('Settings saved', 'success')
  }

  if (ctrl.loading) return <Skeleton />

  const err = ctrl.error
  // Up here, not only on the credential card at the foot of the page: minting the token that
  // failed to store already killed the old one, so nothing posts until this is fixed.
  const banner = err ? (
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
  ) : (
    ctrl.tokenError && (
      <div className="email-banner" role="alert">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>
          The posting token Carmen just sent could not be stored: {ctrl.tokenError}. Nothing will
          post until it is. Press Reload to try again, or reopen this page from Carmen&apos;s menu.
        </span>
      </div>
    )
  )

  const header = (
    <>
      <PageHeader
        title="AI JV Automation"
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
  const tokenTone =
    ctrl.tokenError || (token?.configured && !token.verified_at)
      ? 'bad'
      : token?.configured
        ? 'ok'
        : 'warn'

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
              <div className="email-label-row">
                <span className="email-row__title">Process incoming documents</span>
                <InfoTip
                  label="About processing incoming documents"
                  text="When off, forwarded documents are recorded but not read, and nothing is charged."
                />
              </div>
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

          {/* The one control that lets a document reach Carmen unseen, so its help names what
              still stops rather than reassuring. `PUT /settings` stays its one writer, and the
              hook sends the field only when this switch moved. */}
          <div className="email-row">
            <div className="email-row__text">
              <div className="email-label-row">
                <span className="email-row__title">Post without review</span>
                <InfoTip
                  label="About posting without review"
                  text="Documents with nothing to check post to Carmen on their own. Switch it on once the review queue has been getting documents right. Always waits for review: a warning, a guessed GL mapping, unbalanced amounts, a missing document number, an unmapped payment type."
                />
              </div>
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
                    banks={ctrl.banks}
                    errors={fieldErrors}
                    saving={saving}
                    onOpen={() => setDialog({ index: i })}
                    onToggleActive={active => void toggleActive(i, active)}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="email-rules__empty">
              No rules yet. Add one for each bank that sends fee reports.
            </p>
          )}
          <div className="email-rules__foot">
            <Button
              id="email-add-rule"
              size="sm"
              aria-haspopup="dialog"
              onClick={() => setDialog({ index: null })}
              disabled={saving}
            >
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
              <div className="email-label-row">
                <label htmlFor="email-tax-ids">
                  Company tax IDs <span className="email-tag">Required</span>
                </label>
                <InfoTip
                  label="About company tax IDs"
                  text="13 digits each, separated by commas or new lines. A document printing another business unit's tax ID waits for review instead of posting."
                />
              </div>
              <textarea
                id="email-tax-ids"
                className="admin-form-input email-mono"
                rows={2}
                placeholder="0105536000127"
                value={draft.tax_ids}
                onChange={e => ctrl.patch({ tax_ids: e.target.value })}
              />
              <FieldError errors={fieldErrors} prefix="tax_ids" />
            </div>

            {/* Named the way the queue names it ("Sender is not one of your email addresses"),
                so a reader sent here by that row's fix button finds the field they were told. */}
            <div className="email-field">
              <div className="email-label-row">
                <label htmlFor="email-owner-emails">
                  Your email addresses <span className="email-tag">Optional</span>
                </label>
                <InfoTip
                  label="About your email addresses"
                  text="Leave empty to accept mail from any sender. If you add addresses, include the mailbox your bank mail arrives at and everyone who forwards by hand."
                />
              </div>
              <textarea
                id="email-owner-emails"
                className="admin-form-input"
                rows={2}
                placeholder="accounting@yourcompany.com"
                value={draft.owner_emails}
                onChange={e => ctrl.patch({ owner_emails: e.target.value })}
              />
              <FieldError errors={fieldErrors} prefix="owner_emails" />
            </div>
          </div>
        </Section>

        <Section
          id="email-credential"
          title="Posting credential"
          description="The key Carmen issues so approved and automatic entries can post."
        >
          {/* Carmen issues it (its menu mints a fresh one on every open and passes it in the
              link, CARMEN_INTEGRATION.md §2.8), so the customer reads its status and nothing more.
              Pasting one by hand is support's fallback, folded away so a customer is not
              handed a box they have nothing to put in. */}
          <div className="email-panel">
            <p className="email-cred" data-tone={tokenTone}>
              <span className="email-dot" aria-hidden="true" />
              <strong>
                {ctrl.tokenError
                  ? 'New token from Carmen not stored'
                  : tokenTone === 'ok'
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
        <Button size="sm" onClick={ctrl.reset} disabled={!dirty || saving}>
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

      {dialog && (
        <RuleDialog
          index={dialog.index}
          errorIndex={dialog.index ?? draft.rules.length}
          initial={dialog.index === null ? EMPTY_RULE : draft.rules[dialog.index]}
          banks={ctrl.banks}
          errors={fieldErrors}
          serverError={err?.message ?? null}
          saving={saving}
          onSave={rule => saveRule(dialog.index, rule)}
          onRemove={() =>
            dialog.index === null ? Promise.resolve(false) : removeRule(dialog.index)
          }
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
