import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Search, Trash2, UserPlus, Settings2 } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi.js'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

export default function LeagueStaff() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedLeagueId, setSelectedLeagueId] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [adding, setAdding] = useState(null)
    const [confirmRemove, setConfirmRemove] = useState(null)
    const [toast, setToast] = useState(null)
    const [editingDivisions, setEditingDivisions] = useState(null)
    const [pendingDivisions, setPendingDivisions] = useState([])
    const [savingDivisions, setSavingDivisions] = useState(false)
    const searchTimeout = useRef(null)

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/league-staff`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setData(await res.json())
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    useEffect(() => {
        if (!selectedLeagueId && data?.leagues?.length > 0) {
            setSelectedLeagueId(data.leagues[0].id)
        }
    }, [data, selectedLeagueId])

    // Debounced user search
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([])
            return
        }
        clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(async () => {
            setSearching(true)
            try {
                const res = await fetch(`${API}/league-staff`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ action: 'search-users', query: searchQuery }),
                })
                const d = await res.json()
                setSearchResults(d.users || [])
            } catch {
                setSearchResults([])
            } finally {
                setSearching(false)
            }
        }, 300)
        return () => clearTimeout(searchTimeout.current)
    }, [searchQuery])

    const handleAddStaff = async (userId) => {
        setAdding(userId)
        try {
            const res = await fetch(`${API}/league-staff`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'add-staff', user_id: userId, league_id: selectedLeagueId }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
            showToast('success', 'Staff member added')
            setSearchQuery('')
            setSearchResults([])
            fetchData()
        } catch (e) {
            showToast('error', e.message)
        } finally {
            setAdding(null)
        }
    }

    const handleRemoveStaff = async () => {
        if (!confirmRemove) return
        const { assignment_id } = confirmRemove
        setConfirmRemove(null)
        try {
            const res = await fetch(`${API}/league-staff`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'remove-staff', assignment_id }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
            showToast('success', 'Staff member removed')
            fetchData()
        } catch (e) {
            showToast('error', e.message)
        }
    }

    const openDivisionEditor = (assignmentId) => {
        const current = (data?.divisionAccess || [])
            .filter(da => da.user_role_id === assignmentId)
            .map(da => da.division_id)
        setPendingDivisions(current)
        setEditingDivisions(assignmentId)
    }

    const handleSaveDivisions = async () => {
        setSavingDivisions(true)
        try {
            const res = await fetch(`${API}/league-staff`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    action: 'set-divisions',
                    assignment_id: editingDivisions,
                    division_ids: pendingDivisions,
                }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
            showToast('success', 'Division access updated')
            setEditingDivisions(null)
            fetchData()
        } catch (e) {
            showToast('error', e.message)
        } finally {
            setSavingDivisions(false)
        }
    }

    const leagueDivisions = (data?.divisions || []).filter(d => d.league_id === selectedLeagueId)
    const leagueStaff = data?.staff?.filter(s => s.league_id === selectedLeagueId) || []
    const leagueAdmins = data?.admins?.filter(a => a.league_id === selectedLeagueId) || []
    const allMemberIds = new Set([...leagueStaff.map(s => s.user_id), ...leagueAdmins.map(a => a.user_id)])
    const filteredResults = searchResults.filter(u => !allMemberIds.has(u.id))

    const avatarUrl = (discordId, avatar) =>
        avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64` : null

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent)" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-6 text-center">
                    <p className="text-red-400 font-medium">Failed to load: {error}</p>
                    <button onClick={() => { setError(null); setLoading(true); fetchData() }}
                        className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <PageTitle title="League Staff" noindex />

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white
                    ${toast.type === 'error' ? 'bg-red-900/90 border border-red-500/30' : 'bg-green-900/90 border border-green-500/30'}`}>
                    {toast.message}
                </div>
            )}

            {/* Confirm remove modal */}
            {confirmRemove && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setConfirmRemove(null)}>
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-6 max-w-md mx-4"
                        onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-(--color-text) mb-2">Remove Staff Member</h3>
                        <p className="text-sm text-(--color-text-secondary) mb-6">
                            Remove <span className="text-(--color-text) font-medium">{confirmRemove.username}</span> from staff?
                            They will lose all league management permissions.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setConfirmRemove(null)}
                                className="px-4 py-2 rounded-lg text-sm text-(--color-text-secondary) bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleRemoveStaff}
                                className="px-4 py-2 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700 transition-colors">
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                    <Users className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-(--color-text)">League Staff</h1>
                    <p className="text-sm text-(--color-text-secondary)">Add staff members to help manage your leagues</p>
                </div>
            </div>

            {/* League selector */}
            {data.leagues.length > 1 && (
                <div className="mb-6">
                    <select
                        value={selectedLeagueId || ''}
                        onChange={e => setSelectedLeagueId(Number(e.target.value))}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-(--color-secondary) border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)"
                    >
                        {data.leagues.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {data.leagues.length === 0 && (
                <div className="text-center py-12 text-(--color-text-secondary)">
                    No leagues available to manage staff for.
                </div>
            )}

            {selectedLeagueId && (
                <>
                    {/* League admins */}
                    {leagueAdmins.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
                                League Admins ({leagueAdmins.length})
                            </h2>
                            <div className="space-y-2">
                                {leagueAdmins.map(a => (
                                    <div key={`${a.user_id}-${a.league_id}`}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-(--color-secondary) border border-amber-500/10">
                                        {avatarUrl(a.discord_id, a.discord_avatar) ? (
                                            <img src={avatarUrl(a.discord_id, a.discord_avatar)} alt=""
                                                className="w-9 h-9 rounded-full" />
                                        ) : (
                                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs text-(--color-text-secondary)">
                                                {a.discord_username?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-(--color-text) truncate">
                                                {a.discord_username}
                                            </div>
                                            <div className="text-xs text-(--color-text-secondary)">
                                                {a.role_name}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Current staff */}
                    <div className="mb-8">
                        <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
                            Staff ({leagueStaff.length})
                        </h2>

                        {leagueStaff.length === 0 ? (
                            <div className="rounded-xl border border-white/5 bg-(--color-secondary) p-8 text-center text-(--color-text-secondary) text-sm">
                                No staff members yet. Use the search below to add someone.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {leagueStaff.map(s => {
                                    const staffDivs = (data?.divisionAccess || []).filter(da => da.user_role_id === s.assignment_id)
                                    const isEditing = editingDivisions === s.assignment_id
                                    return (
                                        <div key={s.assignment_id}
                                            className="rounded-xl bg-(--color-secondary) border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                {avatarUrl(s.discord_id, s.discord_avatar) ? (
                                                    <img src={avatarUrl(s.discord_id, s.discord_avatar)} alt=""
                                                        className="w-9 h-9 rounded-full" />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs text-(--color-text-secondary)">
                                                        {s.discord_username?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-(--color-text) truncate">
                                                        {s.discord_username}
                                                    </div>
                                                    <div className="text-xs text-(--color-text-secondary)">
                                                        Added {new Date(s.created_at).toLocaleDateString()}
                                                        {s.granted_by_username && <> by {s.granted_by_username}</>}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {staffDivs.length === 0 ? (
                                                            <span className="text-xs text-green-400/70">All Divisions</span>
                                                        ) : (
                                                            staffDivs.map(da => {
                                                                const div = leagueDivisions.find(d => d.id === da.division_id)
                                                                return div ? (
                                                                    <span key={da.division_id}
                                                                        className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300/80">
                                                                        {div.name}
                                                                    </span>
                                                                ) : null
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                                {leagueDivisions.length > 0 && (
                                                    <button
                                                        onClick={() => isEditing ? setEditingDivisions(null) : openDivisionEditor(s.assignment_id)}
                                                        className={`p-2 rounded-lg transition-colors ${isEditing
                                                            ? 'text-amber-400 bg-amber-500/10'
                                                            : 'text-(--color-text-secondary) hover:text-amber-400 hover:bg-amber-500/10'}`}
                                                        title="Edit division access"
                                                    >
                                                        <Settings2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setConfirmRemove({ assignment_id: s.assignment_id, username: s.discord_username })}
                                                    className="p-2 rounded-lg text-(--color-text-secondary) hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="Remove staff member"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {isEditing && (
                                                <div className="px-4 pb-3 pt-1 border-t border-white/5">
                                                    <div className="text-xs font-medium text-(--color-text-secondary) mb-2">Division Access</div>
                                                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                                                        <input type="checkbox"
                                                            checked={pendingDivisions.length === 0}
                                                            onChange={() => setPendingDivisions([])}
                                                            className="rounded accent-amber-500" />
                                                        <span className="text-sm text-(--color-text)">All Divisions</span>
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-1 ml-1">
                                                        {leagueDivisions.map(d => (
                                                            <label key={d.id} className="flex items-center gap-2 cursor-pointer py-0.5">
                                                                <input type="checkbox"
                                                                    checked={pendingDivisions.includes(d.id)}
                                                                    onChange={() => {
                                                                        setPendingDivisions(prev =>
                                                                            prev.includes(d.id)
                                                                                ? prev.filter(id => id !== d.id)
                                                                                : [...prev, d.id]
                                                                        )
                                                                    }}
                                                                    className="rounded accent-amber-500" />
                                                                <span className="text-sm text-(--color-text)">{d.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2 mt-3">
                                                        <button onClick={handleSaveDivisions} disabled={savingDivisions}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors">
                                                            {savingDivisions ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button onClick={() => setEditingDivisions(null)}
                                                            className="px-3 py-1.5 rounded-lg text-xs text-(--color-text-secondary) bg-white/5 hover:bg-white/10 transition-colors">
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Add staff */}
                    <div>
                        <h2 className="text-sm font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
                            Add Staff Member
                        </h2>

                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary)" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by Discord username..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-(--color-secondary) border border-white/10 text-(--color-text) text-sm placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)"
                            />
                            {searching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-(--color-accent)" />
                                </div>
                            )}
                        </div>

                        {filteredResults.length > 0 && (
                            <div className="space-y-1 rounded-xl border border-white/5 bg-(--color-secondary) p-2">
                                {filteredResults.map(u => (
                                    <div key={u.id}
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                                        {avatarUrl(u.discord_id, u.discord_avatar) ? (
                                            <img src={avatarUrl(u.discord_id, u.discord_avatar)} alt=""
                                                className="w-8 h-8 rounded-full" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-(--color-text-secondary)">
                                                {u.discord_username?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                        <span className="flex-1 text-sm text-(--color-text) truncate">
                                            {u.discord_username}
                                        </span>
                                        <button
                                            onClick={() => handleAddStaff(u.id)}
                                            disabled={adding === u.id}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 transition-colors"
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            {adding === u.id ? 'Adding...' : 'Add'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {searchQuery.length >= 2 && !searching && filteredResults.length === 0 && searchResults.length === 0 && (
                            <div className="text-center py-6 text-(--color-text-secondary) text-sm">
                                No users found matching "{searchQuery}"
                            </div>
                        )}

                        {searchQuery.length >= 2 && !searching && filteredResults.length === 0 && searchResults.length > 0 && (
                            <div className="text-center py-6 text-(--color-text-secondary) text-sm">
                                All matching users are already staff
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
