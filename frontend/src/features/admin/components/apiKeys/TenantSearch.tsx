import type { ComponentProps } from 'react'
import { Search } from 'lucide-react'
import TenantSelector from '@/features/admin/components/TenantSelector'

/** The tenant type-ahead with a drawn search icon in place of the browser's datalist
 *  triangle, which ignores the theme (black in dark mode). */
export default function TenantSearch(props: ComponentProps<typeof TenantSelector>) {
  return (
    <span className="apikeys-tenant">
      <Search size={14} strokeWidth={2} aria-hidden="true" />
      <TenantSelector {...props} />
    </span>
  )
}
