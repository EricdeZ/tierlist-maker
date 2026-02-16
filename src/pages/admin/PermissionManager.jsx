// src/pages/admin/PermissionManager.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Home, Shield, Plus, Trash2, X, Search, Key, Users, ChevronDown } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi'
import { PermissionManagerHelp } from '../../components/admin/AdminHelp'
import smiteLogo from '../../assets/smite2.png'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

export default function PermissionManager() {
    const [roles, setRoles] = useState([])
    const [userRoles, setUserRoles] = useState([])
    const [users, setUsers] = useState([])
    const [leagues, setLeagues] = useState([])
    const [permissionKeys, setPermissionKeys] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null)
    const [activeTab, setActiveTab] = useState('roles') // 'roles' | 'assignments'
    const [saving, setSaving] = useState(false)

    // Create role modal
    const [showCreateRole, setShowCreateRole] = useState(false)
    const [newRoleName, setNewRoleName] = useState('')
    const [newRoleDesc, setNewRoleDesc] = useState('')
    const [newRolePerms, setNewRolePerms] = useState([])

    // Edit role modal
    const [editRole, setEditRole] = useState(null)
    const [editRoleName, setEditRoleName] = useState('')
    const [editRoleDesc, setEditRoleDesc] = useState('')

    // Assign role modal
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [assignUserId, setAssignUserId] = useState('')
    const [assignRoleId, setAssignRoleId] = useState('')
    const [assignScope, setAssignScope] = useState('global')
    const [assignLeagueId, setAssignLeagueId] = useState('')
    const [assignSearch, setAssignSearch] = useState('')

    // Confirm modal
    const [confirmModal, setConfirmModal] = useState(null)

    // Filter state for assignments
    const [filterSearch, setFilterSearch] = useState('')

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/permission-manage`, { headers: getAuthHeaders() })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Failed to load permission data')
            }
            const data = await res.json()
            setRoles(data.roles || [])
            setUserRoles(data.userRoles || [])
            setUsers(data.users || [])
            setLeagues(data.leagues || [])
            setPermissionKeys(data.permissionKeys || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const doAction = useCallback(async (body) => {
        setSaving(true)
        try {
            const res = await fetch(`${API}/permission-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Action failed')
            return data
        } finally {
            setSaving(false)
        }
    }, [])

    // ─── Role Actions ───

    const handleCreateRole = async () => {
        if (!newRoleName.trim()) return
        try {
            await doAction({ action: 'create-role', name: newRoleName, description: newRoleDesc })
            const created = newRoleName.trim()
            // If permissions were selected, set them
            if (newRolePerms.length > 0) {
                // Need to refetch to get the new role's ID
                const res = await fetch(`${API}/permission-manage`, { headers: getAuthHeaders() })
                const data = await res.json()
                const newRole = data.roles.find(r => r.name === created)
                if (newRole) {
                    await doAction({ action: 'set-role-permissions', role_id: newRole.id, permissions: newRolePerms })
                }
            }
            showToast('success', `Role "${created}" created`)
            setShowCreateRole(false)
            setNewRoleName('')
            setNewRoleDesc('')
            setNewRolePerms([])
            fetchData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const handleUpdateRole = async () => {
        if (!editRole) return
        try {
            await doAction({ action: 'update-role', role_id: editRole.id, name: editRoleName, description: editRoleDesc })
            showToast('success', `Role updated`)
            setEditRole(null)
            fetchData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const handleDeleteRole = (role) => {
        const assignCount = userRoles.filter(ur => ur.role_id === role.id).length
        setConfirmModal({
            title: `Delete "${role.name}"`,
            message: assignCount > 0
                ? `This will remove the role and revoke it from ${assignCount} user${assignCount === 1 ? '' : 's'}. This cannot be undone.`
                : 'This role has no assignments. Delete it?',
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'delete-role', role_id: role.id })
                    showToast('success', `Role "${role.name}" deleted`)
                    fetchData()
                } catch (err) {
                    showToast('error', err.message)
                }
            },
        })
    }

    const handleTogglePermission = async (role, permKey) => {
        const current = role.permissions || []
        const next = current.includes(permKey)
            ? current.filter(k => k !== permKey)
            : [...current, permKey]
        try {
            await doAction({ action: 'set-role-permissions', role_id: role.id, permissions: next })
            fetchData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    // ─── Assignment Actions ───

    const handleAssignRole = async () => {
        if (!assignUserId || !assignRoleId) return
        try {
            await doAction({
                action: 'assign-role',
                user_id: Number(assignUserId),
                role_id: Number(assignRoleId),
                league_id: assignScope === 'league' && assignLeagueId ? Number(assignLeagueId) : null,
            })
            const userName = users.find(u => u.id === Number(assignUserId))?.discord_username || 'User'
            const roleName = roles.find(r => r.id === Number(assignRoleId))?.name || 'Role'
            showToast('success', `Assigned "${roleName}" to ${userName}`)
            setShowAssignModal(false)
            setAssignUserId('')
            setAssignRoleId('')
            setAssignScope('global')
            setAssignLeagueId('')
            setAssignSearch('')
            fetchData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const handleRevokeRole = (ur) => {
        setConfirmModal({
            title: 'Revoke Role',
            message: `Remove "${ur.role_name}" from ${ur.discord_username}${ur.league_name ? ` (${ur.league_name})` : ' (Global)'}?`,
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'revoke-role', user_role_id: ur.id })
                    showToast('success', `Revoked "${ur.role_name}" from ${ur.discord_username}`)
                    fetchData()
                } catch (err) {
                    showToast('error', err.message)
                }
            },
        })
    }

    // ─── Computed ───

    const assignmentCounts = useMemo(() => {
        const counts = {}
        for (const ur of userRoles) {
            counts[ur.role_id] = (counts[ur.role_id] || 0) + 1
        }
        return counts
    }, [userRoles])

    const filteredAssignments = useMemo(() => {
        if (!filterSearch.trim()) return userRoles
        const q = filterSearch.toLowerCase()
        return userRoles.filter(ur =>
            ur.discord_username?.toLowerCase().includes(q) ||
            ur.role_name?.toLowerCase().includes(q) ||
            ur.league_name?.toLowerCase().includes(q)
        )
    }, [userRoles, filterSearch])

    const filteredAssignUsers = useMemo(() => {
        if (!assignSearch.trim()) return users
        const q = assignSearch.toLowerCase()
        return users.filter(u => u.discord_username?.toLowerCase().includes(q))
    }, [users, assignSearch])

    const avatarUrl = (u) => u.discord_avatar
        ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=32`
        : null

    // ─── Render ───

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto py-12 px-4">
                <div className="flex items-center justify-center p-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto" />
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto pb-8 px-4">
            <PageTitle title="Permission Manager" noindex />
            <PermissionManagerHelp />

            <div className="mb-8">
                <h1 className="font-heading text-2xl font-bold text-(--color-text)">Permission Manager</h1>
                <p className="text-(--color-text-secondary) text-sm">Create roles, assign permissions, control access by league</p>
            </div>

            {/* Error / Toast */}
            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}
            {toast && (
                <div className={`mb-6 p-4 rounded-lg text-sm ${
                    toast.type === 'success'
                        ? 'bg-green-900/20 border border-green-500/20 text-green-400'
                        : 'bg-red-900/20 border border-red-500/20 text-red-400'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-1 w-fit">
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'roles'
                            ? 'bg-(--color-accent) text-(--color-primary)'
                            : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                    }`}
                >
                    <Key className="w-4 h-4" />
                    Roles ({roles.length})
                </button>
                <button
                    onClick={() => setActiveTab('assignments')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'assignments'
                            ? 'bg-(--color-accent) text-(--color-primary)'
                            : 'text-(--color-text-secondary) hover:text-(--color-text) hover:bg-white/5'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    User Assignments ({userRoles.length})
                </button>
            </div>

            {/* ═══════════════════════════ Roles Tab ═══════════════════════════ */}
            {activeTab === 'roles' && (
                <div>
                    {/* Create button */}
                    <div className="mb-4 flex justify-end">
                        <button
                            onClick={() => setShowCreateRole(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Create Role
                        </button>
                    </div>

                    {/* Role cards */}
                    <div className="grid gap-4">
                        {roles.map(role => (
                            <div
                                key={role.id}
                                className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden"
                            >
                                <div className="p-5">
                                    {/* Role header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${role.is_system ? 'bg-yellow-500/10 text-yellow-400' : 'bg-white/5 text-(--color-text-secondary)'}`}>
                                                <Key className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-heading text-lg font-semibold text-(--color-text)">{role.name}</h3>
                                                    {role.is_system && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                            System
                                                        </span>
                                                    )}
                                                </div>
                                                {role.description && (
                                                    <p className="text-sm text-(--color-text-secondary) mt-0.5">{role.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {!role.is_system && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setEditRole(role)
                                                            setEditRoleName(role.name)
                                                            setEditRoleDesc(role.description || '')
                                                        }}
                                                        className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-(--color-accent) transition-colors"
                                                        title="Edit role"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRole(role)}
                                                        className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-red-400 transition-colors"
                                                        title="Delete role"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Permissions grid */}
                                    <div className="mb-3">
                                        <p className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-2">Permissions</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {permissionKeys.map(pk => {
                                                const checked = role.permissions?.includes(pk.key)
                                                return (
                                                    <label
                                                        key={pk.key}
                                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                                            checked
                                                                ? 'bg-yellow-500/5 border-yellow-500/20 text-(--color-text)'
                                                                : 'bg-white/[0.02] border-white/5 text-(--color-text-secondary)'
                                                        }`}
                                                        title={pk.description}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => handleTogglePermission(role, pk.key)}
                                                            disabled={saving}
                                                            className="accent-yellow-500 w-3.5 h-3.5"
                                                        />
                                                        <span className="text-xs font-medium leading-tight">{pk.label}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Assignment count */}
                                    <div className="text-xs text-(--color-text-secondary)">
                                        Assigned to {assignmentCounts[role.id] || 0} user{(assignmentCounts[role.id] || 0) === 1 ? '' : 's'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════ Assignments Tab ═══════════════════════════ */}
            {activeTab === 'assignments' && (
                <div>
                    {/* Actions bar */}
                    <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary)" />
                            <input
                                type="text"
                                placeholder="Filter by user, role, or league..."
                                value={filterSearch}
                                onChange={e => setFilterSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                            />
                        </div>
                        <button
                            onClick={() => setShowAssignModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Assign Role
                        </button>
                    </div>

                    {/* Assignments table */}
                    {filteredAssignments.length === 0 ? (
                        <div className="text-center py-12 text-(--color-text-secondary)">
                            {userRoles.length === 0 ? 'No role assignments yet. Click "Assign Role" to get started.' : 'No matching assignments.'}
                        </div>
                    ) : (
                        <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-white/10">
                                    <thead className="bg-white/5">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">User</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Role</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Scope</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Granted By</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Date</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredAssignments.map(ur => (
                                            <tr key={ur.id}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        {avatarUrl(ur) ? (
                                                            <img src={avatarUrl(ur)} alt="" className="w-7 h-7 rounded-full" />
                                                        ) : (
                                                            <div className="w-7 h-7 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
                                                                {ur.discord_username?.[0]?.toUpperCase()}
                                                            </div>
                                                        )}
                                                        <span className="text-sm font-medium text-(--color-text)">{ur.discord_username}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                                        {ur.role_name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">
                                                    {ur.league_name ? (
                                                        <span className="text-(--color-text)">{ur.league_name}</span>
                                                    ) : (
                                                        <span className="text-(--color-accent) font-medium">All Leagues</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-(--color-text-secondary)">
                                                    {ur.granted_by_username || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-(--color-text-secondary)">
                                                    {ur.created_at ? new Date(ur.created_at).toLocaleDateString() : '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleRevokeRole(ur)}
                                                        className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-red-400 transition-colors"
                                                        title="Revoke role"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════ Create Role Modal ═══════════════════════════ */}
            {showCreateRole && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={e => e.target === e.currentTarget && setShowCreateRole(false)}>
                    <div className="w-full max-w-lg bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-heading text-lg font-bold text-(--color-text)">Create New Role</h3>
                            <button onClick={() => setShowCreateRole(false)} className="p-1 rounded-lg hover:bg-white/10 text-(--color-text-secondary)">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-1 block">Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. League Manager"
                                    value={newRoleName}
                                    onChange={e => setNewRoleName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-1 block">Description</label>
                                <textarea
                                    placeholder="What this role is for..."
                                    value={newRoleDesc}
                                    onChange={e => setNewRoleDesc(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50 resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-2 block">Permissions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {permissionKeys.map(pk => (
                                        <label
                                            key={pk.key}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                                newRolePerms.includes(pk.key)
                                                    ? 'bg-yellow-500/5 border-yellow-500/20 text-(--color-text)'
                                                    : 'bg-white/[0.02] border-white/5 text-(--color-text-secondary)'
                                            }`}
                                            title={pk.description}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={newRolePerms.includes(pk.key)}
                                                onChange={e => {
                                                    setNewRolePerms(prev =>
                                                        e.target.checked ? [...prev, pk.key] : prev.filter(k => k !== pk.key)
                                                    )
                                                }}
                                                className="accent-yellow-500 w-3.5 h-3.5"
                                            />
                                            <span className="text-xs font-medium">{pk.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateRole(false)}
                                className="px-4 py-2 rounded-lg text-sm text-(--color-text-secondary) hover:bg-white/5"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRole}
                                disabled={!newRoleName.trim() || saving}
                                className="px-5 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                            >
                                {saving ? 'Creating...' : 'Create Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════ Edit Role Modal ═══════════════════════════ */}
            {editRole && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={e => e.target === e.currentTarget && setEditRole(null)}>
                    <div className="w-full max-w-md bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-heading text-lg font-bold text-(--color-text)">Edit Role</h3>
                            <button onClick={() => setEditRole(null)} className="p-1 rounded-lg hover:bg-white/10 text-(--color-text-secondary)">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-1 block">Name</label>
                                <input
                                    type="text"
                                    value={editRoleName}
                                    onChange={e => setEditRoleName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent)/50"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-1 block">Description</label>
                                <textarea
                                    value={editRoleDesc}
                                    onChange={e => setEditRoleDesc(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent)/50 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditRole(null)} className="px-4 py-2 rounded-lg text-sm text-(--color-text-secondary) hover:bg-white/5">Cancel</button>
                            <button
                                onClick={handleUpdateRole}
                                disabled={!editRoleName.trim() || saving}
                                className="px-5 py-2 rounded-lg bg-(--color-accent) text-(--color-primary) text-sm font-semibold disabled:opacity-40 transition-colors"
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════ Assign Role Modal ═══════════════════════════ */}
            {showAssignModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={e => e.target === e.currentTarget && setShowAssignModal(false)}>
                    <div className="w-full max-w-md bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-heading text-lg font-bold text-(--color-text)">Assign Role to User</h3>
                            <button onClick={() => setShowAssignModal(false)} className="p-1 rounded-lg hover:bg-white/10 text-(--color-text-secondary)">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* User picker */}
                            <div>
                                <label className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-1 block">User *</label>
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    value={assignSearch}
                                    onChange={e => { setAssignSearch(e.target.value); setAssignUserId('') }}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50 mb-2"
                                />
                                {assignUserId ? (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                                        {(() => {
                                            const u = users.find(u => u.id === Number(assignUserId))
                                            return u ? (
                                                <>
                                                    {avatarUrl(u) ? (
                                                        <img src={avatarUrl(u)} alt="" className="w-5 h-5 rounded-full" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-[9px] font-bold">{u.discord_username?.[0]?.toUpperCase()}</div>
                                                    )}
                                                    <span className="text-sm text-(--color-text) font-medium">{u.discord_username}</span>
                                                    <button onClick={() => { setAssignUserId(''); setAssignSearch('') }} className="ml-auto text-(--color-text-secondary) hover:text-red-400">
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </>
                                            ) : null
                                        })()}
                                    </div>
                                ) : (
                                    <div className="max-h-36 overflow-y-auto rounded-lg border border-white/10">
                                        {filteredAssignUsers.slice(0, 20).map(u => (
                                            <button
                                                key={u.id}
                                                onClick={() => { setAssignUserId(String(u.id)); setAssignSearch(u.discord_username) }}
                                                className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors text-(--color-text)"
                                            >
                                                {avatarUrl(u) ? (
                                                    <img src={avatarUrl(u)} alt="" className="w-5 h-5 rounded-full" />
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-[9px] font-bold">{u.discord_username?.[0]?.toUpperCase()}</div>
                                                )}
                                                {u.discord_username}
                                            </button>
                                        ))}
                                        {filteredAssignUsers.length === 0 && (
                                            <div className="px-4 py-3 text-sm text-(--color-text-secondary)">No users found</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Role picker */}
                            <div>
                                <label className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-1 block">Role *</label>
                                <div className="relative">
                                    <select
                                        value={assignRoleId}
                                        onChange={e => setAssignRoleId(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent)/50 appearance-none cursor-pointer"
                                    >
                                        <option value="">Select a role...</option>
                                        {roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary) pointer-events-none" />
                                </div>
                            </div>

                            {/* Scope picker */}
                            <div>
                                <label className="text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider mb-2 block">Scope</label>
                                <div className="flex gap-3 mb-2">
                                    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                                        assignScope === 'global' ? 'bg-(--color-accent)/10 border-(--color-accent)/30 text-(--color-text)' : 'border-white/10 text-(--color-text-secondary)'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="scope"
                                            checked={assignScope === 'global'}
                                            onChange={() => { setAssignScope('global'); setAssignLeagueId('') }}
                                            className="accent-(--color-accent)"
                                        />
                                        <span className="text-sm font-medium">All Leagues</span>
                                    </label>
                                    <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                                        assignScope === 'league' ? 'bg-(--color-accent)/10 border-(--color-accent)/30 text-(--color-text)' : 'border-white/10 text-(--color-text-secondary)'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="scope"
                                            checked={assignScope === 'league'}
                                            onChange={() => setAssignScope('league')}
                                            className="accent-(--color-accent)"
                                        />
                                        <span className="text-sm font-medium">Specific League</span>
                                    </label>
                                </div>
                                {assignScope === 'league' && (
                                    <div className="relative">
                                        <select
                                            value={assignLeagueId}
                                            onChange={e => setAssignLeagueId(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-(--color-text) focus:outline-none focus:border-(--color-accent)/50 appearance-none cursor-pointer"
                                        >
                                            <option value="">Select a league...</option>
                                            {leagues.map(l => (
                                                <option key={l.id} value={l.id}>{l.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary) pointer-events-none" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 rounded-lg text-sm text-(--color-text-secondary) hover:bg-white/5">Cancel</button>
                            <button
                                onClick={handleAssignRole}
                                disabled={!assignUserId || !assignRoleId || (assignScope === 'league' && !assignLeagueId) || saving}
                                className="px-5 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                            >
                                {saving ? 'Assigning...' : 'Assign Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════ Confirm Modal ═══════════════════════════ */}
            {confirmModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="w-full max-w-sm bg-(--color-secondary) border border-white/10 rounded-2xl shadow-2xl p-6">
                        <h3 className="font-heading text-lg font-bold text-(--color-text) mb-3">{confirmModal.title}</h3>
                        <p className="text-sm text-(--color-text-secondary) mb-6">{confirmModal.message}</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmModal(null)} className="px-4 py-2 rounded-lg text-sm text-(--color-text-secondary) hover:bg-white/5">
                                Cancel
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                    confirmModal.danger
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-(--color-accent) text-(--color-primary)'
                                }`}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
