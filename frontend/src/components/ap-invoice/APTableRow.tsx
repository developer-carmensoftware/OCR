import { Fragment } from 'react'
import { Trash2 } from 'lucide-react'
import { isNumFld, parseNum } from '../../constants/apInvoice'
import NumericInput from '../common/NumericInput'
import InlineSelect from '../common/InlineSelect'
import type { InlineSelectOption } from '../common/InlineSelect'
import type { TaxTypeValue } from './TaxTypeDropdown'
import type { APColumnKey } from '../../constants/apInvoice'
import type { TaxProfileItem } from '../../lib/api/carmen'

const TAX_TYPE_OPTIONS: InlineSelectOption[] = [
  { value: 'Include', label: 'Include', accent: 'amber' },
  { value: 'Exclude', label: 'Exclude', accent: 'blue' },
  { value: 'None', label: 'None', accent: 'muted' },
]

export interface FixedTaxSettings {
  showFixedTaxType: boolean
  showFixedTaxPct: boolean
  showFixedTaxProfile: boolean
}

interface Props {
  item: Record<string, string | undefined>
  ri: number
  activeCols: number[]
  fieldMappings: Record<APColumnKey, string>
  taxProfiles: TaxProfileItem[]
  rateOptions: number[]
  fixedTaxSettings: FixedTaxSettings
  isOnlyRow: boolean
  changeLineTaxType: (rowIndex: number, v: TaxTypeValue) => void
  updateItem: (idx: number, key: string, val: string) => void
  blurLineItem: (idx: number, key: string, val: string) => void
  applyLineTax: (
    idx: number,
    patch: { taxType?: TaxTypeValue; taxProfileCode1?: string; taxPct?: string }
  ) => void
  removeItem: (idx: number) => void
}

function TaxProfileCell({
  ri,
  item,
  taxProfiles,
  applyLineTax,
}: Pick<Props, 'ri' | 'item' | 'taxProfiles' | 'applyLineTax'>) {
  const isNone = item.taxType === 'None'
  const val = isNone ? 'NONE' : item.taxProfileCode1 || ''
  const hasNoneProfile = taxProfiles.some(p => p.code === 'NONE')

  const profileOptions: InlineSelectOption[] = [
    { value: '', label: '—' },
    ...(!hasNoneProfile ? [{ value: 'NONE', label: 'NONE', accent: 'muted' as const }] : []),
    ...taxProfiles.map(p => ({
      value: p.code,
      label: p.code,
      description: p.desc,
    })),
  ]

  return (
    <td>
      <InlineSelect
        aria-label="Tax profile"
        value={val}
        onChange={v => applyLineTax(ri, { taxProfileCode1: v })}
        options={profileOptions}
      />
    </td>
  )
}

function TaxPctCell({
  ri,
  item,
  rateOptions,
  updateItem,
  blurLineItem,
  applyLineTax,
}: Pick<Props, 'ri' | 'item' | 'rateOptions' | 'updateItem' | 'blurLineItem' | 'applyLineTax'>) {
  const cur = parseNum(item.taxPct)
  const unmatched =
    item.taxType !== 'None' && cur > 0 && !rateOptions.some(r => Math.abs(r - cur) < 0.01)
  const opts = unmatched ? [...rateOptions, cur].sort((a, b) => a - b) : rateOptions
  return (
    <td>
      {item.taxType === 'None' ? (
        <span className="ap-edit-input numeric ap-tax-na" aria-label="taxPct">
          0%
        </span>
      ) : opts.length ? (
        <InlineSelect
          aria-label="taxPct"
          value={String(cur)}
          onChange={v => applyLineTax(ri, { taxPct: v })}
          warning={unmatched}
          options={opts.map(r => ({
            value: String(r),
            label: `${r}%`,
            warning: unmatched && r === cur,
          }))}
        />
      ) : (
        <NumericInput
          aria-label="taxPct"
          className="ap-edit-input numeric"
          value={item.taxPct || ''}
          onChange={v => updateItem(ri, 'taxPct', v)}
          onBlur={v => blurLineItem(ri, 'taxPct', v)}
        />
      )}
    </td>
  )
}

export default function APTableRow({
  item,
  ri,
  activeCols,
  fieldMappings,
  taxProfiles,
  rateOptions,
  fixedTaxSettings,
  isOnlyRow,
  changeLineTaxType,
  updateItem,
  blurLineItem,
  applyLineTax,
  removeItem,
}: Props) {
  return (
    <tr>
      {activeCols.map(c => {
        const fld = fieldMappings[`col${c}` as APColumnKey]
        const numeric = isNumFld(fld)

        if (fld === 'taxProfileCode1') {
          return (
            <Fragment key={c}>
              <TaxProfileCell
                ri={ri}
                item={item}
                taxProfiles={taxProfiles}
                applyLineTax={applyLineTax}
              />
            </Fragment>
          )
        }

        if (fld === 'taxPct') {
          return (
            <Fragment key={c}>
              {!fixedTaxSettings.showFixedTaxType && fixedTaxSettings.showFixedTaxProfile && (
                <TaxProfileCell
                  ri={ri}
                  item={item}
                  taxProfiles={taxProfiles}
                  applyLineTax={applyLineTax}
                />
              )}
              <TaxPctCell
                ri={ri}
                item={item}
                rateOptions={rateOptions}
                updateItem={updateItem}
                blurLineItem={blurLineItem}
                applyLineTax={applyLineTax}
              />
            </Fragment>
          )
        }

        if (fld === 'taxType') {
          const tv = (item.taxType as TaxTypeValue | undefined) || 'Exclude'
          return (
            <Fragment key={c}>
              {fixedTaxSettings.showFixedTaxProfile && fixedTaxSettings.showFixedTaxPct && (
                <TaxProfileCell
                  ri={ri}
                  item={item}
                  taxProfiles={taxProfiles}
                  applyLineTax={applyLineTax}
                />
              )}
              <td>
                <InlineSelect
                  aria-label="Tax type"
                  value={tv}
                  onChange={v => changeLineTaxType(ri, v as TaxTypeValue)}
                  options={TAX_TYPE_OPTIONS}
                />
              </td>
            </Fragment>
          )
        }

        const cellClass = `ap-edit-input ${numeric ? 'numeric' : ''} ${fld === 'category' ? 'category' : ''}`
        const isMissingDesc = fld === 'description' && !item[fld]?.trim()
        return (
          <td key={c} className={isMissingDesc ? 'ap-cell-missing' : undefined}>
            {numeric ? (
              <NumericInput
                aria-label={fld}
                className={cellClass}
                value={item[fld] || ''}
                onChange={v => updateItem(ri, fld, v)}
                onBlur={v => blurLineItem(ri, fld, v)}
              />
            ) : (
              <input
                type="text"
                aria-label={fld}
                className={cellClass}
                value={item[fld] || ''}
                onChange={e => updateItem(ri, fld, e.target.value)}
              />
            )}
          </td>
        )
      })}
      {fixedTaxSettings.showFixedTaxType && fixedTaxSettings.showFixedTaxProfile && (
        <TaxProfileCell ri={ri} item={item} taxProfiles={taxProfiles} applyLineTax={applyLineTax} />
      )}
      {fixedTaxSettings.showFixedTaxPct && (
        <TaxPctCell
          ri={ri}
          item={item}
          rateOptions={rateOptions}
          updateItem={updateItem}
          blurLineItem={blurLineItem}
          applyLineTax={applyLineTax}
        />
      )}
      {fixedTaxSettings.showFixedTaxType && (
        <td>
          <InlineSelect
            aria-label="Tax type"
            value={(item.taxType as TaxTypeValue | undefined) || 'Exclude'}
            onChange={v => changeLineTaxType(ri, v as TaxTypeValue)}
            options={TAX_TYPE_OPTIONS}
          />
        </td>
      )}
      <td>
        <button
          type="button"
          className="ap-delete-item-btn"
          aria-label="Delete row"
          disabled={isOnlyRow}
          onClick={() => removeItem(ri)}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}
