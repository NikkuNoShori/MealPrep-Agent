import React, { useState } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import {
  useAdminUsers,
  useAdminInvites,
  useAdminHouseholds,
  useAdminDeleteUser,
  useAdminDeleteInvite,
  useAdminRemoveHouseholdMember,
  useAdminDeleteHousehold,
} from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { Loader2, Users, Mail, Home, Trash2, CheckCircle, XCircle, Clock, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

type Tab = 'users' | 'invites' | 'households'

const Admin: React.FC = () => {
  useDocumentTitle()
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const { user: currentUser } = useAuthStore()

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'invites', label: 'Invites', icon: Mail },
    { id: 'households', label: 'Households', icon: Home },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/25">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage users, invites, and households</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'users' && <UsersTab currentUserId={currentUser?.id} />}
      {activeTab === 'invites' && <InvitesTab />}
      {activeTab === 'households' && <HouseholdsTab />}
    </div>
  )
}

// ── Users Tab ──

const UsersTab: React.FC<{ currentUserId?: string }> = ({ currentUserId }) => {
  const { data: users, isLoading } = useAdminUsers()
  const deleteUser = useAdminDeleteUser()

  const handleDelete = (userId: string, name: string) => {
    if (userId === currentUserId) {
      toast.error("You can't delete your own account")
      return
    }
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return
    deleteUser.mutate(userId, {
      onSuccess: () => toast.success(`Deleted ${name}`),
      onError: (err: any) => toast.error(err.message || 'Failed to delete user'),
    })
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-white/[0.06] overflow-hidden">
      <div className="px-6 py-3 border-b border-gray-100 dark:border-white/5 flex items-center gap-4">
        <div className="w-9 flex-shrink-0" />
        <span className="flex-1 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">User ({users?.length || 0})</span>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider hidden lg:block">Provider</span>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</span>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider hidden md:block">Last Sign In</span>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider hidden md:block">Joined</span>
        <div className="w-8" />
      </div>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {(users || []).map((u: any) => (
          <div key={u.id} className="px-6 py-4 flex items-center gap-4">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              {u.avatar_url ? (
                <img
                  src={u.avatar_url}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-white text-sm font-semibold">
                  {(u.display_name || u.email || '?')[0].toUpperCase()}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {u.display_name || 'No name'}
                {u.id === currentUserId && (
                  <span className="ml-2 text-xs text-amber-500 font-normal">(you)</span>
                )}
                {!u.has_profile && (
                  <span className="ml-2 text-xs text-red-400 font-normal">(no profile)</span>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
            </div>

            {/* Provider */}
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden lg:block">
              {u.provider}
            </span>

            {/* Setup status */}
            <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
              u.setup_completed
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
              {u.setup_completed ? 'Active' : 'Pending Setup'}
            </span>

            {/* Last sign in */}
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden md:block" title="Last sign in">
              {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : 'Never'}
            </span>

            {/* Joined date */}
            <span className="text-xs text-gray-400 dark:text-gray-500 hidden md:block" title="Created">
              {new Date(u.created_at).toLocaleDateString()}
            </span>

            {/* Delete */}
            {u.id !== currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(u.id, u.display_name || u.email)}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 h-auto"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Invites Tab ──

const InvitesTab: React.FC = () => {
  const { data: invites, isLoading } = useAdminInvites()
  const deleteInvite = useAdminDeleteInvite()

  const handleDelete = (inviteId: string, email: string) => {
    if (!confirm(`Delete invite for "${email}"?`)) return
    deleteInvite.mutate(inviteId, {
      onSuccess: () => toast.success(`Invite deleted`),
      onError: (err: any) => toast.error(err.message || 'Failed to delete invite'),
    })
  }

  const statusConfig: Record<string, { icon: React.ElementType; color: string }> = {
    pending: { icon: Clock, color: 'text-amber-500' },
    accepted: { icon: CheckCircle, color: 'text-emerald-500' },
    declined: { icon: XCircle, color: 'text-red-500' },
    expired: { icon: XCircle, color: 'text-gray-400' },
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-white/[0.06] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5">
        <p className="text-sm text-gray-500 dark:text-gray-400">{invites?.length || 0} invites</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {(invites || []).length === 0 && (
          <div className="px-6 py-12 text-center text-sm text-gray-400">No invites found</div>
        )}
        {(invites || []).map((inv: any) => {
          const cfg = statusConfig[inv.status] || statusConfig.expired
          const StatusIcon = cfg.icon
          return (
            <div key={inv.id} className="px-6 py-4 flex items-center gap-4">
              <StatusIcon className={`w-5 h-5 flex-shrink-0 ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {inv.invitedEmail}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Invited by {inv.inviterName || 'Unknown'} to {inv.households?.name || 'Unknown household'}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${
                inv.status === 'pending' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                inv.status === 'accepted' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400'
              }`}>
                {inv.status}
              </span>
              <span className="text-xs text-gray-400 hidden sm:block">
                {new Date(inv.createdAt).toLocaleDateString()}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(inv.id, inv.invitedEmail)}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 h-auto"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Households Tab ──

const HouseholdsTab: React.FC = () => {
  const { data: households, isLoading } = useAdminHouseholds()
  const removeMember = useAdminRemoveHouseholdMember()
  const deleteHousehold = useAdminDeleteHousehold()

  const handleRemoveMember = (memberId: string, memberName: string, householdName: string) => {
    if (!confirm(`Remove "${memberName}" from "${householdName}"?`)) return
    removeMember.mutate(memberId, {
      onSuccess: () => toast.success(`Member removed`),
      onError: (err: any) => toast.error(err.message || 'Failed to remove member'),
    })
  }

  const handleDeleteHousehold = (householdId: string, householdName: string) => {
    if (!confirm(`Delete household "${householdName}" and remove all members? This cannot be undone.`)) return
    deleteHousehold.mutate(householdId, {
      onSuccess: () => toast.success(`Deleted ${householdName}`),
      onError: (err: any) => toast.error(err.message || 'Failed to delete household'),
    })
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      {(households || []).length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-white/[0.06] px-6 py-12 text-center text-sm text-gray-400">
          No households found
        </div>
      )}
      {(households || []).map((h: any) => (
        <div
          key={h.id}
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-white/[0.06] overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{h.name}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Created {new Date(h.createdAt).toLocaleDateString()} · {h.householdMembers?.length || 0} members
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteHousehold(h.id, h.name)}
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 h-auto"
              title="Delete household"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {(h.householdMembers || []).map((m: any) => (
              <div key={m.id} className="px-6 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">
                    {m.profiles?.displayName || m.profiles?.email || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{m.profiles?.email}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium capitalize ${
                  m.role === 'owner' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                  m.role === 'admin' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400'
                }`}>
                  {m.role}
                </span>
                {m.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(m.id, m.profiles?.displayName || 'this member', h.name)}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 h-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const LoadingState = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
  </div>
)

export default Admin
