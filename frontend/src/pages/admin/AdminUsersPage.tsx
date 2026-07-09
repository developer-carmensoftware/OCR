import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import DataTable, { type Column } from '../../components/admin/DataTable'
import CustomModal from '../../components/common/CustomModal'
import PageHeader from '../../components/admin/ui/PageHeader'
import Card from '../../components/admin/ui/Card'
import Switch from '../../components/admin/ui/Switch'
import Button from '../../components/admin/ui/Button'
import EmptyState from '../../components/admin/ui/EmptyState'
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  replaceAdminUserRoles,
  fetchRoles,
  type AdminUserRow,
  type RoleOption,
} from '../../lib/api/adminClient'
import { useAdminAuth } from '../../contexts/AdminAuthContext'
import { useT } from '../../i18n/LanguageContext'

export default function AdminUsersPage() {
  const { t } = useT()
  const { admin: currentAdmin } = useAdminAuth()
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createFullName, setCreateFullName] = useState('')
  const [createRoleIds, setCreateRoleIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const [fullNameDrafts, setFullNameDrafts] = useState<Record<string, string>>({})
  const [roleDrafts, setRoleDrafts] = useState<Record<string, string[]>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<string | null>(null)
  const [passwordResetTarget, setPasswordResetTarget] = useState<string | null>(null)
  const [passwordResetValue, setPasswordResetValue] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([fetchAdminUsers(), fetchRoles()])
      .then(([usersRes, rolesRes]) => {
        setRows(usersRes.data ?? [])
        setRoles(rolesRes.data ?? [])
      })
      .catch(e =>
        toast.error(t('admin.adminUsers.toast.loadFailed', { error: e?.message ?? 'failed' }))
      )
      .finally(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  const toggleRow = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id))
  }

  const roleNameToId = (name: string) =>
    roles.find(r => r.name === name || r.id === name)?.id ?? name

  const handleCreate = async () => {
    if (!createEmail.trim() || !createPassword) {
      toast.error(t('admin.adminUsers.toast.createInvalid'))
      return
    }
    setCreating(true)
    try {
      await createAdminUser({
        email: createEmail.trim(),
        password: createPassword,
        full_name: createFullName.trim() || null,
        role_ids: createRoleIds,
      })
      toast.success(t('admin.adminUsers.toast.createSuccess'))
      setShowCreate(false)
      setCreateEmail('')
      setCreatePassword('')
      setCreateFullName('')
      setCreateRoleIds([])
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const handleSaveFullName = async (row: AdminUserRow) => {
    const value = fullNameDrafts[row.id] ?? row.full_name ?? ''
    setSavingId(row.id)
    try {
      await updateAdminUser(row.id, { full_name: value })
      toast.success(t('admin.adminUsers.toast.updateSuccess'))
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  const handleToggleActive = async (row: AdminUserRow, next: boolean) => {
    if (!next) {
      setDeactivateTarget(row.id)
      return
    }
    try {
      await updateAdminUser(row.id, { is_active: true })
      toast.success(t('admin.adminUsers.toast.reactivateSuccess'))
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!deactivateTarget) return
    const id = deactivateTarget
    setDeactivateTarget(null)
    try {
      await updateAdminUser(id, { is_active: false })
      toast.success(t('admin.adminUsers.toast.deactivateSuccess'))
      load()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const handleSaveRoles = async (row: AdminUserRow) => {
    const roleIds = (roleDrafts[row.id] ?? row.roles.map(roleNameToId)).slice()
    setSavingId(`roles:${row.id}`)
    try {
      await replaceAdminUserRoles(row.id, roleIds)
      toast.success(t('admin.adminUsers.toast.rolesSuccess'))
      load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSavingId(null)
    }
  }

  const handleConfirmPasswordReset = async () => {
    if (!passwordResetTarget || !passwordResetValue) return
    const id = passwordResetTarget
    try {
      await resetAdminUserPassword(id, passwordResetValue)
      toast.success(t('admin.adminUsers.toast.passwordResetSuccess'))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPasswordResetTarget(null)
      setPasswordResetValue('')
    }
  }

  const columns: Column<AdminUserRow>[] = [
    {
      key: '_expand',
      label: '',
      render: r => (
        <button
          type="button"
          className="admin-icon-btn"
          aria-label={
            expandedId === r.id ? t('admin.adminUsers.collapse') : t('admin.adminUsers.expand')
          }
          aria-expanded={expandedId === r.id}
          onClick={() => toggleRow(r.id)}
        >
          {expandedId === r.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      ),
    },
    {
      key: 'email',
      label: t('admin.adminUsers.col.email'),
      sortable: true,
      render: r => (
        <div>
          <div>{r.email}</div>
          {r.full_name && <div className="admin-sub-text">{r.full_name}</div>}
        </div>
      ),
    },
    {
      key: 'roles',
      label: t('admin.adminUsers.col.roles'),
      render: r =>
        r.roles.length === 0 ? (
          <span className="admin-sub-text">{t('admin.adminUsers.noRoles')}</span>
        ) : (
          <div className="tenant-chips">
            {r.roles.map(name => (
              <span key={name} className="tenant-chip">
                {name}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: 'is_active',
      label: t('admin.adminUsers.col.status'),
      render: r => (
        <span className={`status-badge ${r.is_active ? 'ok' : 'error'}`}>
          {r.is_active
            ? t('admin.adminUsers.status.active')
            : t('admin.adminUsers.status.inactive')}
        </span>
      ),
    },
    {
      key: 'last_login_at',
      label: t('admin.adminUsers.col.lastLogin'),
      render: r => r.last_login_at ?? t('admin.adminUsers.never'),
    },
  ]

  const renderExpandedRow = (row: AdminUserRow) => {
    const isSelf = currentAdmin?.admin_id === row.id
    const selectedRoleIds = roleDrafts[row.id] ?? row.roles.map(roleNameToId)

    return (
      <div className="tenant-detail">
        <section className="tenant-detail-section">
          <h4>{t('admin.adminUsers.detail.profile')}</h4>
          <div className="quota-manage-row">
            <input
              type="text"
              className="admin-form-input"
              value={fullNameDrafts[row.id] ?? row.full_name ?? ''}
              onChange={e => setFullNameDrafts(prev => ({ ...prev, [row.id]: e.target.value }))}
              placeholder={t('admin.adminUsers.form.fullName')}
              aria-label={t('admin.adminUsers.form.fullName')}
            />
            <Button
              variant="outline"
              disabled={savingId === row.id}
              onClick={() => handleSaveFullName(row)}
            >
              {t('admin.adminUsers.detail.save')}
            </Button>
          </div>

          <Switch
            checked={row.is_active}
            onChange={v => handleToggleActive(row, v)}
            disabled={isSelf}
            label={
              isSelf ? t('admin.adminUsers.detail.activeSelf') : t('admin.adminUsers.detail.active')
            }
          />

          <div className="quota-manage-row">
            <Button variant="outline" onClick={() => setPasswordResetTarget(row.id)}>
              {t('admin.adminUsers.detail.resetPassword')}
            </Button>
          </div>
        </section>

        <section className="tenant-detail-section">
          <h4>{t('admin.adminUsers.detail.roles')}</h4>
          <div className="module-toggle-list">
            {roles.map(role => {
              const checked = selectedRoleIds.includes(role.id)
              return (
                <Switch
                  key={role.id}
                  checked={checked}
                  onChange={v =>
                    setRoleDrafts(prev => {
                      const current = prev[row.id] ?? row.roles.map(roleNameToId)
                      const next = v ? [...current, role.id] : current.filter(id => id !== role.id)
                      return { ...prev, [row.id]: next }
                    })
                  }
                  label={role.name}
                />
              )
            })}
          </div>
          <Button
            variant="outline"
            disabled={savingId === `roles:${row.id}`}
            onClick={() => handleSaveRoles(row)}
          >
            {t('admin.adminUsers.detail.saveRoles')}
          </Button>
        </section>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <PageHeader
        title={t('admin.adminUsers.title')}
        description={t('admin.adminUsers.description')}
        actions={
          <Button variant="primary" onClick={() => setShowCreate(v => !v)}>
            {t('admin.adminUsers.newUser')}
          </Button>
        }
      />

      {showCreate && (
        <Card title={t('admin.adminUsers.form.createTitle')}>
          <div className="quota-manage-list">
            <input
              type="email"
              className="admin-form-input"
              placeholder={t('admin.adminUsers.form.email')}
              value={createEmail}
              onChange={e => setCreateEmail(e.target.value)}
              aria-label={t('admin.adminUsers.form.email')}
            />
            <input
              type="password"
              className="admin-form-input"
              placeholder={t('admin.adminUsers.form.password')}
              value={createPassword}
              onChange={e => setCreatePassword(e.target.value)}
              aria-label={t('admin.adminUsers.form.password')}
            />
            <input
              type="text"
              className="admin-form-input"
              placeholder={t('admin.adminUsers.form.fullName')}
              value={createFullName}
              onChange={e => setCreateFullName(e.target.value)}
              aria-label={t('admin.adminUsers.form.fullName')}
            />
            <div className="module-toggle-list">
              {roles.map(role => (
                <Switch
                  key={role.id}
                  checked={createRoleIds.includes(role.id)}
                  onChange={v =>
                    setCreateRoleIds(prev =>
                      v ? [...prev, role.id] : prev.filter(id => id !== role.id)
                    )
                  }
                  label={role.name}
                />
              ))}
            </div>
            <div className="quota-manage-row">
              <Button variant="primary" disabled={creating} onClick={handleCreate}>
                {t('admin.adminUsers.form.create')}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                {t('admin.adminUsers.form.cancel')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={<UserCog size={22} strokeWidth={1.75} />}
          title={t('admin.adminUsers.emptyTitle')}
          description={t('admin.adminUsers.emptyDescription')}
        />
      ) : (
        <Card>
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            emptyText={t('admin.adminUsers.empty')}
            expandedRowId={expandedId}
            renderExpandedRow={renderExpandedRow}
          />
        </Card>
      )}

      <CustomModal
        show={deactivateTarget !== null}
        title={t('admin.adminUsers.modal.deactivateTitle')}
        message={t('admin.adminUsers.modal.deactivateMessage')}
        type="warning"
        confirmText={t('admin.adminUsers.modal.deactivateConfirm')}
        cancelText={t('admin.adminUsers.modal.cancel')}
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      <CustomModal
        show={passwordResetTarget !== null}
        title={t('admin.adminUsers.modal.resetPasswordTitle')}
        type="warning"
        inputLabel={t('admin.adminUsers.form.newPassword')}
        inputValue={passwordResetValue}
        onInputChange={setPasswordResetValue}
        inputType="password"
        confirmText={t('admin.adminUsers.modal.resetPasswordConfirm')}
        cancelText={t('admin.adminUsers.modal.cancel')}
        onConfirm={handleConfirmPasswordReset}
        onCancel={() => {
          setPasswordResetTarget(null)
          setPasswordResetValue('')
        }}
      />
    </div>
  )
}
