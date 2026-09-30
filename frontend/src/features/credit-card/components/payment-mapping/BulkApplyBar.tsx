import { useState } from 'react'
import CustomSearchSelect from '@/shared/components/common/CustomSearchSelect'
import { useT } from '@/i18n/LanguageContext'
import { allowedAccountsForDept, isAccountAllowed } from '@/shared/lib/deptAccounts'
import type {
  MasterAccount,
  MasterDepartment,
} from '@/features/credit-card/hooks/mapping/useMappingData'

/**
 * What the toolbar turns into while rows are selected: one department and one account,
 * written to every selected row at once. A settlement report prints VS INTER NON-PREM,
 * VS INTER PREM and VS INTER UP PREM that all post to the same receivable — three picks
 * of the same two codes is the job this removes (A2X's "bulk apply", Polaris' bulk bar).
 *
 * The account list follows the department exactly as a row's does, so a bulk write can
 * never produce a pair the row would have refused. Either field may be left blank to
 * write only the other.
 */

interface Props {
  count: number
  masterAccounts: MasterAccount[]
  masterDepartments: MasterDepartment[]
  onApply: (patch: { dept?: string; acc?: string }) => void
  onClear: () => void
}

export default function BulkApplyBar({
  count,
  masterAccounts,
  masterDepartments,
  onApply,
  onClear,
}: Props) {
  const { t } = useT()
  const [dept, setDept] = useState('')
  const [acc, setAcc] = useState('')

  const accounts = allowedAccountsForDept(dept, masterDepartments, masterAccounts)

  const apply = () => {
    const patch: { dept?: string; acc?: string } = {}
    if (dept) patch.dept = dept
    if (acc) patch.acc = acc
    onApply(patch)
    setDept('')
    setAcc('')
  }

  return (
    <div className="pm-bulk" role="region" aria-label={t('cc.pmBulkRegion')}>
      <span className="pm-bulk-count">{t('cc.pmBulkSelected', { n: count })}</span>
      <div className="pm-bulk-field">
        <CustomSearchSelect
          value={dept}
          onChange={v => {
            setDept(v)
            if (!isAccountAllowed(v, acc, masterDepartments)) setAcc('')
          }}
          options={masterDepartments}
          placeholder={t('cc.pmBulkDept')}
          aria-label={t('cc.pmBulkDept')}
        />
      </div>
      <div className="pm-bulk-field">
        <CustomSearchSelect
          value={acc}
          onChange={setAcc}
          options={accounts}
          placeholder={t('cc.pmBulkAcc')}
          aria-label={t('cc.pmBulkAcc')}
        />
      </div>
      <button
        type="button"
        className="btn btn-confirm btn-sm"
        onClick={apply}
        disabled={!dept && !acc}
      >
        {t('cc.pmBulkApply')}
      </button>
      <button type="button" className="pm-link-btn" onClick={onClear}>
        {t('cc.pmBulkClear')}
      </button>
    </div>
  )
}
