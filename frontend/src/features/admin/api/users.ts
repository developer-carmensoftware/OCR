/** Admin user management (IAM). */

import { unwrapDetail } from '@/features/admin/api/common'
import { adminFetch } from '@/shared/api/adminAuth'
import { API } from '@/shared/api/endpoints'

export interface AdminUserRow {
  id: string
  username: string
  full_name: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string | null
  roles: string[]
}

export interface RoleOption {
  id: string
  name: string
  description: string | null
  is_system: boolean
}

export async function fetchAdminUsers(): Promise<{ data: AdminUserRow[] }> {
  const res = await adminFetch(API.admin.adminUsers)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch admin users'))
  return res.json()
}

export async function createAdminUser(payload: {
  username: string
  password: string
  full_name?: string | null
  role_ids: string[]
}): Promise<AdminUserRow> {
  const res = await adminFetch(API.admin.adminUsers, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to create admin user'))
  return res.json()
}

export async function updateAdminUser(
  userId: string,
  payload: { full_name?: string | null; is_active?: boolean }
): Promise<AdminUserRow> {
  const res = await adminFetch(API.admin.adminUser(userId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to update admin user'))
  return res.json()
}

export async function resetAdminUserPassword(userId: string, newPassword: string): Promise<void> {
  const res = await adminFetch(API.admin.adminUserPasswordReset(userId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_password: newPassword }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to reset password'))
}

export async function replaceAdminUserRoles(
  userId: string,
  roleIds: string[]
): Promise<{ id: string; role_ids: string[] }> {
  const res = await adminFetch(API.admin.adminUserRoles(userId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role_ids: roleIds }),
  })
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to update roles'))
  return res.json()
}

export async function fetchRoles(): Promise<{ data: RoleOption[] }> {
  const res = await adminFetch(API.admin.roles)
  if (!res.ok) throw new Error(await unwrapDetail(res, 'Failed to fetch roles'))
  return res.json()
}
