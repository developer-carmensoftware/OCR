/**
 * The figures the purchase tour narrates.
 *
 * These are not drawings of the product — they mount the product. `PlanCard`,
 * `PackList`, `StepWizard`, `ProformaDocument` and `PendingOrderBanner` are the
 * same components `#/pricing` renders, fed sample data from ./fixtures.ts; where
 * a component is too coupled to mount (CheckoutFlow owns a fetch and a hook
 * whose phase has no prop), the markup is rebuilt on its real class names. So
 * the tour uses the app's tokens, type, spacing and dark mode by construction,
 * and cannot drift into looking like a different product.
 *
 * Everything is rendered inside the modal's `inert` canvas: no click, no focus,
 * no keyboard. That is what stops ProformaDocument's Print button, SlipUpload's
 * file picker and the banner's cancel action from doing anything real — do not
 * rely on `disabled` props here. It is also why a figure that needs a component
 * in a post-interaction state has to be handed it (`DEMO_SLIP`).
 *
 * The canvas is pinned to the real page width and scaled to fit the stage, so
 * these lay out exactly as they do at `#/pricing` on a desktop.
 */

import { ChevronRight, Coins, Languages, ShieldCheck, UploadCloud } from 'lucide-react'
import { PlanCard, EnterpriseCard } from '../PlanCard'
import PackList from '../PackList'
import PendingOrderBanner from '../PendingOrderBanner'
import ProformaDocument from '../ProformaDocument'
import StepWizard from '../../common/StepWizard'
import { Spot } from '../../tutorial'
import { useT } from '../../../i18n/LanguageContext'
import { PLAN_META } from '../../../constants/billing'
import { formatThb } from '../../../lib/money'
import logo from '../../../assets/logo.png'
import {
  DEMO_BUYER,
  DEMO_ORDER,
  DEMO_PACKS,
  DEMO_PAYMENT_INFO,
  DEMO_PLANS,
  DEMO_PROFORMA,
  DEMO_SLIP,
  noop,
} from './fixtures'

/* ── Page chrome ───────────────────────────────────────────────────────────── */

/**
 * The app header. Not `<AppHeader>` itself: it mounts NotificationBell whenever
 * the user is signed in (a fetch, a 60s poll, a localStorage read) and opens its
 * overflow menu with the popover API, which would land in the top layer above
 * the modal. Same classes, so the same pixels.
 */
function MockHeader({
  eyebrow,
  title,
  back,
  children,
}: {
  eyebrow: string
  title: string
  back: string
  children?: React.ReactNode
}) {
  return (
    <header className="app-header">
      <span className="app-header-back">← {back}</span>
      <div className="app-header-sep" aria-hidden="true" />
      <div className="brand">
        <div className="logo-box">
          <img src={logo} alt="" className="logo-img" />
        </div>
        <div className="brand-text">
          <div className="app-header-eyebrow">{eyebrow}</div>
          <h1 className="app-header-title">{title}</h1>
        </div>
      </div>
      <div className="app-header-actions">
        <div className="app-header-menu">{children}</div>
      </div>
    </header>
  )
}

/**
 * The Plans | History control, as rendered on #/pricing — including the inline
 * `width: auto`. `.segmented-control` is full-width by default, and leaving that
 * off is what pushed the Buy chip out of `.app-header`'s `overflow: hidden`.
 */
function MockSegmented() {
  const { t } = useT()
  return (
    <div className="segmented-control" style={{ margin: 0, maxHeight: 36, width: 'auto' }}>
      <button type="button" className="segmented-btn active">
        {t('nav.plans')}
      </button>
      <button type="button" className="segmented-btn">
        {t('nav.history')}
      </button>
      <span className="segmented-indicator" style={{ width: 'calc(50% - 4px)', left: 2 }} />
    </div>
  )
}

/** LanguageToggle's markup, element for element. */
function MockLang() {
  const { lang } = useT()
  return (
    <button type="button" className="lang-toggle">
      <Languages size={15} strokeWidth={2} />
      <span className="lang-toggle__code">{lang === 'en' ? 'EN' : 'ไทย'}</span>
      <span className="lang-toggle__name">{lang === 'en' ? 'English' : 'ไทย'}</span>
    </button>
  )
}

/** The pricing header, shared by five of the six figures. */
function PricingHeader({ children }: { children?: React.ReactNode }) {
  const { t } = useT()
  return (
    <MockHeader
      eyebrow="Carmen Cloud · AI Automation"
      title={t('nav.plansCredits')}
      back={t('nav.back')}
    >
      {children}
      <MockLang />
    </MockHeader>
  )
}

/* ── 1 · the Buy chip in the wizard header ─────────────────────────────────── */

function BuyChipFigure() {
  const { t } = useT()
  return (
    <div className="app-container">
      <MockHeader eyebrow="Carmen Cloud · Credit Card" title="AI JV Automation" back="Carmen">
        <Spot id="buy-btn">
          {/* UsageIndicator's markup; the component itself fetches /usage. */}
          <span className="ui-quota ui-quota--link">
            <span className="ui-quota-col col-remain">
              <span className="ui-quota-label">{t('quota.credit')}</span>
              <span className="ui-quota-value">881</span>
            </span>
            <span className="ui-quota-col col-cta">
              <Coins className="ui-quota-cta-icon" size={14} aria-hidden="true" />
              <span className="ui-quota-cta-text">{t('quota.buy')}</span>
              <ChevronRight className="ui-quota-cta-chevron" size={14} aria-hidden="true" />
            </span>
          </span>
        </Spot>
        <MockLang />
      </MockHeader>

      <StepWizard step={1} />

      <div className="panel-card upload-drop" style={{ minHeight: 260, marginTop: '1.25rem' }}>
        <div className="upload-icon">
          <UploadCloud size={40} />
        </div>
        <div className="upload-label">{t('cc.dropHint')}</div>
        <div className="upload-hint">{t('cc.uploadSupports')}</div>
      </div>
    </div>
  )
}

/* ── 2 · the catalog (two steps share it) ──────────────────────────────────── */

function CatalogFigure() {
  const { t } = useT()
  return (
    <div className="pricing-page">
      <PricingHeader>
        <MockSegmented />
      </PricingHeader>

      <main className="pricing-main">
        <header className="pricing-hero">
          <h2 className="pricing-title">{t('pricing.title')}</h2>
          <p className="pricing-subtitle">{t('pricing.subtitle')}</p>
        </header>

        <Spot id="monthly-plans">
          <section className="pricing-section">
            <div className="pricing-section-head pricing-section-head--center">
              <h2 className="pricing-section-title">{t('pricing.plansTitle')}</h2>
              <p className="pricing-section-sub">{t('pricing.plansHint')}</p>
              <p className="pricing-note">{t('pricing.freeNote')}</p>
            </div>
            <div
              className="billing-period-toggle"
              style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}
            >
              <div className="segmented-control" style={{ margin: 0, width: '22rem' }}>
                <span className="segmented-btn">
                  {t('plan.billingAnnual')}
                  <span className="seg-save-pill">{t('plan.saveAnnualPct', { pct: 10 })}</span>
                </span>
                <span className="segmented-btn active">{t('plan.billingMonthly')}</span>
                <span
                  className="segmented-indicator"
                  style={{ width: 'calc(50% - 4px)', left: 'calc(50% + 2px)' }}
                />
              </div>
            </div>
            <div className="plan-grid plan-grid--3">
              {DEMO_PLANS.map(pack => (
                <PlanCard
                  key={pack.code}
                  pack={pack}
                  meta={PLAN_META[pack.code] ?? { name: pack.code }}
                  period="monthly"
                  onSelect={noop}
                />
              ))}
            </div>
            <EnterpriseCard onContact={noop} />
          </section>
        </Spot>

        <Spot id="topup-credits">
          <section className="pricing-section">
            <div className="pricing-section-head pricing-section-head--center">
              <h2 className="pricing-section-title">{t('pricing.topupTitle')}</h2>
              <p className="pricing-section-sub">{t('pricing.topupSub')}</p>
              <p className="pricing-section-sub">{t('pricing.topupSub2')}</p>
              <p className="pricing-note">{t('pricing.topupNote')}</p>
            </div>
            <PackList packs={DEMO_PACKS} onSelect={noop} />
          </section>
        </Spot>
      </main>
    </div>
  )
}

/* ── 3 · billing info + order summary ──────────────────────────────────────── */

/** CheckoutFlow's own field markup — it can't be mounted (see the file header). */
function CheckoutField({
  label,
  value,
  required = false,
  mono = false,
}: {
  label: string
  value: string
  required?: boolean
  mono?: boolean
}) {
  return (
    <div className="checkout-field">
      <span className={`checkout-field-label${required ? ' checkout-field-label--required' : ''}`}>
        {label}
      </span>
      <div className={`checkout-input${mono ? ' text-mono' : ''}`}>{value}</div>
    </div>
  )
}

function BillingFigure() {
  const { t } = useT()
  const steps = [
    { n: 1, label: t('checkout.step1') },
    { n: 2, label: t('checkout.step2') },
    { n: 3, label: t('checkout.step3') },
  ]
  return (
    <div className="pricing-page">
      <PricingHeader />

      <div className="checkout">
        <span className="checkout-back">← {t('checkout.backToPlans')}</span>
        <StepWizard step={1} steps={steps} />

        <div className="checkout-body">
          <Spot id="billing-dual-section">
            <div className="checkout-grid">
              <div className="panel-card checkout-form">
                <div className="checkout-form-head">
                  <h3 className="checkout-section-title">{t('checkout.billingTitle')}</h3>
                  <span className="checkout-source-badge">
                    <ShieldCheck size={12} /> {t('checkout.sourceLastInvoice')}
                  </span>
                </div>
                <div className="checkout-fields">
                  <div className="checkout-row-3">
                    <CheckoutField
                      label={t('checkout.fieldName')}
                      value={DEMO_BUYER.name}
                      required
                    />
                    <CheckoutField
                      label={t('checkout.fieldTaxId')}
                      value={DEMO_BUYER.tax_id}
                      required
                      mono
                    />
                    <CheckoutField
                      label={t('checkout.fieldBranch')}
                      value={DEMO_BUYER.branch}
                      required
                    />
                  </div>
                  <CheckoutField
                    label={t('checkout.fieldAddress')}
                    value={DEMO_BUYER.address}
                    required
                  />
                  <CheckoutField
                    label={t('checkout.fieldContactName')}
                    value={DEMO_BUYER.contact_name}
                  />
                  <CheckoutField label={t('checkout.fieldTel')} value={DEMO_BUYER.tel} />
                  <CheckoutField label={t('checkout.fieldEmail')} value={DEMO_BUYER.email} />
                </div>
              </div>

              <aside className="checkout-summary">
                <h4 className="checkout-summary-title">{t('checkout.summaryTitle')}</h4>
                <div className="checkout-summary-row">
                  <span>Growth</span>
                  <span className="text-mono">500 {t('pack.creditsUnit')}</span>
                </div>
                <div className="checkout-summary-row checkout-summary-kind">
                  <span>{t('checkout.kindMonthly')}</span>
                </div>
                <div className="checkout-summary-total">
                  <span>{t('checkout.totalDue')}</span>
                  <span className="text-mono">฿{formatThb(990, true)}</span>
                </div>
                <p className="checkout-vat-note">{t('checkout.vatNote')}</p>
                <p className="checkout-vat-note">{t('checkout.finalTotalNote')}</p>
                <span className="btn btn-primary checkout-confirm">
                  {t('checkout.continueToPayment')}
                </span>
                <p className="checkout-hint">{t('checkout.verifyHint')}</p>
              </aside>
            </div>
          </Spot>
        </div>
      </div>
    </div>
  )
}

/* ── 4 · the payment step: the proforma to print and pay ───────────────────── */

/**
 * The `pay` phase of CheckoutFlow, minus its slip card. The real screen does
 * render one under the invoice, but a buyer prints the proforma here and pays
 * days later through their own finance process, so the tour teaches attaching
 * the slip on the pending-order banner (figure 5) and shows nothing here that it
 * never explains.
 */
function PaymentFigure() {
  const { t } = useT()
  const steps = [
    { n: 1, label: t('checkout.step1') },
    { n: 2, label: t('checkout.step2') },
    { n: 3, label: t('checkout.step3') },
  ]
  return (
    <div className="pricing-page">
      <div className="checkout">
        <span className="checkout-back">← {t('checkout.backToPlans')}</span>
        <StepWizard step={2} steps={steps} />
        <div className="checkout-body">
          {/* The print step points at ProformaDocument's own `.pf-toolbar` by
              selector, since the figure mounts that component rather than
              redrawing it. */}
          <div className="checkout-pay">
            <ProformaDocument doc={DEMO_PROFORMA} paymentInfo={DEMO_PAYMENT_INFO} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 5 · back on the catalog: attach the slip and confirm ──────────────────── */

/**
 * The pending-order banner on the catalog page — where the buyer lands when they
 * come back from paying, and where the tour teaches attaching the slip.
 *
 * `DEMO_SLIP` seeds the banner's SlipUpload with a chosen file so the figure
 * shows the **Confirm payment** button rather than an empty drop zone; the
 * canvas is `inert`, so nothing here could pick one.
 */
function ResumeFigure() {
  return (
    <div className="pricing-page">
      <PricingHeader>
        <MockSegmented />
      </PricingHeader>
      <main className="pricing-main">
        <Spot id="pending-order">
          <PendingOrderBanner
            orders={[DEMO_ORDER]}
            onChanged={noop}
            paymentInfo={DEMO_PAYMENT_INFO}
            initialSlipFile={DEMO_SLIP}
          />
        </Spot>
      </main>
    </div>
  )
}

/** Figures in tour order; a step names one by index. */
export const PURCHASE_FIGURES = [
  <BuyChipFigure key="1" />,
  <CatalogFigure key="2" />,
  <BillingFigure key="3" />,
  <PaymentFigure key="4" />,
  <ResumeFigure key="5" />,
]

/**
 * Each figure's page width. The credit-card module lays out in `.app-container`
 * (1480px); everything else is the pricing page (1080px). Getting this wrong
 * squeezes a header that has room to spare on the real screen.
 */
export const PURCHASE_FIGURE_WIDTHS = [1480, 1080, 1080, 1080, 1080]
