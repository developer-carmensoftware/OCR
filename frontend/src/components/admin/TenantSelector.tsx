import { useEffect, useId, useState } from 'react'
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

/** The endpoint's maximum. It defaulted to 200, so BU #201 was simply not in the list. */
const TENANT_LIMIT = 500

const label = (t: Tenant) => `${t.name || t.host} (${t.bu_code})`

export default function TenantSelector({ value, onChange }: TenantSelectorProps) {
  const { t } = useT()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [text, setText] = useState('')
  const listId = useId()

  useEffect(() => {
    fetchTenants({ active_only: true, limit: TENANT_LIMIT })
      .then(r => setTenants(r.data ?? []))
      .catch(e => toast.error(`Tenants: ${e?.message ?? 'failed to load'}`))
  }, [])

  // Follow the parent (a restored URL, a cleared filter) without fighting the typist.
  useEffect(() => {
    const picked = tenants.find(x => x.id === value)
    setText(picked ? label(picked) : '')
  }, [value, tenants])

  // A native <datalist>, not a combobox library: it gives type-ahead over hundreds of
  // BUs with no dependency and no custom keyboard handling to get wrong. The trade is
  // that the browser owns the dropdown's look, which for a filter control is fine.
  return (
    <>
      <input
        type="text"
        role="combobox"
        list={listId}
        className="admin-select admin-tenant-input"
        value={text}
        placeholder={t('admin.common.tenantSelector.allTenants')}
        aria-label={t('admin.common.tenantSelector.filterTitle')}
        title={t('admin.common.tenantSelector.filterTitle')}
        onChange={e => {
          const next = e.target.value
          setText(next)
          // Empty box means "all tenants" — the same thing the old blank <option> did.
          if (!next.trim()) {
            if (value) onChange('')
            return
          }
          const hit = tenants.find(x => label(x) === next)
          if (hit) onChange(hit.id)
        }}
        onBlur={() => {
          // Half-typed text that matches nothing is not a filter. Snap back rather than
          // leaving the box reading like a filter that is not applied.
          const picked = tenants.find(x => x.id === value)
          setText(picked ? label(picked) : '')
        }}
      />
      <datalist id={listId}>
        {tenants.map(x => (
          <option key={x.id} value={label(x)} />
        ))}
      </datalist>
    </>
  )
}
