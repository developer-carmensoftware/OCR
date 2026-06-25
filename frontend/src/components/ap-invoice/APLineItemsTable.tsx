import { useMemo, useState } from 'react'
import { LayoutList } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'
import Card from '../common/Card'
import APGroupModal from './APGroupModal'
import APTableHeader from './APTableHeader'
import APTableRow from './APTableRow'
import APTableFooter from './APTableFooter'
import type { TaxTypeValue } from './TaxTypeDropdown'
import type { APColumnKey } from '../../constants/apInvoice'
import type { TaxProfileItem } from '../../lib/api/carmen'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'

interface Props {
  lineItems: Array<Record<string, string | undefined>>
  fieldMappings: Record<APColumnKey, string>
  activeCols: number[]
  availableFields: Array<{ value: string; label: string }>
  taxProfiles: TaxProfileItem[]
  sumLineSubTotal: number
  sumLineTotal: number
  sumDiscount: number
  sumTax: number
  isGrouped: boolean
  originalLineItemsCount: number
  changeLineTaxType: (rowIndex: number, v: TaxTypeValue) => void
  updateItem: (idx: number, key: string, val: string) => void
  blurLineItem: (idx: number, key: string, val: string) => void
  applyLineTax: (
    idx: number,
    patch: { taxType?: TaxTypeValue; taxProfileCode1?: string; taxPct?: string }
  ) => void
  groupByDescription: (indices: number[], description: string) => boolean
  ungroupItems: () => void
  removeItem: (idx: number) => void
}

export default function APLineItemsTable({
  lineItems,
  fieldMappings,
  activeCols,
  availableFields,
  taxProfiles,
  sumLineSubTotal,
  sumLineTotal,
  sumDiscount,
  sumTax,
  isGrouped,
  originalLineItemsCount,
  changeLineTaxType,
  updateItem,
  blurLineItem,
  applyLineTax,
  groupByDescription,
  ungroupItems,
  removeItem,
}: Props) {
  const { t } = useT()
  const [showGroupModal, setShowGroupModal] = useState(false)
  const mappedFieldValues = Object.values(fieldMappings)
  const showFixedTaxPct = !mappedFieldValues.includes('taxPct')
  const showFixedTaxType = !mappedFieldValues.includes('taxType')
  const showFixedTaxProfile = !mappedFieldValues.includes('taxProfileCode1')

  // Distinct, sorted tax rates from the Carmen profile list.
  const rateOptions = useMemo(
    () =>
      Array.from(new Set(taxProfiles.filter(p => p.rate != null).map(p => p.rate as number))).sort(
        (a, b) => a - b
      ),
    [taxProfiles]
  )

  const fixedTaxSettings = { showFixedTaxType, showFixedTaxPct, showFixedTaxProfile }
  const sharedColProps = {
    activeCols,
    fieldMappings,
    showFixedTaxType,
    showFixedTaxPct,
    showFixedTaxProfile,
  }

  return (
    <>
      <Card
        icon={<LayoutList size={16} />}
        title={t('ap.reviewTitle')}
        right={
          <div className="ap-card-header-actions">
            {(lineItems.length > 1 || isGrouped) && (
              <>
                {isGrouped && (
                  <button type="button" className="btn btn-sm btn-outline" onClick={ungroupItems}>
                    {t('ap.ungroup', { n: originalLineItemsCount })}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setShowGroupModal(true)}
                  disabled={lineItems.length < 2}
                >
                  {t('ap.groupTitle')}
                </button>
              </>
            )}
            <span className="row-count">
              {lineItems.length} {t('ap.items')}
            </span>
          </div>
        }
      >
        <div className="table-wrapper">
          <table className="ap-review-table">
            <APTableHeader {...sharedColProps} availableFields={availableFields} />
            <tbody className="stagger-rows" key={lineItems.length}>
              {lineItems.map((item, ri) => (
                <APTableRow
                  key={(item as APLineItem)._uid ?? ri}
                  item={item}
                  ri={ri}
                  activeCols={activeCols}
                  fieldMappings={fieldMappings}
                  taxProfiles={taxProfiles}
                  rateOptions={rateOptions}
                  fixedTaxSettings={fixedTaxSettings}
                  isOnlyRow={lineItems.length <= 1}
                  changeLineTaxType={changeLineTaxType}
                  updateItem={updateItem}
                  blurLineItem={blurLineItem}
                  applyLineTax={applyLineTax}
                  removeItem={removeItem}
                />
              ))}
            </tbody>
            <APTableFooter
              {...sharedColProps}
              sumLineSubTotal={sumLineSubTotal}
              sumLineTotal={sumLineTotal}
              sumDiscount={sumDiscount}
              sumTax={sumTax}
            />
          </table>
        </div>
      </Card>
      <APGroupModal
        key={showGroupModal ? 'open' : 'closed'}
        show={showGroupModal}
        lineItems={lineItems as APLineItem[]}
        groupByDescription={groupByDescription}
        onClose={() => setShowGroupModal(false)}
      />
    </>
  )
}
