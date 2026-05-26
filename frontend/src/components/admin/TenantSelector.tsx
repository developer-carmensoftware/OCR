import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchTenants } from '../../lib/api/adminClient'

interface Tenant {
  id: string
  name: string
  host: string
  bu_code: string
}

interface TenantSelectorProps {
  value: string
  onChange: (tenantId: string) => void
}

export default function TenantSelector({ value, onChange }: TenantSelectorProps) {
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
      title="Filter by tenant"
    >
      <option value="">All Tenants</option>
      {tenants.map(t => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.bu_code})
        </option>
      ))}
    </select>
  )
}
