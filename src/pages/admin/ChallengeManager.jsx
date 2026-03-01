import { useState, useEffect, useCallback, useRef } from 'react'
import { challengeService } from '../../services/database'
import { CHALLENGE_TIERS, getTierColor, getTierLabel } from '../../config/challengeTiers'
import { useAuth } from '../../context/AuthContext'
import PageTitle from '../../components/PageTitle'
import passionCoin from '../../assets/passion/passion.png'

// ═══════════════════════════════════════════════════
// Player Challenge Manager — search, view, award/revoke
// ═══════════════════════════════════════════════════
function PlayerChallengePanel() {
    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [selectedUser, setSelectedUser] = useState(null)
    const [userChallenges, setUserChallenges] = useState([])
    const [loadingChallenges, setLoadingChallenges] = useState(false)
    const [actionId, setActionId] = useState(null)
    const [tierFilter, setTierFilter] = useState('all')
    const searchTimeout = useRef(null)

    const doSearch = useCallback(async (q) => {
        if (q.length < 2) { setSearchResults([]); return }
        setSearching(true)
        try {
            const data = await challengeService.searchUsers(q)
            setSearchResults(data.users || [])
        } catch (err) {
            console.error('Search failed:', err)
        } finally {
            setSearching(false)
        }
    }, [])

    const handleQueryChange = (val) => {
        setQuery(val)
        clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => doSearch(val), 300)
    }

    const loadUserChallenges = async (user) => {
        setSelectedUser(user)
        setSearchResults([])
        setQuery('')
        setLoadingChallenges(true)
        try {
            const data = await challengeService.getUserChallenges(user.id)
            setUserChallenges(data.challenges || [])
        } catch (err) {
            console.error('Failed to load user challenges:', err)
        } finally {
            setLoadingChallenges(false)
        }
    }

    const handleAward = async (challengeId) => {
        if (!confirm('Award this challenge? This grants Passion and flags it as admin-altered.')) return
        setActionId(challengeId)
        try {
            await challengeService.awardChallenge(selectedUser.id, challengeId)
            await loadUserChallenges(selectedUser)
        } catch (err) {
            alert(err.message)
        } finally {
            setActionId(null)
        }
    }

    const handleRevoke = async (challengeId) => {
        if (!confirm('Revoke this challenge? This deducts Passion and flags it as admin-altered.')) return
        setActionId(challengeId)
        try {
            await challengeService.revokeUserChallenge(selectedUser.id, challengeId)
            await loadUserChallenges(selectedUser)
        } catch (err) {
            alert(err.message)
        } finally {
            setActionId(null)
        }
    }

    const avatarUrl = (u) =>
        u.discord_avatar && u.discord_id
            ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.discord_avatar}.png?size=32`
            : null

    const filteredChallenges = tierFilter === 'all'
        ? userChallenges
        : userChallenges.filter(ch => ch.tier === tierFilter)

    const availableTiers = [...new Set(userChallenges.map(ch => ch.tier))]

    return (
        <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-5 mb-6">
            <h2 className="text-base font-bold mb-4">Player Challenges</h2>

            {/* Search bar */}
            <div className="relative mb-4">
                <input
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    placeholder="Search by Discord username or player name..."
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                />
                {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-(--color-text-secondary)">Searching...</div>
                )}

                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-(--color-secondary) border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {searchResults.map(u => (
                            <button
                                key={u.id}
                                onClick={() => loadUserChallenges(u)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left cursor-pointer"
                            >
                                {avatarUrl(u) ? (
                                    <img src={avatarUrl(u)} alt="" className="w-6 h-6 rounded-full" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-white/10" />
                                )}
                                <div className="min-w-0">
                                    <div className="text-sm font-medium truncate">{u.discord_username}</div>
                                    {u.player_name && (
                                        <div className="text-xs text-(--color-text-secondary)/60">{u.player_name}</div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Selected user + challenges */}
            {selectedUser && (
                <div>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            {avatarUrl(selectedUser) ? (
                                <img src={avatarUrl(selectedUser)} alt="" className="w-8 h-8 rounded-full" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-white/10" />
                            )}
                            <div>
                                <div className="font-bold text-sm">{selectedUser.discord_username}</div>
                                {selectedUser.player_name && (
                                    <div className="text-xs text-(--color-text-secondary)/60">{selectedUser.player_name}</div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => { setSelectedUser(null); setUserChallenges([]) }}
                            className="text-xs text-(--color-text-secondary) hover:text-white transition-colors"
                        >
                            Clear
                        </button>
                    </div>

                    {/* Tier filter */}
                    {availableTiers.length > 1 && (
                        <div className="flex gap-1.5 flex-wrap mb-4">
                            <button
                                onClick={() => setTierFilter('all')}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                                    tierFilter === 'all'
                                        ? 'bg-(--color-accent) text-(--color-primary)'
                                        : 'bg-white/[0.06] text-(--color-text-secondary)/70 hover:bg-white/10'
                                }`}
                            >
                                All
                            </button>
                            {CHALLENGE_TIERS.filter(t => availableTiers.includes(t.key)).map(t => (
                                <button
                                    key={t.key}
                                    onClick={() => setTierFilter(t.key)}
                                    className="px-2.5 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer"
                                    style={
                                        tierFilter === t.key
                                            ? { backgroundColor: t.color, color: '#0a0f1a' }
                                            : { backgroundColor: 'rgba(255,255,255,0.04)', color: `${t.color}cc` }
                                    }
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {loadingChallenges ? (
                        <div className="text-center py-6 text-(--color-text-secondary) text-sm">Loading challenges...</div>
                    ) : (
                        <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                            {filteredChallenges.map(ch => {
                                const pct = Math.min(Math.round((ch.current_value / ch.target_value) * 100), 100)
                                const tierColor = getTierColor(ch.tier)
                                const isActing = actionId === ch.id

                                return (
                                    <div
                                        key={ch.id}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                                        style={{ borderLeft: `3px solid ${tierColor}` }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium truncate">{ch.title}</span>
                                                {ch.admin_altered && (
                                                    <span className="text-[9px] font-bold px-1.5 py-px rounded bg-amber-500/15 text-amber-400 shrink-0">
                                                        ALTERED
                                                    </span>
                                                )}
                                                {ch.completed && (
                                                    <span className="text-[9px] font-bold px-1.5 py-px rounded bg-green-500/15 text-green-400 shrink-0">
                                                        DONE
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                <span className="text-[10px] text-(--color-text-secondary)/50">
                                                    {ch.current_value?.toLocaleString()} / {ch.target_value?.toLocaleString()} ({pct}%)
                                                </span>
                                                <span className="text-[10px] font-bold" style={{ color: tierColor }}>
                                                    {getTierLabel(ch.tier)}
                                                </span>
                                                <div className="flex items-center gap-0.5">
                                                    <img src={passionCoin} alt="" className="w-3 h-3" />
                                                    <span className="text-[10px] text-(--color-accent)">{ch.reward}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="shrink-0">
                                            {ch.completed ? (
                                                <button
                                                    onClick={() => handleRevoke(ch.id)}
                                                    disabled={isActing}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50 cursor-pointer"
                                                >
                                                    {isActing ? '...' : 'Revoke'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleAward(ch.id)}
                                                    disabled={isActing}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors disabled:opacity-50 cursor-pointer"
                                                >
                                                    {isActing ? '...' : 'Award'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

const CATEGORIES = ['engagement', 'league', 'performance', 'social']
const TYPES = ['one_time', 'repeatable']
const TIERS = CHALLENGE_TIERS.map(t => t.key)
const STAT_KEYS = [
    { value: 'discord_linked', label: 'Discord Linked (sign in)' },
    { value: 'daily_logins', label: 'Daily Logins (count)' },
    { value: 'login_streak', label: 'Login Streak (current)' },
    { value: 'tier_lists_created', label: 'Tier Lists Created' },
    { value: 'drafts_completed', label: 'Drafts Completed' },
    { value: 'total_earned', label: 'Total Passion Earned' },
    { value: 'games_played', label: 'Games Played' },
    { value: 'leagues_joined', label: 'Leagues Joined' },
    { value: 'total_kills', label: 'Total Kills (career)' },
    { value: 'total_assists', label: 'Total Assists (career)' },
    { value: 'total_damage', label: 'Total Damage (career)' },
    { value: 'total_mitigated', label: 'Total Mitigated (career)' },
    { value: 'total_wins', label: 'Total Wins (career)' },
    { value: 'best_kills_game', label: 'Best Kills (single game)' },
    { value: 'best_deaths_game', label: 'Best Deaths (single game)' },
    { value: 'best_assists_game', label: 'Best Assists (single game)' },
    { value: 'best_damage_game', label: 'Best Damage (single game)' },
    { value: 'best_mitigated_game', label: 'Best Mitigated (single game)' },
    { value: 'best_season_win_rate', label: 'Best Season Win Rate % (min 5 games)' },
    { value: 'best_season_avg_damage', label: 'Best Season Avg Damage (min 5 games)' },
    { value: 'games_in_tier_1', label: 'Games in Tier 1 Division' },
]

const EMPTY_FORM = {
    title: '',
    description: '',
    category: 'engagement',
    type: 'one_time',
    reward: 10,
    target_value: 1,
    stat_key: 'daily_logins',
    repeat_cooldown: '',
    sort_order: 0,
    tier: 'daily',
    gives_badge: false,
    badge_label: '',
}

export default function ChallengeManager() {
    const { hasPermission } = useAuth()
    const isOwner = hasPermission('permission_manage')
    const [challenges, setChallenges] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [recalcing, setRecalcing] = useState(false)
    const [recalcResult, setRecalcResult] = useState(null)
    const [catchingUp, setCatchingUp] = useState(false)

    const loadChallenges = async () => {
        try {
            const data = await challengeService.adminGetAll()
            setChallenges(data.challenges || [])
        } catch (err) {
            console.error('Failed to load challenges:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadChallenges() }, [])

    const openCreate = () => {
        setForm(EMPTY_FORM)
        setEditingId(null)
        setError(null)
        setShowModal(true)
    }

    const openEdit = (ch) => {
        setForm({
            title: ch.title,
            description: ch.description || '',
            category: ch.category,
            type: ch.type,
            reward: ch.reward,
            target_value: ch.target_value,
            stat_key: ch.stat_key,
            repeat_cooldown: ch.repeat_cooldown || '',
            sort_order: ch.sort_order,
            tier: ch.tier || 'daily',
            gives_badge: ch.gives_badge || false,
            badge_label: ch.badge_label || '',
        })
        setEditingId(ch.id)
        setError(null)
        setShowModal(true)
    }

    const handleSave = async () => {
        if (!form.title.trim() || !form.stat_key || !form.target_value) {
            setError('Title, stat key, and target value are required.')
            return
        }

        setSaving(true)
        setError(null)

        try {
            if (editingId) {
                await challengeService.update({ id: editingId, ...form })
            } else {
                await challengeService.create(form)
            }
            setShowModal(false)
            loadChallenges()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = async (id) => {
        try {
            await challengeService.toggle(id)
            loadChallenges()
        } catch (err) {
            console.error('Toggle failed:', err)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this challenge permanently?')) return
        try {
            await challengeService.remove(id)
            loadChallenges()
        } catch (err) {
            console.error('Delete failed:', err)
        }
    }

    const handleCatchupAll = async () => {
        if (!confirm('Catch up challenge progress for all users? This can only award progress, never revoke.')) return
        setCatchingUp(true)
        setRecalcResult(null)
        try {
            const result = await challengeService.catchupAll()
            const msg = `Caught up ${result.updated} users` + (result.claimable > 0 ? ` (${result.claimable} newly claimable)` : '')
            setRecalcResult(msg)
        } catch (err) {
            setRecalcResult(`Error: ${err.message}`)
        } finally {
            setCatchingUp(false)
        }
    }

    const handleRecalcAll = async () => {
        if (!confirm('Recalculate all challenge progress for every user? This may take a moment.')) return
        setRecalcing(true)
        setRecalcResult(null)
        try {
            const result = await challengeService.recalcAll()
            setRecalcResult(`Recalculated challenges for ${result.updated} users`)
        } catch (err) {
            setRecalcResult(`Error: ${err.message}`)
        } finally {
            setRecalcing(false)
        }
    }

    const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

    return (
        <div className="min-h-screen bg-(--color-primary) text-(--color-text) p-4 sm:p-8">
            <PageTitle title="Challenge Manager" noindex />

            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Challenge Manager</h1>
                    <div className="flex items-center gap-3">
                        <button onClick={handleCatchupAll} disabled={catchingUp || recalcing}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors disabled:opacity-50">
                            {catchingUp ? 'Catching up...' : 'Catch Up Progress'}
                        </button>
                        {isOwner && (
                            <button onClick={handleRecalcAll} disabled={recalcing || catchingUp}
                                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm transition-colors disabled:opacity-50">
                                {recalcing ? 'Recalculating...' : 'Recalc All Progress'}
                            </button>
                        )}
                        <button onClick={openCreate}
                            className="px-4 py-2 rounded-lg bg-(--color-accent) hover:opacity-90 text-(--color-primary) font-bold text-sm transition-colors">
                            + New Challenge
                        </button>
                    </div>
                </div>
                {recalcResult && (
                    <div className={`mb-4 p-3 rounded-lg text-sm ${recalcResult.startsWith('Error') ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-green-500/10 border border-green-500/30 text-green-400'}`}>
                        {recalcResult}
                    </div>
                )}

                <PlayerChallengePanel />

                {loading ? (
                    <div className="text-center py-12 text-(--color-text-secondary)">Loading...</div>
                ) : challenges.length === 0 ? (
                    <div className="text-center py-12 text-(--color-text-secondary)">
                        No challenges created yet. Click "New Challenge" to get started.
                    </div>
                ) : (
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-xs text-(--color-text-secondary) uppercase tracking-wider">
                                        <th className="px-4 py-3 text-left">Title</th>
                                        <th className="px-4 py-3 text-center">Tier</th>
                                        <th className="px-4 py-3 text-left hidden lg:table-cell">Stat</th>
                                        <th className="px-4 py-3 text-center">Target</th>
                                        <th className="px-4 py-3 text-center">Reward</th>
                                        <th className="px-4 py-3 text-center hidden md:table-cell">Badge</th>
                                        <th className="px-4 py-3 text-center">Active</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {challenges.map(ch => (
                                        <tr key={ch.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${!ch.is_active ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3 font-medium">
                                                <div>{ch.title}</div>
                                                <div className="text-xs text-(--color-text-secondary) capitalize">{ch.category}</div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span
                                                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                                                    style={{ backgroundColor: `${getTierColor(ch.tier)}20`, color: getTierColor(ch.tier) }}
                                                >
                                                    {getTierLabel(ch.tier)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 hidden lg:table-cell text-(--color-text-secondary) font-mono text-xs">{ch.stat_key}</td>
                                            <td className="px-4 py-3 text-center tabular-nums">{ch.target_value.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                                    <span className="text-(--color-accent) font-bold">{ch.reward}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center hidden md:table-cell">
                                                {ch.gives_badge ? (
                                                    <span className="text-xs" title={ch.badge_label}>&#9733;</span>
                                                ) : (
                                                    <span className="text-(--color-text-secondary)/30">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleToggle(ch.id)}
                                                    className={`w-8 h-5 rounded-full transition-colors ${ch.is_active ? 'bg-green-500' : 'bg-white/20'}`}>
                                                    <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${ch.is_active ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openEdit(ch)}
                                                        className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
                                                    <button onClick={() => handleDelete(ch.id)}
                                                        className="text-xs text-red-400 hover:text-red-300">Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowModal(false)}>
                    <div className="bg-(--color-secondary) rounded-xl border border-white/10 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-4">{editingId ? 'Edit Challenge' : 'New Challenge'}</h2>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-1">Title</label>
                                <input value={form.title} onChange={e => setField('title', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                    placeholder="e.g., Damage Dealer" />
                            </div>

                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-1">Description</label>
                                <textarea value={form.description} onChange={e => setField('description', e.target.value)}
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                    placeholder="e.g., Deal 50,000 total damage across all games" />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Tier</label>
                                    <select value={form.tier} onChange={e => setField('tier', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50">
                                        {TIERS.map(t => (
                                            <option key={t} value={t} className="bg-gray-900">{getTierLabel(t)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Category</label>
                                    <select value={form.category} onChange={e => setField('category', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50">
                                        {CATEGORIES.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Type</label>
                                    <select value={form.type} onChange={e => setField('type', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50">
                                        {TYPES.map(t => <option key={t} value={t} className="bg-gray-900">{t === 'one_time' ? 'One-Time' : 'Repeatable'}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-(--color-text-secondary) mb-1">Stat to Track</label>
                                <select value={form.stat_key} onChange={e => setField('stat_key', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50">
                                    {STAT_KEYS.map(s => <option key={s.value} value={s.value} className="bg-gray-900">{s.label}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Target Value</label>
                                    <input type="number" value={form.target_value} onChange={e => setField('target_value', parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50" />
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Reward</label>
                                    <div className="relative">
                                        <input type="number" value={form.reward} onChange={e => setField('reward', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50 pr-8" />
                                        <img src={passionCoin} alt="" className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Sort Order</label>
                                    <input type="number" value={form.sort_order} onChange={e => setField('sort_order', parseInt(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50" />
                                </div>
                            </div>

                            {/* Badge settings */}
                            <div className="border-t border-white/10 pt-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.gives_badge}
                                        onChange={e => setField('gives_badge', e.target.checked)}
                                        className="rounded accent-(--color-accent)"
                                    />
                                    <span className="text-sm">Grants a profile badge</span>
                                </label>

                                {form.gives_badge && (
                                    <div className="mt-3">
                                        <label className="block text-xs text-(--color-text-secondary) mb-1">Badge Label (shown on profile)</label>
                                        <input value={form.badge_label} onChange={e => setField('badge_label', e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                            placeholder="e.g., World Ender" />
                                    </div>
                                )}
                            </div>

                            {form.type === 'repeatable' && (
                                <div>
                                    <label className="block text-xs text-(--color-text-secondary) mb-1">Repeat Cooldown (PostgreSQL interval)</label>
                                    <input value={form.repeat_cooldown} onChange={e => setField('repeat_cooldown', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-(--color-accent)/50"
                                        placeholder="e.g., 7 days, 1 day" />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowModal(false)}
                                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                className="px-4 py-2 rounded-lg bg-(--color-accent) hover:opacity-90 text-(--color-primary) font-bold text-sm transition-colors disabled:opacity-50">
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Challenge'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
