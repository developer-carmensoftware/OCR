/**
 * Sample data for the purchase tour's figures.
 *
 * The figures mount the REAL pricing components, so this is the only thing that
 * has to be made up. Typed against `lib/api/credits.ts` on purpose: if a shape
 * changes under us, the build breaks here instead of the tutorial quietly
 * drawing something the product no longer looks like.
 *
 * Numbers match the live catalog (`credit_packs` after
 * `20260717000000_topup_price_v2.sql`). The buyer is a made-up company — never
 * put a real customer's name or tax ID in teaching material. The seller block
 * and bank details are Carmen's own and are printed on every real proforma.
 */

import type {
  BillingDocument,
  CreditOrder,
  CreditPack,
  PaymentInfo,
} from '../../../lib/api/credits'

export const DEMO_PLANS: CreditPack[] = [
  {
    code: 'sub_starter',
    kind: 'subscription',
    credits: 200,
    price_thb: 490,
    price_annual_thb: 5292,
    sort_order: 1,
  },
  {
    code: 'sub_growth',
    kind: 'subscription',
    credits: 500,
    price_thb: 990,
    price_annual_thb: 10692,
    sort_order: 2,
  },
  {
    code: 'sub_pro',
    kind: 'subscription',
    credits: 1500,
    price_thb: 2490,
    price_annual_thb: 26892,
    sort_order: 3,
  },
]

export const DEMO_PACKS: CreditPack[] = [
  { code: 'pack_small', kind: 'topup', credits: 500, price_thb: 2000, sort_order: 11 },
  { code: 'pack_medium', kind: 'topup', credits: 2500, price_thb: 7500, sort_order: 12 },
  { code: 'pack_large', kind: 'topup', credits: 10000, price_thb: 20000, sort_order: 13 },
]

export const DEMO_BUYER = {
  name: 'บริษัท ตัวอย่างโฮเทล แอนด์ รีสอร์ท จำกัด',
  tax_id: '0105500000001',
  branch: '00002',
  address: '199/9 ถ.ตัวอย่าง ต.ป่าตอง อ.กะทู้ จ.ภูเก็ต 83150',
  contact_name: 'สมชาย ใจดี',
  tel: '076-000000',
  email: 'billing@example.com',
}

/** Growth monthly: 990 + 7% VAT = 1,059.30. */
export const DEMO_PROFORMA: BillingDocument = {
  id: 'demo-proforma',
  doc_type: 'proforma',
  number: 'AI-202608-0003',
  issue_date: '2026-08-14',
  seller_name: 'บริษัท คาร์เมน ซอฟต์แวร์ จำกัด',
  seller_tax_id: '0105562202751',
  seller_address: '891/24-25 ถนนพระราม 3 แขวงบางโพงพาง เขตยานนาวา กรุงเทพมหานคร 10120',
  seller_branch: 'สำนักงานใหญ่',
  buyer_name: DEMO_BUYER.name,
  buyer_tax_id: DEMO_BUYER.tax_id,
  buyer_address: DEMO_BUYER.address,
  buyer_branch: DEMO_BUYER.branch,
  buyer_email: DEMO_BUYER.email,
  buyer_contact_name: DEMO_BUYER.contact_name,
  buyer_tel: DEMO_BUYER.tel,
  pack_code: 'sub_growth',
  description: 'Growth Plan — 500 credits/month',
  credits: 500,
  subtotal: 990,
  vat_rate: 7,
  vat_amount: 69.3,
  total: 1059.3,
  currency: 'THB',
  created_at: '2026-08-14T03:00:00Z',
}

export const DEMO_PAYMENT_INFO: PaymentInfo = {
  bank_name: 'Bangkok Bank (ธนาคารกรุงเทพ)',
  bank_account_no: '195-4-97445-5',
  bank_account_name: 'CARMEN SOFTWARE CO., LTD.',
  bank_account_type: 'Savings Account (ออมทรัพย์)',
  bank_branch: 'Ratchada - Sathupradit Intersection',
  cheque_payee: '',
  seller_name_en: 'CARMEN SOFTWARE CO., LTD.',
  seller_phone: '66 2 284 0429',
}

/** One unpaid order, which is what makes PendingOrderBanner render at all. */
export const DEMO_ORDER: CreditOrder = {
  id: 'demo-order',
  pack_code: 'sub_growth',
  credits: 500,
  amount_thb: 1059.3,
  billing_period: 'monthly',
  status: 'in_progress',
  created_at: '2026-08-14T03:00:00Z',
  expires_at: '2026-08-28T03:00:00Z',
}

/** Callbacks the figures pass to real components. Nothing here should ever run. */
export const noop = () => {}
export const asyncNoop = async () => {}
