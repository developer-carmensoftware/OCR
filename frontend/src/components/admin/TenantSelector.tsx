import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchTenants } from '../../lib/api/adminClient'
import { useT } from '../../i18n/LanguageContext'

interface Tenant {
  id: string
  name: string | null
  host: string
  bu_code: string
}

interface TenantSelectorProps {
  value: string
  onChange: (tenantId: string) => void
}

export default function TenantSelector({ value, onChange }: TenantSelectorProps) {
  const { t } = useT()
  const [tenants, setTenants] = useState<Tenant[]>([])

  useEffect(() => {
    fetchTenants({ active_only: true })
      .then(r => setTenants(r.data ?? []))
      .catch(e => toast.error(`Tenants: ${e?.message ?? 'failed to load'}`))
  }, [])

  return (
    <select
      className="admin-select"
      value={value}
      onChange={e => onChange(e.target.value)}
      title={t('admin.common.tenantSelector.filterTitle')}
    >
      <option value="">{t('admin.common.tenantSelector.allTenants')}</option>
      {tenants.map(t => (
        <option key={t.id} value={t.id}>
          {t.name || t.host} ({t.bu_code})
        </option>
      ))}
    </select>
  )
}
