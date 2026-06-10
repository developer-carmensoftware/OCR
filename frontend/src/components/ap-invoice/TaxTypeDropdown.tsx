import InlineSelect from '../common/InlineSelect'
import type { InlineSelectOption } from '../common/InlineSelect'

export type TaxTypeValue = 'Include' | 'Exclude' | 'None'

const OPTIONS: InlineSelectOption[] = [
  { value: 'Include', label: 'Include', accent: 'amber' },
  { value: 'Exclude', label: 'Exclude', accent: 'blue' },
  { value: 'None', label: 'None', accent: 'muted' },
]

interface Props {
  value: TaxTypeValue | string
  onChange: (v: TaxTypeValue) => void
}

export default function TaxTypeDropdown({ value, onChange }: Props) {
  return (
    <InlineSelect
      value={value}
      onChange={v => onChange(v as TaxTypeValue)}
      options={OPTIONS}
      aria-label="Tax type"
    />
  )
}
