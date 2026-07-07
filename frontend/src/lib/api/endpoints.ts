/**
 * Single source of truth for backend API paths.
 *
 * Grouped by module so a future namespace change touches one place instead of
 * being scattered across lib/api/*.ts and hooks. Parameterized routes are
 * exposed as builder functions.
 *
 * History: the app began as a single "credit card OCR" tool, so paths once lived
 * under /api/v1/ocr/*. They are now module-coherent:
 *   credit card  → /api/v1/credit-card/*
 *   AP invoice   → /api/v1/ap-invoice/*
 *   Carmen (ERP) → /api/v1/carmen/*   (shared by both modules)
 */

const V1 = '/api/v1'

export const API = {
  auth: {
    exchange: `${V1}/auth/exchange`,
    session: `${V1}/auth/session`,
    usage: `${V1}/auth/usage`,
  },

  creditCard: {
    extract: `${V1}/credit-card/extract`,
    tasks: `${V1}/credit-card/tasks`,
    task: (taskId: string) => `${V1}/credit-card/tasks/${taskId}`,
    mapping: {
      suggest: `${V1}/credit-card/mapping/suggest`,
      suggestPaymentTypes: `${V1}/credit-card/mapping/suggest-payment-types`,
    },
  },

  apInvoice: {
    extract: `${V1}/ap-invoice/extract`,
    suggest: `${V1}/ap-invoice/suggest`,
  },

  // Carmen ERP proxy — shared by BOTH credit card and AP invoice flows.
  carmen: {
    accountCodes: `${V1}/carmen/account-codes`,
    departments: `${V1}/carmen/departments`,
    glPrefix: `${V1}/carmen/gl-prefix`,
    taxProfiles: `${V1}/carmen/tax-profiles`,
    vendors: `${V1}/carmen/vendors`,
    gljv: `${V1}/carmen/gljv`,
    invoice: `${V1}/carmen/invoice`,
    inputTax: `${V1}/carmen/input-tax`,
  },

  config: {
    accounting: `${V1}/config/accounting`,
    apMapping: (vendorTaxId: string) =>
      `${V1}/config/ap-mapping/${encodeURIComponent(vendorTaxId)}`,
  },

  credits: {
    packs: `${V1}/credits/packs`,
    companyProfile: `${V1}/credits/company-profile`,
    paymentInfo: `${V1}/credits/payment-info`,
    orders: `${V1}/credits/orders`,
    order: (orderId: string) => `${V1}/credits/orders/${orderId}`,
    orderSlip: (orderId: string) => `${V1}/credits/orders/${orderId}/slip`,
    orderCancel: (orderId: string) => `${V1}/credits/orders/${orderId}/cancel`,
    orderDocuments: (orderId: string) => `${V1}/credits/orders/${orderId}/documents`,
  },

  notifications: {
    list: `${V1}/notifications`,
    markRead: `${V1}/notifications/mark-read`,
  },

  feedback: {
    corrections: `${V1}/feedback/corrections`,
    bugReport: `${V1}/feedback/bug-report`,
  },

  files: {
    pdfInfo: `${V1}/files/pdf-info`,
    preview: `${V1}/files/preview`,
  },

  admin: {
    login: `${V1}/admin/auth/login`,
    me: `${V1}/admin/auth/me`,
    logout: `${V1}/admin/auth/logout`,
    usageSummary: `${V1}/admin/usage-summary`,
    usageTotals: `${V1}/admin/usage-summary/totals`,
    tenantRanking: `${V1}/admin/tenant-ranking`,
    llmUsage: `${V1}/admin/llm-usage`,
    performanceLogs: `${V1}/admin/performance-logs`,
    alerts: `${V1}/admin/alerts`,
    resolveAlert: (alertId: number | string) => `${V1}/admin/alerts/${alertId}/resolve`,
    jobs: `${V1}/admin/jobs`,
    sessions: `${V1}/admin/sessions`,
    session: (sessionId: string) => `${V1}/admin/sessions/${sessionId}`,
    tenants: `${V1}/admin/tenants`,
    errorBreakdown: `${V1}/admin/error-breakdown`,
    tenantCredits: (tenantId: string) => `${V1}/admin/tenants/${tenantId}/credits`,
    tenantCreditsLedger: (tenantId: string) => `${V1}/admin/tenants/${tenantId}/credits/ledger`,
    tenantCreditsTopup: (tenantId: string) => `${V1}/admin/tenants/${tenantId}/credits/topup`,
    tenantCreditsAdjust: (tenantId: string) => `${V1}/admin/tenants/${tenantId}/credits/adjust`,
    paymentInfo: `${V1}/admin/payment-info`,
    creditOrders: `${V1}/admin/credit-orders`,
    creditOrderSlipUrl: (id: string) => `${V1}/admin/credit-orders/${id}/slip-url`,
    creditOrderApprove: (id: string) => `${V1}/admin/credit-orders/${id}/approve`,
    creditOrderReject: (id: string) => `${V1}/admin/credit-orders/${id}/reject`,
    creditOrderNote: (id: string) => `${V1}/admin/credit-orders/${id}/hold`,
    creditOrderCancel: (id: string) => `${V1}/admin/credit-orders/${id}/cancel`,
    creditOrderDocuments: (id: string) => `${V1}/admin/credit-orders/${id}/documents`,
    creditOrdersPostAr: `${V1}/admin/credit-orders/post-ar`,
    creditOrdersHoldBatch: `${V1}/admin/credit-orders/hold-batch`,
    creditOrdersKpi: `${V1}/admin/credit-orders/kpi`,
    arProfiles: `${V1}/admin/ar-customer-profiles`,
    arProfile: (id: string) => `${V1}/admin/ar-customer-profiles/${id}`,
    arProfilesSync: `${V1}/admin/ar-customer-profiles/sync`,
  },
} as const
