import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, Check, X, Copy, Users } from 'lucide-react'
import { getAuthHeaders } from '../../services/adminApi.js'
import TeamLogo from '../../components/TeamLogo'
import ImageUpload from '../../components/ImageUpload'

const API = import.meta.env.VITE_API_URL || '/api'

export default function TeamManager() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [selectedSeasonId, setSelectedSeasonId] = useState(null)
    const [editItem, setEditItem] = useState(null)
    const [createItem, setCreateItem] = useState(null)
    const [saving, setSaving] = useState(false)  // false | 'saving' | 'uploading'
    const [confirmModal, setConfirmModal] = useState(null)
    const [copyModal, setCopyModal] = useState(null)

    // Toast
    const [toast, setToast] = useState(null)
    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // ─── Fetch ───
    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API}/team-manage`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setData(await res.json())
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    // ─── API action ───
    const doAction = useCallback(async (payload) => {
        const res = await fetch(`${API}/team-manage`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
        return d
    }, [])

    // ─── Derived data ───
    const { seasonOptions, teamsBySeason, playerCountMap, allSeasons } = useMemo(() => {
        if (!data) return { seasonOptions: [], teamsBySeason: {}, playerCountMap: {}, allSeasons: [] }

        const leagueMap = {}
        for (const l of data.leagues) leagueMap[l.id] = l

        const divMap = {}
        for (const d of data.divisions) divMap[d.id] = d

        const seasonOptions = []
        const allSeasons = []
        for (const s of data.seasons) {
            const div = divMap[s.division_id]
            const league = div ? leagueMap[div.league_id] : null
            const label = [league?.name, div?.name, s.name].filter(Boolean).join(' / ')
            allSeasons.push({ ...s, label })
            seasonOptions.push({ id: s.id, label, isActive: s.is_active })
        }

        const teamsBySeason = {}
        for (const t of data.teams) {
            if (!teamsBySeason[t.season_id]) teamsBySeason[t.season_id] = []
            teamsBySeason[t.season_id].push(t)
        }

        const playerCountMap = {}
        for (const tc of data.teamPlayerCounts) {
            playerCountMap[tc.team_id] = parseInt(tc.player_count)
        }

        return { seasonOptions, teamsBySeason, playerCountMap, allSeasons }
    }, [data])

    // Auto-select first active season
    useEffect(() => {
        if (!selectedSeasonId && seasonOptions.length > 0) {
            const active = seasonOptions.find(s => s.isActive)
            setSelectedSeasonId(active?.id || seasonOptions[0].id)
        }
    }, [seasonOptions, selectedSeasonId])

    const teams = teamsBySeason[selectedSeasonId] || []

    // ─── Handlers ───
    const handleSaveEdit = async () => {
        if (!editItem) return
        setSaving('saving')
        try {
            await doAction({ action: 'update-team', ...editItem })
            showToast('success', 'Team updated')
            setEditItem(null)
            fetchData()
        } catch (e) { showToast('error', e.message) }
        finally { setSaving(false) }
    }

    const handleSaveCreate = async () => {
        if (!createItem) return
        setSaving('saving')
        try {
            const { iconFile, ...payload } = createItem
            const result = await doAction({ action: 'create-team', ...payload })
            if (iconFile && result.team?.id) {
                setSaving('uploading')
                try {
                    const formData = new FormData()
                    formData.append('teamId', result.team.id)
                    formData.append('file', iconFile)
                    const token = localStorage.getItem('auth_token')
                    const res = await fetch(`${API}/team-upload`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: formData,
                    })
                    if (!res.ok) {
                        const d = await res.json()
                        showToast('error', `Team created but icon failed: ${d.error || 'Upload failed'}`)
                    }
                } catch { showToast('error', 'Team created but icon upload failed') }
            }
            showToast('success', 'Team created')
            setCreateItem(null)
            fetchData()
        } catch (e) { showToast('error', e.message) }
        finally { setSaving(false) }
    }

    const handleDelete = (teamId, teamName) => {
        setConfirmModal({
            message: `Delete team "${teamName}"?`,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'delete-team', id: teamId })
                    showToast('success', 'Team deleted')
                    fetchData()
                } catch (e) { showToast('error', e.message) }
            }
        })
    }

    const handleCopyTeams = async () => {
        if (!copyModal?.sourceSeasonId || !copyModal?.selectedTeamIds?.size) return
        const teamIds = [...copyModal.selectedTeamIds]
        const targetId = selectedSeasonId
        setCopyModal(null)
        try {
            const result = await doAction({ action: 'copy-teams', source_season_id: copyModal.sourceSeasonId, target_season_id: targetId, team_ids: teamIds })
            showToast('success', `Copied ${result.count} team${result.count !== 1 ? 's' : ''}`)
            fetchData()
        } catch (e) { showToast('error', e.message) }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent)" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8 pt-24">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg border ${
                    toast.type === 'error' ? 'bg-red-900/80 border-red-500/30 text-red-200' : 'bg-green-900/80 border-green-500/30 text-green-200'
                }`}>
                    {toast.message}
                </div>
            )}

            {/* Confirm Modal */}
            {confirmModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                        <p className="text-sm text-[var(--color-text)] mb-4">{confirmModal.message}</p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setConfirmModal(null)} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5">Cancel</button>
                            <button onClick={confirmModal.onConfirm} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Copy Teams Modal */}
            {copyModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
                        <h3 className="text-sm font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                            <Copy className="w-4 h-4 text-[var(--color-accent)]" />
                            Copy Teams
                        </h3>

                        {!copyModal.sourceSeasonId ? (
                            <>
                                <p className="text-xs text-[var(--color-text-secondary)] mb-2">Select a season to copy teams from:</p>
                                <div className="max-h-60 overflow-y-auto space-y-0.5 mb-3">
                                    {allSeasons
                                        .filter(s => s.id !== selectedSeasonId && (teamsBySeason[s.id]?.length || 0) > 0)
                                        .map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => setCopyModal(prev => ({ ...prev, sourceSeasonId: s.id, selectedTeamIds: new Set(teamsBySeason[s.id]?.map(t => t.id) || []) }))}
                                                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs hover:bg-white/5 transition-colors"
                                            >
                                                <span className="text-[var(--color-text)] truncate">{s.label}</span>
                                                <span className="text-[10px] text-[var(--color-text-secondary)] shrink-0">{teamsBySeason[s.id]?.length || 0} teams</span>
                                            </button>
                                        ))
                                    }
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={() => setCopyModal(null)} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5">Cancel</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setCopyModal(prev => ({ ...prev, sourceSeasonId: null, selectedTeamIds: new Set() }))}
                                    className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] mb-2 flex items-center gap-1"
                                >
                                    &larr; Change season
                                </button>
                                <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                                    Select teams to copy ({copyModal.selectedTeamIds.size} selected):
                                </p>
                                <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
                                    {(teamsBySeason[copyModal.sourceSeasonId] || []).map(team => (
                                        <label key={team.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                checked={copyModal.selectedTeamIds.has(team.id)}
                                                onChange={() => setCopyModal(prev => {
                                                    const next = new Set(prev.selectedTeamIds)
                                                    if (next.has(team.id)) next.delete(team.id); else next.add(team.id)
                                                    return { ...prev, selectedTeamIds: next }
                                                })}
                                                className="accent-[var(--color-accent)]"
                                            />
                                            <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: team.color }} />
                                            <span className="text-[var(--color-text)]">{team.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => {
                                            const all = teamsBySeason[copyModal.sourceSeasonId]?.map(t => t.id) || []
                                            setCopyModal(prev => ({
                                                ...prev,
                                                selectedTeamIds: prev.selectedTeamIds.size === all.length ? new Set() : new Set(all)
                                            }))
                                        }}
                                        className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                                    >
                                        {copyModal.selectedTeamIds.size === (teamsBySeason[copyModal.sourceSeasonId]?.length || 0) ? 'Deselect all' : 'Select all'}
                                    </button>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCopyModal(null)} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5">Cancel</button>
                                        <button
                                            onClick={handleCopyTeams}
                                            disabled={copyModal.selectedTeamIds.size === 0}
                                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Copy {copyModal.selectedTeamIds.size} team{copyModal.selectedTeamIds.size !== 1 ? 's' : ''}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-emerald-500/10">
                    <Users className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-xl font-heading font-bold text-[var(--color-text)]">Team Manager</h1>
                    <p className="text-xs text-[var(--color-text-secondary)]">Create, edit, and manage teams across seasons</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-6">{error}</div>
            )}

            {/* Season Picker */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <select
                    value={selectedSeasonId || ''}
                    onChange={e => { setSelectedSeasonId(parseInt(e.target.value)); setEditItem(null); setCreateItem(null) }}
                    className="rounded-lg px-3 py-2 text-sm border border-white/10 min-w-[300px]"
                    style={{ backgroundColor: 'var(--color-secondary)', color: 'var(--color-text)' }}
                >
                    {seasonOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.label}{s.isActive ? ' (Active)' : ''}</option>
                    ))}
                </select>

                <button
                    onClick={() => setCreateItem({ season_id: selectedSeasonId, name: '', color: '#3b82f6' })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> Add Team
                </button>

                <button
                    onClick={() => setCopyModal({ sourceSeasonId: null, selectedTeamIds: new Set() })}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text)] border border-white/10 hover:bg-white/5 transition-colors"
                >
                    <Copy className="w-3.5 h-3.5" /> Copy from Season
                </button>
            </div>

            {/* Create Team Form */}
            {createItem && (
                <div className="bg-[var(--color-secondary)] border border-emerald-500/20 rounded-xl p-4 mb-4">
                    <p className="text-xs text-[var(--color-text-secondary)] mb-3">New team</p>
                    <div className="flex items-end gap-3 flex-wrap">
                        <ImageUpload
                            file={createItem.iconFile}
                            onChange={file => setCreateItem(prev => ({ ...prev, iconFile: file }))}
                            onError={msg => showToast('error', msg)}
                        />
                        <div>
                            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Name</label>
                            <input
                                type="text"
                                value={createItem.name}
                                onChange={e => setCreateItem(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Team name"
                                className="rounded px-2 py-1.5 text-xs border border-white/10 w-48"
                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveCreate(); if (e.key === 'Escape') setCreateItem(null) }}
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Color</label>
                            <input
                                type="color"
                                value={createItem.color}
                                onChange={e => setCreateItem(prev => ({ ...prev, color: e.target.value }))}
                                className="w-8 h-8 rounded border border-white/10 cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {saving && (
                                <span className="text-[10px] text-[var(--color-text-secondary)] animate-pulse">
                                    {saving === 'uploading' ? 'Uploading icon...' : 'Creating...'}
                                </span>
                            )}
                            <div className="flex gap-1">
                                <button onClick={handleSaveCreate} disabled={saving} className="p-1.5 rounded text-green-400 hover:bg-green-500/10 disabled:opacity-40" title="Save">
                                    <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => setCreateItem(null)} disabled={saving} className="p-1.5 rounded text-[var(--color-text-secondary)] hover:bg-white/5 disabled:opacity-40" title="Cancel">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Team List */}
            {teams.length === 0 && !createItem ? (
                <div className="py-16 text-center">
                    <Users className="w-12 h-12 text-white/10 mx-auto mb-4" />
                    <h3 className="text-base font-heading font-bold text-white/60 mb-1">No teams yet</h3>
                    <p className="text-sm text-white/30">Add a team to get started</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {teams.map(team => {
                        const pc = playerCountMap[team.id] || 0
                        const isEditing = editItem?.id === team.id

                        return (
                            <div key={team.id} className={`bg-[var(--color-secondary)] border rounded-xl p-4 transition-colors ${isEditing ? 'border-emerald-500/30' : 'border-white/10'}`}>
                                {isEditing ? (
                                    <div className="flex items-end gap-3 flex-wrap">
                                        <ImageUpload
                                            currentUrl={team.logo_url}
                                            uploadFn={async (file) => {
                                                const formData = new FormData()
                                                formData.append('teamId', team.id)
                                                formData.append('file', file)
                                                const token = localStorage.getItem('auth_token')
                                                const res = await fetch(`${API}/team-upload`, {
                                                    method: 'POST',
                                                    headers: { Authorization: `Bearer ${token}` },
                                                    body: formData,
                                                })
                                                if (!res.ok) {
                                                    const d = await res.json()
                                                    throw new Error(d.error || 'Upload failed')
                                                }
                                            }}
                                            onRemove={async () => {
                                                const token = localStorage.getItem('auth_token')
                                                const res = await fetch(`${API}/team-upload?teamId=${team.id}`, {
                                                    method: 'DELETE',
                                                    headers: { Authorization: `Bearer ${token}` },
                                                })
                                                if (!res.ok) {
                                                    const d = await res.json()
                                                    throw new Error(d.error || 'Remove failed')
                                                }
                                            }}
                                            onComplete={() => fetchData()}
                                            onError={msg => showToast('error', msg)}
                                        />
                                        <div>
                                            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Name</label>
                                            <input
                                                type="text"
                                                value={editItem.name}
                                                onChange={e => setEditItem(prev => ({ ...prev, name: e.target.value }))}
                                                className="rounded px-2 py-1.5 text-xs border border-white/10 w-48"
                                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                                                autoFocus
                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditItem(null) }}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Color</label>
                                            <input
                                                type="color"
                                                value={editItem.color}
                                                onChange={e => setEditItem(prev => ({ ...prev, color: e.target.value }))}
                                                className="w-8 h-8 rounded border border-white/10 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">Slug</label>
                                            <input
                                                type="text"
                                                value={editItem.slug}
                                                onChange={e => setEditItem(prev => ({ ...prev, slug: e.target.value }))}
                                                className="rounded px-2 py-1.5 text-xs border border-white/10 w-36"
                                                style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)' }}
                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditItem(null) }}
                                            />
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={handleSaveEdit} disabled={saving} className="p-1.5 rounded text-green-400 hover:bg-green-500/10 disabled:opacity-40" title="Save">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setEditItem(null)} className="p-1.5 rounded text-[var(--color-text-secondary)] hover:bg-white/5" title="Cancel">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 group">
                                        <TeamLogo slug={team.slug} name={team.name} size={32} logoUrl={team.logo_url} color={team.color} />
                                        <span className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: team.color }} />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-[var(--color-text)]">{team.name}</span>
                                            <span className="text-xs text-[var(--color-text-secondary)] ml-2">/{team.slug}</span>
                                        </div>
                                        <span className="text-xs text-[var(--color-text-secondary)]">{pc} player{pc !== 1 ? 's' : ''}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => setEditItem({ id: team.id, name: team.name, color: team.color, slug: team.slug })}
                                                className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5"
                                                title="Edit"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(team.id, team.name)}
                                                className="p-1.5 rounded text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-500/10"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
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
    )
}

