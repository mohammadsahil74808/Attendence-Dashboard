import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus, Shield, CheckCircle,
  XCircle, Edit, Trash2
} from 'lucide-react'
import { AppLayout, PageHeader } from '../components/layout/AppLayout'
import { Modal, ConfirmDialog } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { formatDate } from '../lib/utils'
import type { User } from '../types'

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deactivateId, setDeactivateId] = useState<number | null>(null)
  const [permanentDeleteUser, setPermanentDeleteUser] = useState<User | null>(null)

  // Fetch users (include inactive for admin management)
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get('/users/?include_inactive=true')
      return res.data
    },
  })

  // Create user mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/users/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
      toast.show('Team member created successfully', 'success')
      setAddModalOpen(false)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to create user'
      toast.show(msg, 'error')
    },
  })

  // Update user mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.patch(`/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
      toast.show('User updated', 'success')
      setEditUser(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to update user'
      toast.show(msg, 'error')
    },
  })

  // Deactivate user mutation
  const deactivateMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
      toast.show('User deactivated', 'success')
      setDeactivateId(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to deactivate user'
      toast.show(msg, 'error')
    },
  })

  // Permanent remove user mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/users/${id}?permanent=true`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users-list'] })
      toast.show('User permanently removed from system', 'success')
      setPermanentDeleteUser(null)
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || 'Failed to remove user'
      toast.show(msg, 'error')
    },
  })

  return (
    <AppLayout requireAdmin>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Team & User Management"
          subtitle="Manage administrative accounts, team members, and outreach operator roles"
          action={
            <button
              onClick={() => setAddModalOpen(true)}
              className="btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" /> Add Team Member
            </button>
          }
        />

        {/* Users Table */}
        <div className="panel overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-neutral-200">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-100 flex items-center gap-2">
                            {u.name}
                            {u.id === currentUser?.id && (
                              <span className="text-2xs font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-indigo-400">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-neutral-500 font-mono text-2xs">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase ${
                        u.role === 'admin'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}>
                        {u.role === 'admin' && <Shield className="w-3 h-3" />}
                        {u.role}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 text-2xs font-medium ${
                        u.is_active ? 'text-emerald-400' : 'text-neutral-500'
                      }`}>
                        {u.is_active ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" /> Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" /> Inactive
                          </>
                        )}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-neutral-400 font-mono text-2xs">
                      {formatDate(u.created_at)}
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setEditUser(u)}
                        className="btn-secondary text-2xs py-1 px-2.5 inline-flex items-center gap-1"
                        title="Edit User"
                      >
                        <Edit className="w-3 h-3" /> Edit
                      </button>

                      {u.id !== currentUser?.id && (
                        <>
                          {u.is_active ? (
                            <button
                              onClick={() => setDeactivateId(u.id)}
                              className="btn-secondary text-amber-400 hover:text-amber-300 text-2xs py-1 px-2.5 inline-flex items-center gap-1"
                              title="Deactivate Account"
                            >
                              <XCircle className="w-3 h-3" /> Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => updateMutation.mutate({ id: u.id, data: { is_active: true } })}
                              className="btn-secondary text-emerald-400 hover:text-emerald-300 text-2xs py-1 px-2.5 inline-flex items-center gap-1"
                              title="Reactivate Account"
                            >
                              <CheckCircle className="w-3 h-3" /> Reactivate
                            </button>
                          )}

                          <button
                            onClick={() => setPermanentDeleteUser(u)}
                            className="btn-danger text-2xs py-1 px-2 inline-flex items-center gap-1"
                            title="Remove Member Permanently"
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add User Modal */}
        <Modal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          title="Add New Team Member"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              createMutation.mutate({
                name: fd.get('name'),
                email: fd.get('email'),
                password: fd.get('password'),
                role: fd.get('role'),
              })
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Full Name</label>
              <input type="text" name="name" required className="input-text w-full" placeholder="John Doe" />
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Email Address</label>
              <input type="email" name="email" required className="input-text w-full font-mono" placeholder="john@example.com" />
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">Initial Password</label>
              <input type="password" name="password" required minLength={6} className="input-text w-full font-mono" />
            </div>

            <div>
              <label className="text-neutral-300 block mb-1 font-medium">System Role</label>
              <select name="role" defaultValue="member" className="input-select w-full">
                <option value="member">Team Member (Row-level access to assigned contacts)</option>
                <option value="admin">Administrator (Full system access & user management)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setAddModalOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={createMutation.isPending} className="btn-primary">
                {createMutation.isPending ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </Modal>

        {/* Edit User Modal */}
        <Modal
          isOpen={!!editUser}
          onClose={() => setEditUser(null)}
          title={`Edit User: ${editUser?.name}`}
        >
          {editUser && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const payload: any = {
                  name: fd.get('name'),
                  role: fd.get('role'),
                  is_active: fd.get('is_active') === 'true',
                }
                const pw = fd.get('password') as string
                if (pw) payload.password = pw
                updateMutation.mutate({ id: editUser.id, data: payload })
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Name</label>
                <input type="text" name="name" defaultValue={editUser.name} required className="input-text w-full" />
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Role</label>
                <select name="role" defaultValue={editUser.role} className="input-select w-full">
                  <option value="member">Team Member</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Active Status</label>
                <select name="is_active" defaultValue={String(editUser.is_active)} className="input-select w-full">
                  <option value="true">Active</option>
                  <option value="false">Inactive / Deactivated</option>
                </select>
              </div>

              <div>
                <label className="text-neutral-300 block mb-1 font-medium">Reset Password (Optional)</label>
                <input type="password" name="password" placeholder="Leave blank to keep current" className="input-text w-full font-mono" />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setEditUser(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={updateMutation.isPending} className="btn-primary">
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* Deactivate Confirm */}
        <ConfirmDialog
          isOpen={!!deactivateId}
          onClose={() => setDeactivateId(null)}
          onConfirm={() => {
            if (deactivateId) deactivateMutation.mutate(deactivateId)
          }}
          title="Deactivate Team Member"
          message="Are you sure you want to deactivate this account? The user will no longer be able to log in or access assigned contacts."
          confirmLabel="Deactivate Account"
          isDanger
        />

        {/* Permanent Remove Confirm */}
        <ConfirmDialog
          isOpen={!!permanentDeleteUser}
          onClose={() => setPermanentDeleteUser(null)}
          onConfirm={() => {
            if (permanentDeleteUser) permanentDeleteMutation.mutate(permanentDeleteUser.id)
          }}
          title="Remove Member Permanently?"
          message={`Are you sure you want to completely remove "${permanentDeleteUser?.name}" (${permanentDeleteUser?.email}) from the database? Any leads assigned to them will become Unassigned.`}
          confirmLabel="Delete Forever"
          isDanger
        />
      </div>
    </AppLayout>
  )
}
