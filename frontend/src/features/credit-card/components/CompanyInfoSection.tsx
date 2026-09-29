import React from 'react'
import { AlertCircle } from 'lucide-react'
import { useT } from '@/i18n/LanguageContext'
import type { TKey } from '@/i18n/dict'
import type { CompanyData } from '@/features/credit-card/lib/bankTransforms'

interface RequiredField {
  key: keyof CompanyData
  labelKey: TKey
}

interface Props {
  company: CompanyData
  handleCompanyChange: (e: React.ChangeEvent<HTMLInputElement>, field: keyof CompanyData) => void
  companyRequiredFields: RequiredField[]
  missingCompanyFields: RequiredField[]
}

const PLACEHOLDER_KEYS: Record<string, TKey> = {
  name: 'cc.companyNamePh',
  taxId: 'cc.companyTaxIdPh',
  branch: 'cc.companyBranchPh',
  address: 'cc.companyAddressPh',
}

export default function CompanyInfoSection({
  company,
  handleCompanyChange,
  companyRequiredFields,
  missingCompanyFields,
}: Props) {
  const { t } = useT()
  return (
    <div className="section">
      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        {t('cc.companyTitle')}
        {missingCompanyFields.length > 0 && (
          <span
            style={{
              fontSize: '0.75rem',
              background: 'var(--rose)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: 'bold',
            }}
          >
            <AlertCircle size={11} /> {t('cc.companyMissing', { n: missingCompanyFields.length })}
          </span>
        )}
      </div>
      <div className="form-grid">
        {companyRequiredFields.map(({ key, labelKey }) => {
          const missing = !company[key]?.trim()
          const label = t(labelKey)
          return (
            <React.Fragment key={`frag-${key}`}>
              <label
                key={`lbl-${key}`}
                htmlFor={`inp-${key}`}
                style={missing ? { color: '#dc2626', fontWeight: 600 } : {}}
              >
                {label} {missing && <span style={{ color: '#dc2626' }}>*</span>}
              </label>
              <input
                key={`inp-${key}`}
                id={`inp-${key}`}
                type="text"
                aria-label={label}
                placeholder={t(PLACEHOLDER_KEYS[key])}
                value={company[key]}
                onChange={e => handleCompanyChange(e, key)}
                style={
                  missing
                    ? { borderColor: 'var(--rose)', background: 'var(--btn-err-bg, #fff1f2)' }
                    : {}
                }
              />
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
