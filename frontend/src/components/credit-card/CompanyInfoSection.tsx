import React from 'react'
import { AlertCircle } from 'lucide-react'
import type { CompanyData } from '../../lib/bankTransforms'

interface RequiredField {
  key: keyof CompanyData
  label: string
}

interface Props {
  company: CompanyData
  handleCompanyChange: (e: React.ChangeEvent<HTMLInputElement>, field: keyof CompanyData) => void
  companyRequiredFields: RequiredField[]
  missingCompanyFields: RequiredField[]
}

const PLACEHOLDER_MAP: Record<string, string> = {
  name: 'Enter company name',
  taxId: 'Enter TAX ID',
  branch: 'Enter branch',
  address: 'Enter address',
}

export default function CompanyInfoSection({
  company,
  handleCompanyChange,
  companyRequiredFields,
  missingCompanyFields,
}: Props) {
  return (
    <div className="section">
      <div
        className="section-title"
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        COMPANY INFORMATION
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
            <AlertCircle size={11} /> {missingCompanyFields.length} missing fields
          </span>
        )}
      </div>
      <div className="form-grid">
        {companyRequiredFields.map(({ key, label }) => {
          const missing = !company[key]?.trim()
          return (
            <React.Fragment key={`frag-${key}`}>
              <label
                key={`lbl-${key}`}
                style={missing ? { color: '#dc2626', fontWeight: 600 } : {}}
              >
                {label} {missing && <span style={{ color: '#dc2626' }}>*</span>}
              </label>
              <input
                key={`inp-${key}`}
                type="text"
                placeholder={PLACEHOLDER_MAP[key]}
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
