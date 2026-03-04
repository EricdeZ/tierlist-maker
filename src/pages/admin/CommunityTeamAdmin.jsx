import { useState, useEffect, useCallback } from 'react'
import { adminCommunityService } from '../../services/database'
import PageTitle from '../../components/PageTitle'
import { Users, Trash2, Pencil, X, Check, Search, ChevronDown, ChevronUp } from 'lucide-react'

const TIER_LABELS = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Diamond', 5: 'Masters' }
const TIER_COLORS = {
    1: '#cd7f32', 2: '#c0c0c0', 3: '#ffd700', 4: '#b9f2ff', 5: '#e879f9',
}

export default function CommunityTeamAdmin() {
    const [teams, setTeams] = useState([])
    const [stats, setStats] = useState(null)
    const [tierCounts, setTierCounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [search, setSearch] = useState('')
    const [tierFilter, setTierFilter] = useState('')
    const [expandedId, setExpandedId] = useState(null)
    const [detail, setDetail] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({})
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState(null)

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const [teamsRes, statsRes] = await Promise.all([
                adminCommunityService.listTeams({ search: search || undefined, tier: tierFilter || undefined }),
                adminCommunityService.teamStats(),
            ])
            setTeams(teamsRes.teams || [])
            setStats(statsRes.stats)
            setTierCounts(statsRes.tierCounts || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [tierFilter])

    const handleSearch = (e) => {
        e.preventDefault()
        fetchData()
    }

    const toggleExpand = async (teamId) => {
        if (expandedId === teamId) {
            setExpandedId(null)
            setDetail(null)
            return
        }
        setExpandedId(teamId)
        setDetailLoading(true)
        try {
            const data = await adminCommunityService.teamDetail(teamId)
            setDetail(data)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setDetailLoading(false)
        }
    }

    const startEdit = (team) => {
        setEditingId(team.id)
        setEditForm({ name: team.name, skill_tier: team.skill_tier, color: team.color || '' })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditForm({})
    }

    const saveEdit = async () => {
        setSaving(true)
        try {
            await adminCommunityService.editTeam({ id: editingId, ...editForm })
            showToast('success', 'Team updated')
            setEditingId(null)
            await fetchData()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (team) => {
        if (!confirm(`Delete "${team.name}" and all its members/invitations? This cannot be undone.`)) return
        try {
            await adminCommunityService.deleteTeam(team.id)
            showToast('success', `Deleted "${team.name}"`)
            if (expandedId === team.id) {
                setExpandedId(null)
                setDetail(null)
            }
            await fetchData()
        } catch (err) {
            showToast('error', err.message)
        }
    }

    const avatarUrl = (discordId, avatar) =>
        avatar ? `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.webp?size=32` : null

    if (loading && teams.length === 0) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent)" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
            <PageTitle title="Community Teams Admin" noindex />

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-teal-500/10">
                    <Users className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                    <h1 className="text-xl font-heading font-bold text-(--color-text)">Community Teams</h1>
                    <p className="text-xs text-(--color-text-secondary)">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            {/* Stats row */}
            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    <StatCard label="Total Teams" value={stats.total_teams} />
                    <StatCard label="Roster Ready (5+)" value={stats.roster_ready} />
                    <StatCard label="Avg Members" value={stats.avg_members} />
                    <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-3">
                        <div className="text-xs text-(--color-text-secondary) mb-1.5">By Tier</div>
                        <div className="flex gap-2 flex-wrap">
                            {tierCounts.map(tc => (
                                <span key={tc.skill_tier} className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: TIER_COLORS[tc.skill_tier] + '22', color: TIER_COLORS[tc.skill_tier] }}>
                                    {TIER_LABELS[tc.skill_tier]}: {tc.count}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-3 mb-6 flex-wrap">
                <form onSubmit={handleSearch} className="flex-1 min-w-48 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--color-text-secondary)" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search teams..."
                            className="w-full pl-9 pr-3 py-2 bg-(--color-secondary) border border-white/10 rounded-lg text-sm text-(--color-text) placeholder:text-(--color-text-secondary)/50 focus:outline-none focus:border-(--color-accent)/50"
                        />
                    </div>
                    <button type="submit" className="px-3 py-2 bg-(--color-accent) text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
                        Search
                    </button>
                </form>
                <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="px-3 py-2 bg-(--color-secondary) border border-white/10 rounded-lg text-sm text-(--color-text) cursor-pointer"
                >
                    <option value="">All Tiers</option>
                    {[1, 2, 3, 4, 5].map(t => (
                        <option key={t} value={t}>{TIER_LABELS[t]}</option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-6">{error}</div>
            )}

            {/* Team list */}
            {teams.length === 0 ? (
                <div className="py-16 text-center">
                    <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-base font-heading font-bold text-white/60 mb-1">No teams found</h3>
                </div>
            ) : (
                <div className="space-y-2">
                    {teams.map(team => {
                        const isEditing = editingId === team.id
                        const isExpanded = expandedId === team.id
                        return (
                            <div key={team.id} className="bg-(--color-secondary) border border-white/10 rounded-xl overflow-hidden">
                                {/* Row */}
                                <div className="flex items-center gap-3 p-3 sm:p-4">
                                    {/* Logo */}
                                    <div className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
                                        {team.logo_url ? (
                                            <img src={team.logo_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Users className="w-5 h-5 text-white/20" />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <input
                                                    value={editForm.name}
                                                    onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                                    className="px-2 py-1 bg-black/20 border border-white/20 rounded text-sm text-(--color-text) w-40"
                                                />
                                                <select
                                                    value={editForm.skill_tier}
                                                    onChange={(e) => setEditForm(f => ({ ...f, skill_tier: e.target.value }))}
                                                    className="px-2 py-1 bg-black/20 border border-white/20 rounded text-sm text-(--color-text) cursor-pointer"
                                                >
                                                    {[1, 2, 3, 4, 5].map(t => (
                                                        <option key={t} value={t}>{TIER_LABELS[t]}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="color"
                                                    value={editForm.color || '#6366f1'}
                                                    onChange={(e) => setEditForm(f => ({ ...f, color: e.target.value }))}
                                                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-sm text-(--color-text) truncate">{team.name}</span>
                                                <span
                                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                                    style={{ background: TIER_COLORS[team.skill_tier] + '22', color: TIER_COLORS[team.skill_tier] }}
                                                >
                                                    {TIER_LABELS[team.skill_tier]}
                                                </span>
                                                {team.color && (
                                                    <span className="w-3 h-3 rounded-full shrink-0 border border-white/20" style={{ background: team.color }} />
                                                )}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-(--color-text-secondary)">
                                            {team.owner_avatar && (
                                                <img src={avatarUrl(team.owner_discord_id, team.owner_avatar)} alt="" className="w-4 h-4 rounded-full" />
                                            )}
                                            <span>{team.owner_username || 'Unknown'}</span>
                                            <span className="text-white/20">|</span>
                                            <span>{team.member_count} member{team.member_count != 1 ? 's' : ''}</span>
                                            <span className="text-white/20">|</span>
                                            <span>{new Date(team.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isEditing ? (
                                            <>
                                                <button onClick={saveEdit} disabled={saving} className="p-2 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors cursor-pointer disabled:opacity-40" title="Save">
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button onClick={cancelEdit} className="p-2 rounded-lg text-(--color-text-secondary) hover:bg-white/5 transition-colors cursor-pointer" title="Cancel">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEdit(team)} className="p-2 rounded-lg text-(--color-text-secondary) hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer" title="Edit">
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDelete(team)} className="p-2 rounded-lg text-(--color-text-secondary) hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => toggleExpand(team.id)} className="p-2 rounded-lg text-(--color-text-secondary) hover:bg-white/5 transition-colors cursor-pointer" title="Details">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="border-t border-white/5 px-4 py-3 bg-black/10">
                                        {detailLoading ? (
                                            <div className="flex items-center gap-2 text-xs text-(--color-text-secondary)">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-(--color-accent)" />
                                                Loading...
                                            </div>
                                        ) : detail ? (
                                            <div className="grid sm:grid-cols-2 gap-4">
                                                {/* Members */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-(--color-text-secondary) uppercase tracking-wider mb-2">Members ({detail.members?.length || 0})</h4>
                                                    {detail.members?.length ? (
                                                        <div className="space-y-1.5">
                                                            {detail.members.map(m => (
                                                                <div key={m.id} className="flex items-center gap-2 text-sm">
                                                                    {m.discord_avatar && (
                                                                        <img src={avatarUrl(m.discord_id, m.discord_avatar)} alt="" className="w-5 h-5 rounded-full" />
                                                                    )}
                                                                    <span className="text-(--color-text)">{m.discord_username}</span>
                                                                    {m.role === 'captain' && (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">CPT</span>
                                                                    )}
                                                                    <span className="text-xs text-(--color-text-secondary) ml-auto">
                                                                        {new Date(m.joined_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-(--color-text-secondary)">No active members</p>
                                                    )}
                                                </div>

                                                {/* Pending invites */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-(--color-text-secondary) uppercase tracking-wider mb-2">Pending Invites ({detail.pendingInvites?.length || 0})</h4>
                                                    {detail.pendingInvites?.length ? (
                                                        <div className="space-y-1.5">
                                                            {detail.pendingInvites.map(inv => (
                                                                <div key={inv.id} className="flex items-center gap-2 text-sm">
                                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-(--color-text-secondary)">{inv.type}</span>
                                                                    <span className="text-(--color-text)">{inv.to_username || inv.from_username}</span>
                                                                    <span className="text-xs text-(--color-text-secondary) ml-auto">
                                                                        {new Date(inv.created_at).toLocaleDateString()}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-(--color-text-secondary)">No pending invites</p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${
                    toast.type === 'error'
                        ? 'bg-red-900/90 border-red-500/30 text-red-200'
                        : 'bg-green-900/90 border-green-500/30 text-green-200'
                }`}>
                    {toast.message}
                </div>
            )}
        </div>
    )
}

function StatCard({ label, value }) {
    return (
        <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-3">
            <div className="text-xs text-(--color-text-secondary) mb-1">{label}</div>
            <div className="text-xl font-heading font-bold text-(--color-text)">{value ?? '—'}</div>
        </div>
    )
}
