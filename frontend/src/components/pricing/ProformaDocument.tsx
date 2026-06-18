import { Printer } from 'lucide-react'
import { formatThb, formatDate, bahtToEnglishWords } from '../../lib/money'
import { useT } from '../../i18n/LanguageContext'
import logo from '../../assets/logo_carmen.png'
import type { BillingDocument, PaymentInfo } from '../../lib/api/credits'

const TITLE: Record<string, { main: string; sub: string }> = {
  proforma: { main: 'Proforma Invoice', sub: 'ใบแจ้งหนี้ / ใบเสนอราคา' },
  tax_invoice: { main: 'Tax Invoice / Receipt', sub: 'ใบกำกับภาษี / ใบเสร็จรับเงิน' },
}

/** issue_date + 14 days, as a DD/MM/YYYY string (proforma validity). */
function expiryDate(issue: string): string {
  const d = new Date(issue)
  if (Number.isNaN(d.getTime())) return '—'
  d.setDate(d.getDate() + 14)
  return formatDate(d.toISOString())
}

function num(v: string | number): number {
  return typeof v === 'string' ? Number(v) : v
}

export default function ProformaDocument({
  doc,
  paymentInfo,
}: {
  doc: BillingDocument
  paymentInfo?: PaymentInfo | null
}) {
  const { t } = useT()
  const title = TITLE[doc.doc_type] ?? TITLE.proforma
  const isProforma = doc.doc_type === 'proforma'
  const subtotal = num(doc.subtotal)
  const pi = paymentInfo

  return (
    <div className="pf-wrap">
      <div className="pf-toolbar no-print">
        <span className="pf-toolbar-label">
          {t('proforma.docNo')} <span className="text-mono">{doc.number}</span>
        </span>
        <button
          type="button"
          className="btn btn-outline pf-print-btn"
          onClick={() => window.print()}
        >
          <Printer size={14} /> {t('proforma.print')}
        </button>
      </div>

      <article className="proforma-doc" aria-label={`${title.main} ${doc.number}`}>
        {/* Header — logo + seller identity */}
        <header className="pf-head">
          <img src={logo} alt="Carmen" className="pf-logo" />
          <div className="pf-seller">
            {doc.seller_name && <div className="pf-seller-name">{doc.seller_name}</div>}
            {pi?.seller_name_en && <div className="pf-seller-name">{pi.seller_name_en}</div>}
            {doc.seller_address && <div>{doc.seller_address}</div>}
            {pi?.seller_phone && <div>{pi.seller_phone}</div>}
            {doc.seller_tax_id && (
              <div>
                Tax ID <span className="text-mono">{doc.seller_tax_id}</span>
              </div>
            )}
            {doc.seller_branch && <div>Branch {doc.seller_branch}</div>}
          </div>
        </header>

        <div className="pf-banner">{title.main.toUpperCase()}</div>
        <div className="pf-banner-sub">{title.sub}</div>

        {/* Buyer + document meta */}
        <section className="pf-meta-grid">
          <div className="pf-card">
            <div className="pf-card-title">{isProforma ? 'PROFORMA TO' : 'BILL TO'}</div>
            <div className="pf-card-body">
              <div className="pf-buyer-name">{doc.buyer_name || '—'}</div>
              {doc.buyer_address && <div>{doc.buyer_address}</div>}
              {doc.buyer_email && <div>{doc.buyer_email}</div>}
              {doc.buyer_tax_id && <div>Tax ID {doc.buyer_tax_id}</div>}
              {doc.buyer_branch && <div>Branch {doc.buyer_branch}</div>}
            </div>
          </div>

          <div className="pf-card">
            <div className="pf-card-title">DOCUMENT DETAILS</div>
            <div className="pf-card-body pf-doc-details">
              <span className="pf-dd-label">No.</span>
              <span className="text-mono">{doc.number}</span>
              <span className="pf-dd-label">Date</span>
              <span className="text-mono">{formatDate(doc.issue_date)}</span>
              {isProforma && (
                <>
                  <span className="pf-dd-label">Valid until</span>
                  <span className="text-mono">{expiryDate(doc.issue_date)}</span>
                  <span className="pf-dd-label">Payment terms</span>
                  <span>Prepaid</span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Line items */}
        <table className="pf-table">
          <thead>
            <tr>
              <th className="pf-col-no">No.</th>
              <th className="pf-col-desc">Description</th>
              <th className="pf-col-qty">Qty</th>
              <th className="pf-col-amt">Unit Price</th>
              <th className="pf-col-amt">Amount (THB)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pf-col-no">1</td>
              <td className="pf-col-desc">{doc.description || doc.pack_code}</td>
              <td className="pf-col-qty text-mono">1</td>
              <td className="pf-col-amt text-mono">{formatThb(subtotal, true)}</td>
              <td className="pf-col-amt text-mono">{formatThb(subtotal, true)}</td>
            </tr>
          </tbody>
        </table>

        {/* Payment instructions + totals */}
        <section className="pf-summary">
          {isProforma && pi && (pi.bank_account_no || pi.cheque_payee) && (
            <div className="pf-pay-info">
              <div className="pf-card-title">PAYMENT INFORMATION</div>
              {pi.bank_account_no && (
                <div className="pf-pay-option">
                  <div className="pf-pay-opt-head">Option 1 · Bank Transfer (โอนเงิน)</div>
                  <div className="pf-pay-rows">
                    {pi.bank_name && (
                      <div>
                        <span>Bank</span>
                        <b>{pi.bank_name}</b>
                      </div>
                    )}
                    <div>
                      <span>Account No</span>
                      <b className="pf-pay-acct text-mono">{pi.bank_account_no}</b>
                    </div>
                    {pi.bank_account_name && (
                      <div>
                        <span>Account Name</span>
                        <b>{pi.bank_account_name}</b>
                      </div>
                    )}
                    {pi.bank_account_type && (
                      <div>
                        <span>Account Type</span>
                        <b>{pi.bank_account_type}</b>
                      </div>
                    )}
                    {pi.bank_branch && (
                      <div>
                        <span>Branch</span>
                        <b>{pi.bank_branch}</b>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {pi.cheque_payee && (
                <div className="pf-pay-option">
                  <div className="pf-pay-opt-head">Option 2 · Crossed Cheque (เช็คขีดคร่อม)</div>
                  <div className="pf-pay-cheque">
                    Please issue a crossed cheque payable to:
                    <br />
                    <b>{pi.cheque_payee}</b>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pf-totals">
            <div className="pf-total-row">
              <span>Subtotal</span>
              <span className="text-mono">{formatThb(subtotal, true)}</span>
            </div>
            <div className="pf-total-row">
              <span>VAT {formatThb(doc.vat_rate)}%</span>
              <span className="text-mono">{formatThb(num(doc.vat_amount), true)}</span>
            </div>
            <div className="pf-total-row pf-grand">
              <span>Grand Total</span>
              <span className="text-mono">฿{formatThb(num(doc.total), true)}</span>
            </div>
            <div className="pf-amount-words">({bahtToEnglishWords(num(doc.total))})</div>
          </div>
        </section>

        {isProforma && (
          <>
            <section className="pf-terms">
              <div className="pf-card-title">ข้อตกลงและเงื่อนไข (Terms &amp; Conditions)</div>
              <ol>
                <li>
                  กรุณาดำเนินการชำระเงินและ <b>อัปโหลดหลักฐานการโอนเงิน (Payslip) เข้ามาในระบบ</b>
                </li>
                <li>
                  <b>
                    การชำระเงินจะถือว่าเสร็จสมบูรณ์เมื่ออัปโหลดหลักฐาน (Payslip)
                    และผ่านการอนุมัติแล้วเท่านั้น
                  </b>
                </li>
                <li>
                  ระบบจะเปิดใช้งานหรือต่ออายุโดยอัตโนมัติภายใน 24
                  ชั่วโมงหลังจากยืนยันสถานะการอัปโหลดหลักฐาน
                </li>
                <li>
                  เอกสารฉบับนี้ไม่ใช่ใบกำกับภาษีเต็มรูปแบบ
                  ฝ่ายบัญชีจะจัดส่งใบกำกับภาษีอิเล็กทรอนิกส์ให้ทาง
                  <b>อีเมล (Email)</b> ที่ท่านระบุไว้
                </li>
              </ol>
            </section>

            <section className="pf-signatures">
              <div className="pf-sign">
                <div className="pf-sign-line" />
                <div className="pf-sign-role">Prepared By</div>
                <div className="pf-sign-org">Carmen Software Co., Ltd.</div>
              </div>
              <div className="pf-sign">
                <div className="pf-sign-line" />
                <div className="pf-sign-role">Approved By Customer</div>
                <div className="pf-sign-org">Authorized Signature &amp; Company Stamp</div>
              </div>
            </section>
          </>
        )}
      </article>
    </div>
  )
}
