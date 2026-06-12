import { Printer } from 'lucide-react'
import { formatThb, formatDate } from '../../lib/money'
import type { BillingDocument } from '../../lib/api/credits'

const TITLE: Record<string, { main: string; sub: string }> = {
  proforma: { main: 'Proforma Invoice', sub: 'ใบแจ้งหนี้ / ใบเสนอราคา' },
  tax_invoice: { main: 'Tax Invoice / Receipt', sub: 'ใบกำกับภาษี / ใบเสร็จรับเงิน' },
}

function Party({
  label,
  name,
  taxId,
  address,
  branch,
}: {
  label: string
  name: string | null
  taxId: string | null
  address: string | null
  branch: string | null
}) {
  return (
    <div className="pf-party">
      <span className="pf-party-label">{label}</span>
      <span className="pf-party-name">{name || '—'}</span>
      {address && <span className="pf-party-line">{address}</span>}
      <div className="pf-party-ids">
        {taxId && (
          <span>
            Tax ID <span className="text-mono">{taxId}</span>
          </span>
        )}
        {branch && <span>Branch {branch}</span>}
      </div>
    </div>
  )
}

export default function ProformaDocument({ doc }: { doc: BillingDocument }) {
  const title = TITLE[doc.doc_type] ?? TITLE.proforma

  return (
    <div className="pf-wrap">
      <div className="pf-toolbar">
        <span className="pf-toolbar-label">
          Document no. <span className="text-mono">{doc.number}</span>
        </span>
        <button
          type="button"
          className="btn btn-outline pf-print-btn"
          onClick={() => window.print()}
        >
          <Printer size={14} /> Print / Save PDF
        </button>
      </div>

      <article className="proforma-doc" aria-label={`${title.main} ${doc.number}`}>
        <header className="pf-head">
          <div className="pf-head-titles">
            <h2 className="pf-doc-title">{title.main}</h2>
            <span className="pf-doc-title-en">{title.sub}</span>
          </div>
          <div className="pf-head-meta">
            <div className="pf-meta-row">
              <span>No.</span>
              <span className="text-mono">{doc.number}</span>
            </div>
            <div className="pf-meta-row">
              <span>Date</span>
              <span className="text-mono">{formatDate(doc.issue_date)}</span>
            </div>
          </div>
        </header>

        <section className="pf-parties">
          <Party
            label="Seller"
            name={doc.seller_name}
            taxId={doc.seller_tax_id}
            address={doc.seller_address}
            branch={doc.seller_branch}
          />
          <Party
            label="Buyer"
            name={doc.buyer_name}
            taxId={doc.buyer_tax_id}
            address={doc.buyer_address}
            branch={doc.buyer_branch}
          />
        </section>

        <table className="pf-table">
          <thead>
            <tr>
              <th className="pf-col-desc">Description</th>
              <th className="pf-col-qty">Qty</th>
              <th className="pf-col-amt">Amount (THB)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pf-col-desc">{doc.description || doc.pack_code}</td>
              <td className="pf-col-qty text-mono">{doc.credits.toLocaleString()}</td>
              <td className="pf-col-amt text-mono">{formatThb(doc.subtotal, true)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pf-total-label" colSpan={2}>
                Subtotal (before VAT)
              </td>
              <td className="pf-col-amt text-mono">{formatThb(doc.subtotal, true)}</td>
            </tr>
            <tr>
              <td className="pf-total-label" colSpan={2}>
                VAT {formatThb(doc.vat_rate)}%
              </td>
              <td className="pf-col-amt text-mono">{formatThb(doc.vat_amount, true)}</td>
            </tr>
            <tr className="pf-grand">
              <td className="pf-total-label" colSpan={2}>
                Total
              </td>
              <td className="pf-col-amt text-mono">฿{formatThb(doc.total, true)}</td>
            </tr>
          </tfoot>
        </table>

        <footer className="pf-foot">Prices include 7% VAT · Issued by Carmen AI Automation</footer>
      </article>
    </div>
  )
}
