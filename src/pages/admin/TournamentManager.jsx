import { useState, useEffect, useCallback } from 'react'
import { tournamentService } from '../../services/database'
import { Plus, Save, ToggleLeft, ToggleRight, CheckCircle, XCircle, Clock, Shield, ChevronLeft, Trash2 } from 'lucide-react'

function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
    })
}

function SignupStatusBadge({ status }) {
    const config = {
        pending: { label: 'Pending', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
        approved: { label: 'Approved', cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
        rejected: { label: 'Rejected', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
    }
    const c = config[status] || config.pending
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${c.cls}`}>{c.label}</span>
}

export default function TournamentManager() {
    const [tournaments, setTournaments] = useState([])
    const [selected, setSelected] = useState(null)
    const [signups, setSignups] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null)
    const [filter, setFilter] = useState('all')
    const [creating, setCreating] = useState(false)

    // Form state for create/edit
    const [form, setForm] = useState({ name: '', slug: '', description: '', draftDate: '', gameDates: '', discordInviteUrl: '' })

    const showToast = (message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 4000)
    }

    const fetchTournaments = useCallback(async () => {
        try {
            setLoading(true)
            const data = await tournamentService.adminList()
            setTournaments(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchSignups = useCallback(async (tournamentId) => {
        try {
            const { tournament, signups: s } = await tournamentService.adminGetSignups(tournamentId)
            setSelected(tournament)
            setSignups(s)
            setForm({
                name: tournament.name,
                slug: tournament.slug,
                description: tournament.description || '',
                draftDate: tournament.draft_date ? tournament.draft_date.slice(0, 10) : '',
                gameDates: (tournament.game_dates || []).join(', '),
                discordInviteUrl: tournament.discord_invite_url || '',
            })
        } catch (err) {
            showToast(err.message, 'error')
        }
    }, [])

    useEffect(() => { fetchTournaments() }, [fetchTournaments])

    const handleCreate = async () => {
        if (!form.name || !form.slug) return showToast('Name and slug are required', 'error')
        setSaving(true)
        try {
            const gameDates = form.gameDates ? form.gameDates.split(',').map(d => d.trim()).filter(Boolean) : []
            const { tournament } = await tournamentService.adminCreate({
                name: form.name,
                slug: form.slug,
                description: form.description,
                draftDate: form.draftDate || null,
                gameDates,
                discordInviteUrl: form.discordInviteUrl,
            })
            showToast('Tournament created')
            setCreating(false)
            fetchTournaments()
            fetchSignups(tournament.id)
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleUpdate = async () => {
        if (!selected) return
        setSaving(true)
        try {
            const gameDates = form.gameDates ? form.gameDates.split(',').map(d => d.trim()).filter(Boolean) : []
            await tournamentService.adminUpdate({
                tournamentId: selected.id,
                name: form.name,
                slug: form.slug,
                description: form.description,
                draftDate: form.draftDate || null,
                gameDates,
                discordInviteUrl: form.discordInviteUrl,
            })
            showToast('Tournament updated')
            fetchSignups(selected.id)
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleToggleSignups = async () => {
        if (!selected) return
        try {
            const { tournament } = await tournamentService.adminToggleSignups(selected.id)
            setSelected(tournament)
            showToast(tournament.signups_open ? 'Signups opened' : 'Signups closed')
        } catch (err) {
            showToast(err.message, 'error')
        }
    }

    const handleStatusChange = async (status) => {
        if (!selected) return
        try {
            const { tournament } = await tournamentService.adminUpdateStatus(selected.id, status)
            setSelected(tournament)
            showToast(`Status updated to ${status}`)
        } catch (err) {
            showToast(err.message, 'error')
        }
    }

    const handleReview = async (signupId, status) => {
        try {
            await tournamentService.adminReviewSignup(signupId, status)
            showToast(`Signup ${status}`)
            fetchSignups(selected.id)
        } catch (err) {
            showToast(err.message, 'error')
        }
    }

    const filteredSignups = signups.filter(s => filter === 'all' || s.status === filter)

    const counts = {
        total: signups.length,
        pending: signups.filter(s => s.status === 'pending').length,
        approved: signups.filter(s => s.status === 'approved').length,
        rejected: signups.filter(s => s.status === 'rejected').length,
        captains: signups.filter(s => s.status === 'approved' && s.signup_role !== 'player').length,
    }

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto py-12 px-4">
                <div className="flex items-center justify-center p-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto" />
                </div>
            </div>
        )
    }

    // Tournament list view
    if (!selected && !creating) {
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-(--color-text)" style={{ fontFamily: 'var(--font-heading)' }}>Tournaments</h1>
                    <button
                        onClick={() => { setCreating(true); setForm({ name: '', slug: '', description: '', draftDate: '', gameDates: '', discordInviteUrl: '' }) }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent) text-black font-semibold text-sm hover:opacity-90 transition-opacity"
                    >
                        <Plus className="w-4 h-4" /> New Tournament
                    </button>
                </div>

                {error && <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-red-400 text-sm">{error}</div>}

                {tournaments.length === 0 ? (
                    <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center text-(--color-text-secondary)">No tournaments yet</div>
                ) : (
                    <div className="space-y-3">
                        {tournaments.map(t => (
                            <button
                                key={t.id}
                                onClick={() => fetchSignups(t.id)}
                                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-(--color-text) font-semibold">{t.name}</div>
                                        <div className="text-(--color-text-secondary) text-sm mt-0.5">/{t.slug}</div>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="text-(--color-text-secondary)">{t.signup_count} signups ({t.pending_count} pending)</span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                            t.signups_open ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                        }`}>{t.signups_open ? 'Open' : 'Closed'}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    // Create / Edit form + signups
    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
                    toast.type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
                }`}>
                    <div className="flex items-center gap-2">
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-auto opacity-60 hover:opacity-100">X</button>
                    </div>
                </div>
            )}

            {/* Back button */}
            <button
                onClick={() => { setSelected(null); setCreating(false); fetchTournaments() }}
                className="flex items-center gap-1.5 text-(--color-text-secondary) hover:text-(--color-text) text-sm mb-6 transition-colors"
            >
                <ChevronLeft className="w-4 h-4" /> Back to Tournaments
            </button>

            <h1 className="text-2xl font-bold text-(--color-text) mb-6" style={{ fontFamily: 'var(--font-heading)' }}>
                {creating ? 'Create Tournament' : selected?.name}
            </h1>

            {/* Edit Form */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/10 mb-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Name</label>
                        <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Slug</label>
                        <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Description (Marketing Copy)</label>
                    <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={5}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50 resize-y" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Draft Date</label>
                        <input type="date" value={form.draftDate} onChange={e => setForm(f => ({ ...f, draftDate: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Game Dates (comma-separated: 2026-04-05, 2026-04-06)</label>
                        <input type="text" value={form.gameDates} onChange={e => setForm(f => ({ ...f, gameDates: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50"
                            placeholder="2026-04-05, 2026-04-06" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-(--color-text-secondary) mb-1">Discord Invite URL</label>
                    <input type="url" value={form.discordInviteUrl} onChange={e => setForm(f => ({ ...f, discordInviteUrl: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) focus:outline-none focus:border-(--color-accent)/50"
                        placeholder="https://discord.gg/..." />
                </div>
                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={creating ? handleCreate : handleUpdate}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-(--color-accent) text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                        <Save className="w-4 h-4" /> {creating ? 'Create' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Controls (only when editing existing) */}
            {selected && (
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={handleToggleSignups} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) text-sm hover:bg-white/10 transition-colors">
                        {selected.signups_open ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-(--color-text-secondary)" />}
                        Signups {selected.signups_open ? 'Open' : 'Closed'}
                    </button>
                    <select
                        value={selected.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-(--color-text) text-sm focus:outline-none focus:border-(--color-accent)/50"
                    >
                        <option value="upcoming">Upcoming</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
            )}

            {/* Signups Table (only when editing existing) */}
            {selected && (
                <>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-(--color-text)">
                            Signups
                            <span className="ml-2 text-sm font-normal text-(--color-text-secondary)">
                                {counts.total} total / {counts.pending} pending / {counts.approved} approved ({counts.captains} captains) / {counts.rejected} rejected
                            </span>
                        </h2>
                    </div>

                    {/* Filter tabs */}
                    <div className="flex gap-1 mb-4">
                        {['all', 'pending', 'approved', 'rejected'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    filter === f ? 'bg-(--color-accent) text-black' : 'text-(--color-text-secondary) hover:bg-white/5'
                                }`}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>

                    {filteredSignups.length === 0 ? (
                        <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center text-(--color-text-secondary)">
                            No {filter === 'all' ? '' : filter} signups
                        </div>
                    ) : (
                        <div className="rounded-xl border border-white/10 overflow-hidden">
                            <table className="min-w-full divide-y divide-white/10">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Player</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Smite Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Role</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Available Dates</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-(--color-text-secondary) uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredSignups.map(s => (
                                        <tr key={s.id}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {s.discord_avatar ? (
                                                        <img src={`https://cdn.discordapp.com/avatars/${s.discord_id}/${s.discord_avatar}.png?size=32`} alt="" className="w-6 h-6 rounded-full" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-[#5865F2] flex items-center justify-center text-white text-xs font-bold">
                                                            {s.discord_username?.[0]?.toUpperCase()}
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-(--color-text)">{s.discord_username}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-(--color-text)">{s.smite_name}</div>
                                                {s.tracker_url && (
                                                    <a href={s.tracker_url} target="_blank" rel="noopener noreferrer" className="text-xs text-(--color-accent) hover:underline">tracker</a>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs font-medium capitalize ${s.signup_role !== 'player' ? 'text-(--color-accent)' : 'text-(--color-text-secondary)'}`}>
                                                    {s.signup_role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {(s.available_game_dates || []).map(d => (
                                                        <span key={d} className="px-1.5 py-0.5 rounded bg-white/5 text-xs text-(--color-text-secondary)">{formatDate(d)}</span>
                                                    ))}
                                                    {s.available_draft_date && (
                                                        <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-xs text-yellow-400">Draft</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3"><SignupStatusBadge status={s.status} /></td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {s.status !== 'approved' && (
                                                        <button onClick={() => handleReview(s.id, 'approved')}
                                                            className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-green-400 transition-colors" title="Approve">
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {s.status !== 'rejected' && (
                                                        <button onClick={() => handleReview(s.id, 'rejected')}
                                                            className="p-1.5 rounded-lg hover:bg-white/10 text-(--color-text-secondary) hover:text-red-400 transition-colors" title="Reject">
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
