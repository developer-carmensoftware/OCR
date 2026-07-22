import { Check, X, Database } from 'lucide-react'
import { SkeletonRow } from '../common/Skeleton'
import CustomSearchSelect from '../common/CustomSearchSelect'
import AISuggestBar from '../common/AISuggestBar'
import { useT } from '../../i18n/LanguageContext'
import { allowedAccountsForDept, isAccountAllowed } from '../../lib/deptAccounts'
import type { APLineItem } from '../../hooks/ap-invoice/useAPExtraction'

interface GLAccount {
  code: string
  name: string
  allowedAccounts?: string[]
}

interface Props {
  lineItems: APLineItem[]
  masterAccounts: GLAccount[]
  masterDepts: GLAccount[]
  hasSuggestions: boolean
  suggestLoading: boolean
  updateItem: (idx: number, key: string, val: string) => void
  onAISuggest: () => void
  onAcceptAll: () => void
  onConfirmSuggest: (idx: number) => void
  onRejectSuggest: (idx: number) => void
}

export default function AccountMappingTable({
  lineItems,
  masterAccounts,
  masterDepts,
  hasSuggestions,
  suggestLoading,
  updateItem,
  onAISuggest,
  onAcceptAll,
  onConfirmSuggest,
  onRejectSuggest,
}: Props) {
  const { t } = useT()
  return (
    <div className="data-card card-acct">
      <div className="card-title">
        <div className="card-title-left">
          <Database size={15} color="var(--primary)" />
          {t('ap.debitExpense')}
        </div>
        <div className="ap-card-title-right">
          <span className="ap-card-title-sub">{t('ap.expenseDesc')}</span>
          <AISuggestBar
            onSuggest={onAISuggest}
            onAcceptAll={onAcceptAll}
            hasSuggestions={hasSuggestions}
            loading={suggestLoading}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="ap-acct-table">
          <thead>
            <tr>
              <th scope="col" className="col-description">
                {t('ap.description')}
              </th>
              <th scope="col" className="col-dept">
                {t('ap.deptCode')}
                <span
                  className="gl-help-tip"
                  title="Department code from Carmen Cloud — e.g. ACC, SALE, MKT"
                >
                  ?
                </span>
              </th>
              <th scope="col" className="col-acc">
                {t('ap.accountCode')}
                <span
                  className="gl-help-tip"
                  title="Account code from Carmen Cloud — e.g. 1101-01, 5100-00"
                >
                  ?
                </span>
              </th>
              {hasSuggestions && (
                <th scope="col" className="col-actions" aria-label="Suggestion actions" />
              )}
            </tr>
          </thead>
          <tbody>
            {masterAccounts.length === 0 &&
              Array.from({ length: 3 }).map((_, i) => (
                <SkeletonRow key={i} cols={hasSuggestions ? 4 : 3} />
              ))}
            {masterAccounts.length > 0 &&
              lineItems.map((item, ri) => {
                const hasSuggest = !!(item._suggestDept || item._suggestAcc)
                const missingDept = !item.deptCode
                const missingAcc = !item.accountCode
                const hasError = missingDept || missingAcc
                const deptChoice = item._suggestDept
                  ? {
                      code: item._suggestDept,
                      name: masterDepts.find(d => d.code === item._suggestDept)?.name || '',
                      source: 'ai',
                    }
                  : null
                const acctOptions = allowedAccountsForDept(
                  item.deptCode,
                  masterDepts,
                  masterAccounts
                )
                const acctNotice =
                  acctOptions.length < masterAccounts.length
                    ? `${acctOptions.length} accounts allowed for ${item.deptCode}`
                    : undefined
                const accChoice = item._suggestAcc
                  ? {
                      code: item._suggestAcc,
                      name: masterAccounts.find(a => a.code === item._suggestAcc)?.name || '',
                      source: 'ai',
                    }
                  : null
                return (
                  <tr
                    key={ri}
                    className={hasSuggest ? 'row-suggest' : hasError ? 'row-error' : undefined}
                  >
                    <td className="ap-line-desc">{item.description || '—'}</td>
                    <td>
                      <CustomSearchSelect
                        value={item.deptCode || ''}
                        options={masterDepts}
                        placeholder={t('ap.searchDept')}
                        topChoice={deptChoice}
                        onChange={val => updateItem(ri, 'deptCode', val)}
                        hasError={missingDept}
                      />
                    </td>
                    <td>
                      <CustomSearchSelect
                        value={item.accountCode || ''}
                        options={acctOptions}
                        notice={acctNotice}
                        placeholder={t('ap.searchAcc')}
                        topChoice={accChoice}
                        onChange={val => updateItem(ri, 'accountCode', val)}
                        hasError={
                          missingAcc ||
                          !isAccountAllowed(item.deptCode, item.accountCode, masterDepts)
                        }
                      />
                    </td>
                    {hasSuggestions && (
                      <td>
                        {hasSuggest && (
                          <div className="ap-suggest-actions">
                            <button
                              type="button"
                              className="ap-suggest-btn ap-suggest-btn--ok"
                              onClick={() => onConfirmSuggest(ri)}
                              title="Confirm"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              className="ap-suggest-btn ap-suggest-btn--err"
                              onClick={() => onRejectSuggest(ri)}
                              title="Reject"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
