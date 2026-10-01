import React from 'react'
import { AlertCircle } from 'lucide-react'
import { useT } from '@/i18n/LanguageContext'
import type { TKey } from '@/i18n/dict'
import type { CompanyData } from '@/features/credit-card/lib/bankTransforms'
import type { CompanyField } from '@/features/credit-card/hooks/mapping/useMapping'

interface Props {
  company: CompanyData
  handleCompanyChange: (e: React.ChangeEvent<HTMLInputElement>, field: keyof CompanyData) => void
  companyFields: CompanyField[]
  missingCompanyFields: CompanyField[]
  /** Per-field problems beyond "missing", e.g. a branch that is not five digits. */
  companyErrors?: Partial<Record<keyof CompanyData, string>>
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
  companyFields,
  missingCompanyFields,
  companyErrors = {},
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
      <p style={{ margin: '-0.25rem 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-3)' }}>
        {t('cc.companyFromRegistry')}
      </p>
      <div className="form-grid">
        {companyFields.map(({ key, labelKey, readOnly }) => {
          const missing = !readOnly && !company[key]?.trim()
          const error = companyErrors[key]
          const bad = missing || Boolean(error)
          const label = t(labelKey)
          return (
            <React.Fragment key={`frag-${key}`}>
              <label
                htmlFor={`inp-${key}`}
                style={bad ? { color: '#dc2626', fontWeight: 600 } : {}}
              >
                {label} {missing && <span style={{ color: '#dc2626' }}>*</span>}
              </label>
              <div>
                <input
                  id={`inp-${key}`}
                  type="text"
                  aria-label={label}
                  placeholder={readOnly ? undefined : t(PLACEHOLDER_KEYS[key])}
                  value={company[key]}
                  readOnly={readOnly}
                  inputMode={key === 'branch' ? 'numeric' : undefined}
                  maxLength={key === 'branch' ? 5 : undefined}
                  aria-invalid={bad || undefined}
                  aria-describedby={error ? `err-${key}` : undefined}
                  onChange={readOnly ? undefined : e => handleCompanyChange(e, key)}
                  style={
                    readOnly
                      ? // The File Source field's look: the value is the registry's, not the form's.
                        { cursor: 'default', background: 'var(--muted)' }
                      : bad
                        ? { borderColor: 'var(--rose)', background: 'var(--btn-err-bg, #fff1f2)' }
                        : {}
                  }
                />
                {error && (
                  <small
                    id={`err-${key}`}
                    style={{ display: 'block', marginTop: 2, color: 'var(--rose)' }}
                  >
                    {error}
                  </small>
                )}
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
