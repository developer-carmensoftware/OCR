import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Scale } from 'lucide-react'
import '../styles/pages/ar-reconcile.css'
import ARJvPreview from '../components/ar-reconcile/ARJvPreview'
import ARMappingTable from '../components/ar-reconcile/ARMappingTable'
import AppHeader from '../components/common/AppHeader'
import CustomModal from '../components/common/CustomModal'
import CustomSearchSelect from '../components/common/CustomSearchSelect'
import SwapLabel from '../components/common/SwapLabel'
import UsageIndicator from '../components/common/UsageIndicator'
import Button from '../components/admin/ui/Button'
import Card from '../components/admin/ui/Card'
import Switch from '../components/admin/ui/Switch'
import { useT } from '../i18n/LanguageContext'
import { useARReconcile } from '../hooks/ar-reconcile'
import { POST_TYPES, type PostType } from '../lib/api/arReconcile'
import { allowedAccountsForDept } from '../lib/deptAccounts'

/**
 * Detailed Credit Card AR Reconciliation — per-bank settings.
 *
 * The module's third screen, so it wears the module's chrome: `AppHeader` inside
 * `.app-container`, the same as the queue it is reached from and the wizard beside it.
 * Its own name is the header's title and the header's Back button names where it goes,
 * which is why there is no second heading below it.
 *
 * Two columns from 1200px up, the JV preview being the sticky right one: the whole value
 * of the Detail/Summary control is watching seven credit lines collapse into three *while*
 * it is flipped, and with the preview at the foot of the form those were two scrolls
 * apart. Below 1200px it stacks and the preview lands last, where it used to be.
 */

const QUEUE = '#/CreditCardOCR'

const TAGS = ['{Settlement_Date}', '{Tax_Invoice_No}', '{Bank_Name}'] as const

export default function ARReconcileSettings() {
  const ctrl = useARReconcile()
  const { t } = useT()
  const [leaving, setLeaving] = useState(false)

  // A long form with one Save at the foot of it, and the header's Back button above it.
  // Closing the tab asks; Back asks separately, because a hash navigation never fires
  // this event.
  useEffect(() => {
    if (!ctrl.dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [ctrl.dirty])

  const postTypeLabel = (pt: PostType) =>
    t(pt === 'Detail' ? 'review.arPostTypeDetail' : 'review.arPostTypeSummary')

  // The most convenient click on the screen, and it is a hash navigation — so it is the
  // one that has to ask rather than the one that gets away with not asking.
  const leave = () => {
    if (ctrl.dirty) setLeaving(true)
    else window.location.hash = QUEUE
  }

  const header = (
    <AppHeader
      module="credit-card"
      moduleName={t('ar.title')}
      eyebrow="Carmen Cloud · Credit Card"
      onBack={leave}
      backLabel={t('review.title')}
    >
      <UsageIndicator />
    </AppHeader>
  )

  if (ctrl.loading) {
    return (
      <div className="app-container">
        {header}
        <div className="ar-page" aria-busy="true">
          {[96, 280, 220].map((height, i) => (
            <div
              key={i}
              className="sk-block"
              style={{ height, borderRadius: 16, marginBottom: 20 }}
            />
          ))}
        </div>
      </div>
    )
  }

  const debitAccounts = allowedAccountsForDept(
    ctrl.debit.dept,
    ctrl.masterDepartments,
    ctrl.masterAccounts
  )
  const debitDiverged =
    !!ctrl.debitDefault &&
    (ctrl.debitDefault.dept !== ctrl.debit.dept || ctrl.debitDefault.acc !== ctrl.debit.acc)

  return (
    <div className="app-container">
      {header}

      <CustomModal
        show={leaving}
        type="warning"
        confirmVariant="danger"
        title={t('ar.leaveTitle')}
        message={t('ar.leaveMessage')}
        confirmText={t('ar.leaveConfirm')}
        cancelText={t('ar.leaveCancel')}
        onConfirm={() => {
          window.location.href = QUEUE
        }}
        onCancel={() => setLeaving(false)}
      />

      <div className="ar-page">
        {/* Which bank this whole page is about, and whether it is switched on — the scope
            of every card below, so it sits above them rather than inside the first one. */}
        <div className="ar-bar">
          <p className="ar-intro">{t('ar.intro')}</p>
          <div className="ar-bar-controls">
            <div className="ar-field">
              <label htmlFor="ar-bank">{t('ar.bank')}</label>
              <select
                id="ar-bank"
                className="admin-form-input"
                value={ctrl.bankCode}
                onChange={e => ctrl.setBankCode(e.target.value)}
              >
                {/* Options and their phase both come from the server: the names from the
                    `banks` table, `supported` from its own SUPPORTED_BANKS. An unsupported
                    bank is listed and disabled rather than hidden — FRD Out-of-Scope puts
                    SCB, BBL and BAY in Phase 2, and saying so is the point of listing them. */}
                {ctrl.banks.map(b => (
                  <option key={b.code} value={b.code} disabled={!b.supported}>
                    {b.code} — {b.name}
                    {b.supported ? '' : ` — ${t('ar.phase2')}`}
                  </option>
                ))}
              </select>
            </div>
            {/* The switch is a button, so there is nothing for a `<label htmlFor>` to point
                at; its caption reaches it as the accessible name instead. */}
            <Switch checked={ctrl.enabled} onChange={ctrl.setEnabled} label={t('ar.enabled')} />
          </div>
        </div>

        {/* Said only when it is true. "Off costs nothing" under a switch that is on is a
            sentence about a state the reader is not in. */}
        {!ctrl.enabled && <p className="ar-hint ar-hint-warn">{t('ar.enabledOffHint')}</p>}

        <div className="ar-grid">
          <div className="ar-col">
            {/* The three controls the review dialog's AR reconciliation settings link
                sends people here for, and nothing else. */}
            <Card title={t('ar.postingRules')} icon={<Scale size={16} />}>
              <fieldset className="ar-field ar-posttype">
                <legend>{t('ar.postType')}</legend>
                <div className="segmented-control" role="radiogroup" aria-label={t('ar.postType')}>
                  {POST_TYPES.map(pt => (
                    <button
                      key={pt}
                      type="button"
                      role="radio"
                      aria-checked={ctrl.postType === pt}
                      className={`segmented-btn ${ctrl.postType === pt ? 'active' : ''}`}
                      onClick={() => ctrl.setPostType(pt)}
                    >
                      <span className="ar-seg-name">{postTypeLabel(pt)}</span>
                      <span className="ar-seg-count">
                        {t('ar.postTypeMapped', {
                          mapped: ctrl.mappedCount(pt),
                          total: ctrl.rowCount(pt),
                        })}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="ar-hint">
                  {ctrl.postType === 'Detail'
                    ? t('ar.postTypeHintDetail')
                    : t('ar.postTypeHintSummary')}{' '}
                  {t('ar.postTypeHintShared')}
                </p>
              </fieldset>

              <div className="ar-field">
                {/* The tag chips are buttons, so they cannot live inside a `<label>` —
                    hence `htmlFor` rather than wrapping the control. */}
                <label htmlFor="ar-template">{t('ar.template')}</label>
                <input
                  id="ar-template"
                  type="text"
                  className="admin-form-input ar-mono"
                  value={ctrl.template}
                  onChange={e => ctrl.setTemplate(e.target.value)}
                  onBlur={ctrl.refreshPreview}
                />
                <div className="ar-tags">
                  <span className="ar-tags-label">{t('ar.templateTags')}</span>
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
                {/* The template is written in tokens, so it cannot be read back from the
                    field. This is the server's own rendering of it, from the same preview
                    call the JV beside it is built from — one description on the page, and
                    the reason the preview panel no longer prints a second copy. */}
                <p className="ar-example">
                  <span className="ar-example-label">{t('ar.templateExample')}</span>
                  <span className="ar-example-value">
                    {ctrl.preview?.description || t('ar.templateEmpty')}
                  </span>
                </p>
              </div>

              <div className="ar-field">
                {/* A `<label>` with no control to point at is a label of nothing. The two
                    pickers below are a group, so it names the group — the same job
                    `<legend>` does for Post type above. */}
                <span className="ar-field-label" id="ar-debit-label">
                  {t('ar.debit')}
                </span>
                <div className="ar-debit-grid" role="group" aria-labelledby="ar-debit-label">
                  <CustomSearchSelect
                    value={ctrl.debit.dept}
                    onChange={val => ctrl.setDebit({ ...ctrl.debit, dept: val })}
                    options={ctrl.masterDepartments}
                    placeholder={t('review.jvDeptPlaceholder')}
                  />
                  <CustomSearchSelect
                    value={ctrl.debit.acc}
                    onChange={val => ctrl.setDebit({ ...ctrl.debit, acc: val })}
                    options={debitAccounts}
                    placeholder={t('review.jvAccountPlaceholder')}
                  />
                </div>
                {debitDiverged ? (
                  <p className="ar-hint ar-hint-warn">
                    {t('ar.debitDiverged', {
                      dept: ctrl.debitDefault?.dept || '—',
                      acc: ctrl.debitDefault?.acc || '—',
                    })}
                  </p>
                ) : (
                  <p className="ar-hint">{t('ar.debitHint')}</p>
                )}
              </div>
            </Card>

            <ARMappingTable ctrl={ctrl} />
          </div>

          <div className="ar-rail">
            <ARJvPreview
              preview={ctrl.preview}
              loading={ctrl.previewLoading}
              postTypeLabel={postTypeLabel(ctrl.postType)}
            />
          </div>
        </div>

        <div className="ui-actionbar">
          {/* Says which of the two states the button is in, rather than leaving a disabled
              control to be read as broken. */}
          <p className="ar-save-state" role="status">
            {ctrl.dirty ? t('ar.unsaved') : t('ar.allSaved')}
          </p>
          <Button
            variant="primary"
            onClick={() => void ctrl.save()}
            disabled={ctrl.saving || !ctrl.dirty}
          >
            {ctrl.saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <SwapLabel active={ctrl.saving} idle={t('ar.save')} busy={t('ar.savingLabel')} />
          </Button>
          <Button onClick={ctrl.reset} disabled={ctrl.saving || !ctrl.dirty}>
            {t('ar.reset')}
          </Button>
        </div>
      </div>
    </div>
  )
}
