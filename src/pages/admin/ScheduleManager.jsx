// src/pages/admin/ScheduleManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi.js'
import PageTitle from '../../components/PageTitle'
import TeamLogo from '../../components/TeamLogo'

const API = import.meta.env.VITE_API_URL || '/api'
const SEASON_KEY = 'smite2_admin_season'

const STATUS_STYLES = {
    scheduled: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    completed: 'bg-green-500/15 border-green-500/30 text-green-400',
    cancelled: 'bg-red-500/15 border-red-500/30 text-red-400',
}

export default function ScheduleManager() {
    const [seasons, setSeasons] = useState([])
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedSeasonId, setSelectedSeasonId] = useState(() => {
        try { return parseInt(localStorage.getItem(SEASON_KEY)) || null }
        catch { return null }
    })

    const [scheduledMatches, setScheduledMatches] = useState([])
    const [matchesLoading, setMatchesLoading] = useState(false)

    const [editingMatch, setEditingMatch] = useState(null)
    const [formData, setFormData] = useState({ team1_id: '', team2_id: '', best_of: 3, scheduled_date: '', week: '' })
    const [saving, setSaving] = useState(false)

    const [toast, setToast] = useState(null)
    const [confirmModal, setConfirmModal] = useState(null)

    // ─── Toast ───
    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // ─── Persist season selection (shared with other admin pages) ───
    const handleSeasonChange = (id) => {
        const parsed = id ? parseInt(id) : null
        setSelectedSeasonId(parsed)
        if (parsed) localStorage.setItem(SEASON_KEY, String(parsed))
        else localStorage.removeItem(SEASON_KEY)
    }

    // ─── Fetch initial data (seasons + teams) ───
    useEffect(() => {
        fetch(`${API}/schedule-manage`, { headers: getAuthHeaders() })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
            .then(data => {
                setSeasons(data.seasons || [])
                setTeams(data.teams || [])
                if (!selectedSeasonId && data.seasons?.length) {
                    const firstId = data.seasons[0].season_id
                    setSelectedSeasonId(firstId)
                    localStorage.setItem(SEASON_KEY, String(firstId))
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [])

    // ─── Fetch scheduled matches when season changes ───
    const fetchMatches = useCallback(async (seasonId) => {
        if (!seasonId) { setScheduledMatches([]); return }
        setMatchesLoading(true)
        try {
            const res = await fetch(`${API}/schedule-manage?seasonId=${seasonId}`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setScheduledMatches(data.scheduledMatches || [])
        } catch {
            setScheduledMatches([])
        } finally {
            setMatchesLoading(false)
        }
    }, [])

    useEffect(() => {
        if (selectedSeasonId) fetchMatches(selectedSeasonId)
    }, [selectedSeasonId, fetchMatches])

    // ─── API action ───
    const doAction = useCallback(async (payload) => {
        const res = await fetch(`${API}/schedule-manage`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        return data
    }, [])

    // ─── Teams for current season ───
    const seasonTeams = teams.filter(t => String(t.season_id) === String(selectedSeasonId))

    // ─── Open edit form ───
    const handleEdit = (match) => {
        setEditingMatch(match)
        setFormData({
            team1_id: match.team1_id,
            team2_id: match.team2_id,
            best_of: match.best_of,
            scheduled_date: match.scheduled_date ? match.scheduled_date.slice(0, 10) : '',
            week: match.week || '',
        })
    }

    // ─── Submit form (create or update) ───
    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!formData.team1_id || !formData.team2_id || !formData.scheduled_date) {
            showToast('error', 'Team 1, Team 2, and Date are required')
            return
        }
        if (String(formData.team1_id) === String(formData.team2_id)) {
            showToast('error', 'Teams must be different')
            return
        }

        setSaving(true)
        try {
            if (editingMatch) {
                await doAction({
                    action: 'update',
                    id: editingMatch.id,
                    team1_id: parseInt(formData.team1_id),
                    team2_id: parseInt(formData.team2_id),
                    best_of: parseInt(formData.best_of) || 1,
                    scheduled_date: formData.scheduled_date,
                    week: formData.week ? parseInt(formData.week) : null,
                })
                showToast('success', 'Match updated')
                setEditingMatch(null)
            } else {
                await doAction({
                    action: 'create',
                    season_id: selectedSeasonId,
                    team1_id: parseInt(formData.team1_id),
                    team2_id: parseInt(formData.team2_id),
                    best_of: parseInt(formData.best_of) || 1,
                    scheduled_date: formData.scheduled_date,
                    week: formData.week ? parseInt(formData.week) : null,
                })
                showToast('success', 'Match scheduled')
                // Only reset team selections — keep best_of, date, and week for bulk entry
                setFormData(prev => ({ ...prev, team1_id: '', team2_id: '' }))
            }
            fetchMatches(selectedSeasonId)
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    // ─── Update status ───
    const handleStatusChange = useCallback(async (match, newStatus) => {
        try {
            await doAction({ action: 'update-status', id: match.id, status: newStatus })
            showToast('success', `Status updated to ${newStatus}`)
            fetchMatches(selectedSeasonId)
        } catch (err) {
            showToast('error', err.message)
        }
    }, [doAction, showToast, fetchMatches, selectedSeasonId])

    // ─── Delete ───
    const handleDelete = useCallback((match) => {
        setConfirmModal({
            title: 'Delete Scheduled Match',
            message: `Delete ${match.team1_name} vs ${match.team2_name} on ${match.scheduled_date?.slice(0, 10)}? This cannot be undone.`,
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'delete', id: match.id })
                    showToast('success', 'Match deleted')
                    fetchMatches(selectedSeasonId)
                } catch (err) {
                    showToast('error', err.message)
                }
            },
        })
    }, [doAction, showToast, fetchMatches, selectedSeasonId])

    // ─── Group matches by week ───
    const groupedMatches = (() => {
        const groups = {}
        for (const m of scheduledMatches) {
            const key = m.week ? `Week ${m.week}` : 'Unscheduled'
            if (!groups[key]) groups[key] = []
            groups[key].push(m)
        }
        return groups
    })()

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--color-accent)] border-t-transparent mx-auto mb-4" />
                    <p className="text-[var(--color-text-secondary)]">Loading schedule data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto pb-8 px-4">
            <PageTitle title="Schedule Manager" noindex />

            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium transition-all ${
                    toast.type === 'success' ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-red-500/15 border-red-500/30 text-red-400'
                }`}>
                    <div className="flex items-start gap-2">
                        <span className="shrink-0">{toast.type === 'success' ? '\u2713' : '\u2715'}</span>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">{'\u2715'}</button>
                    </div>
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                        <h3 className="text-sm font-bold text-[var(--color-text)] mb-2">{confirmModal.title}</h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-4">{confirmModal.message}</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmModal(null)}
                                    className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5">
                                Cancel
                            </button>
                            <button onClick={confirmModal.onConfirm}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${
                                        confirmModal.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
                                    }`}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mb-6">
                <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Schedule Manager</h1>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                    Create and manage match schedules for upcoming games
                </p>
            </div>

            {/* Season Selector */}
            <div className="bg-[var(--color-secondary)] border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex-1 max-w-md">
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Season</label>
                    <select
                        value={selectedSeasonId || ''}
                        onChange={e => { handleSeasonChange(e.target.value); setEditingMatch(null) }}
                        className="w-full rounded-lg px-3 py-2 text-sm border"
                        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                        <option value="">&mdash; Select Season &mdash;</option>
                        {seasons.map(s => (
                            <option key={s.season_id} value={s.season_id}>
                                {s.league_name} / {s.division_name} &mdash; {s.season_name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Add/Edit Form — always visible when a season is selected */}
            {selectedSeasonId && (
                <div className={`bg-[var(--color-secondary)] border rounded-xl p-5 mb-6 ${editingMatch ? 'border-yellow-500/30' : 'border-cyan-500/20'}`}>
                    <h2 className="text-sm font-bold text-[var(--color-text)] mb-4">
                        {editingMatch ? 'Edit Scheduled Match' : 'Schedule New Match'}
                    </h2>
                    <form onSubmit={handleSubmit}>
                        {/* Persistent fields: Best Of, Date, Week */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Best Of</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="9"
                                    value={formData.best_of}
                                    onChange={e => setFormData(p => ({ ...p, best_of: e.target.value }))}
                                    required
                                    className="w-full rounded-lg px-3 py-2 text-sm border [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Date</label>
                                <input
                                    type="date"
                                    value={formData.scheduled_date}
                                    onChange={e => setFormData(p => ({ ...p, scheduled_date: e.target.value }))}
                                    required
                                    className="w-full rounded-lg px-3 py-2 text-sm border"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Week <span className="opacity-50">(optional)</span></label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.week}
                                    onChange={e => setFormData(p => ({ ...p, week: e.target.value }))}
                                    placeholder="—"
                                    className="w-full rounded-lg px-3 py-2 text-sm border [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                />
                            </div>
                        </div>

                        {/* Team selectors + submit */}
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-4 items-end">
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Team 1</label>
                                <select
                                    value={formData.team1_id}
                                    onChange={e => setFormData(p => ({ ...p, team1_id: e.target.value }))}
                                    required
                                    className="w-full rounded-lg px-3 py-2 text-sm border"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <option value="">Select team...</option>
                                    {seasonTeams.map(t => (
                                        <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Team 2</label>
                                <select
                                    value={formData.team2_id}
                                    onChange={e => setFormData(p => ({ ...p, team2_id: e.target.value }))}
                                    required
                                    className="w-full rounded-lg px-3 py-2 text-sm border"
                                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <option value="">Select team...</option>
                                    {seasonTeams.filter(t => String(t.team_id) !== String(formData.team1_id)).map(t => (
                                        <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                    {saving ? 'Saving...' : editingMatch ? 'Update Match' : 'Schedule Match'}
                                </button>
                                {editingMatch && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingMatch(null); setFormData(p => ({ ...p, team1_id: '', team2_id: '' })) }}
                                        className="px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setFormData(p => {
                                    const d = p.scheduled_date ? new Date(p.scheduled_date + 'T12:00:00') : new Date()
                                    d.setDate(d.getDate() + 7)
                                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                                    const w = p.week ? parseInt(p.week) + 1 : 1
                                    return { ...p, scheduled_date: iso, week: w }
                                })}
                                className="px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 border border-white/10 transition-colors whitespace-nowrap"
                            >
                                + 1 Week
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Match List */}
            {matchesLoading ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Loading matches...</p>
            ) : !selectedSeasonId ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Select a season to view the schedule.</p>
            ) : scheduledMatches.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-[var(--color-text-secondary)] text-sm">No scheduled matches yet.</p>
                    <p className="text-[var(--color-text-secondary)] text-xs mt-1">Use the form above to schedule the first match.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedMatches).map(([group, matches]) => (
                        <div key={group}>
                            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">{group}</h3>
                            <div className="space-y-2">
                                {matches.map(m => (
                                    <div key={m.id} className="bg-[var(--color-secondary)] border border-white/10 rounded-lg px-4 py-3 flex items-center gap-4">
                                        {/* Date */}
                                        <span className="text-xs text-[var(--color-text-secondary)] tabular-nums w-20 shrink-0">
                                            {m.scheduled_date ? m.scheduled_date.slice(0, 10) : '—'}
                                        </span>

                                        {/* Teams */}
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <TeamLogo slug={m.team1_slug} name={m.team1_name} size={18} />
                                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: m.team1_color || '#3b82f6' }} />
                                            <span className="text-sm text-[var(--color-text)]">{m.team1_name}</span>
                                            <span className="text-xs text-[var(--color-text-secondary)]">vs</span>
                                            <TeamLogo slug={m.team2_slug} name={m.team2_name} size={18} />
                                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: m.team2_color || '#ef4444' }} />
                                            <span className="text-sm text-[var(--color-text)]">{m.team2_name}</span>
                                        </div>

                                        {/* Best of */}
                                        <span className="text-xs text-[var(--color-text-secondary)] shrink-0">Bo{m.best_of}</span>

                                        {/* Status */}
                                        <select
                                            value={m.status}
                                            onChange={e => handleStatusChange(m, e.target.value)}
                                            className={`text-xs px-2 py-1 rounded-md border cursor-pointer ${STATUS_STYLES[m.status] || ''}`}
                                            style={{ backgroundColor: 'transparent' }}
                                        >
                                            <option value="scheduled">Scheduled</option>
                                            <option value="completed">Completed</option>
                                            <option value="cancelled">Cancelled</option>
                                        </select>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                onClick={() => handleEdit(m)}
                                                className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(m)}
                                                className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
