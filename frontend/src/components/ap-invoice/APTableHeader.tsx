import { Fragment } from 'react'
import { useT } from '../../i18n/LanguageContext'
import type { APColumnKey } from '../../constants/apInvoice'

interface Props {
  activeCols: number[]
  fieldMappings: Record<APColumnKey, string>
  availableFields: Array<{ value: string; label: string }>
  showFixedTaxType: boolean
  showFixedTaxPct: boolean
  showFixedTaxProfile: boolean
}

export default function APTableHeader({
  activeCols,
  fieldMappings,
  availableFields,
  showFixedTaxType,
  showFixedTaxPct,
  showFixedTaxProfile,
}: Props) {
  const { t } = useT()

  return (
    <thead>
      <tr>
        {activeCols.map(c => {
          const fld = fieldMappings[`col${c}` as APColumnKey]
          const label = availableFields.find(f => f.value === fld)?.label
          if (fld === 'taxPct') {
            return (
              <Fragment key={c}>
                {!showFixedTaxType && showFixedTaxProfile && (
                  <th scope="col">{t('ap.taxProfile')}</th>
                )}
                <th scope="col">{label}</th>
              </Fragment>
            )
          }
          if (fld === 'taxType') {
            return (
              <Fragment key={c}>
                {showFixedTaxProfile && showFixedTaxPct && (
                  <th scope="col">{t('ap.taxProfile')}</th>
                )}
                <th scope="col">{label}</th>
              </Fragment>
            )
          }
          return (
            <th key={c} scope="col">
              {label}
            </th>
          )
        })}
        {showFixedTaxType && showFixedTaxProfile && <th scope="col">{t('ap.taxProfile')}</th>}
        {showFixedTaxPct && <th scope="col">{t('ap.taxPct')}</th>}
        {showFixedTaxType && <th scope="col">{t('ap.taxType')}</th>}
        <th scope="col" aria-label="Actions" />
      </tr>
    </thead>
  )
}
