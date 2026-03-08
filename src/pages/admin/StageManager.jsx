// src/pages/admin/StageManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '../../services/adminApi.js'
import PageTitle from '../../components/PageTitle'
import TeamLogo from '../../components/TeamLogo'

const API = import.meta.env.VITE_API_URL || '/api'
const SEASON_KEY = 'smite2_admin_season'

const STAGE_TYPE_LABELS = {
    round_robin: 'Round Robin',
    single_elimination: 'Single Elim',
    double_elimination: 'Double Elim',
    swiss: 'Swiss',
    custom: 'Custom',
}

const STAGE_TYPE_COLORS = {
    round_robin: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    single_elimination: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
    double_elimination: 'bg-red-500/15 border-red-500/30 text-red-400',
    swiss: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400',
    custom: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
}

const STATUS_COLORS = {
    pending: 'bg-blue-500/15 border-blue-500/30 text-blue-400',
    active: 'bg-green-500/15 border-green-500/30 text-green-400',
    completed: 'bg-gray-500/15 border-gray-500/30 text-gray-400',
}

const MATCH_STATUS_COLORS = {
    scheduled: 'bg-blue-500/15 text-blue-400',
    completed: 'bg-green-500/15 text-green-400',
    cancelled: 'bg-red-500/15 text-red-400',
}

// ─── Shared input style ───
const inputStyle = { backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }
const inputClass = 'w-full rounded-lg px-3 py-2 text-sm border'
const inputClassSm = 'w-full rounded-lg px-2 py-1.5 text-xs border'
const numInputClass = `${inputClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`
const numInputClassSm = `${inputClassSm} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`

export default function StageManager() {
    // ─── Top-level state ───
    const [seasons, setSeasons] = useState([])
    const [teams, setTeams] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedSeasonId, setSelectedSeasonId] = useState(() => {
        try { return parseInt(localStorage.getItem(SEASON_KEY)) || null }
        catch { return null }
    })

    // ─── Stage data ───
    const [stages, setStages] = useState([])
    const [groups, setGroups] = useState([])
    const [groupTeams, setGroupTeams] = useState([])
    const [rounds, setRounds] = useState([])
    const [stagesLoading, setStagesLoading] = useState(false)

    // ─── Bracket match data ───
    const [scheduledMatches, setScheduledMatches] = useState([])

    // ─── UI state ───
    const [expandedStages, setExpandedStages] = useState({})
    const [toast, setToast] = useState(null)
    const [confirmModal, setConfirmModal] = useState(null)

    // ─── Stage form ───
    const [editingStage, setEditingStage] = useState(null) // null = none, 'new' = creating, {id} = editing
    const [stageForm, setStageForm] = useState({ name: '', stage_type: '', sort_order: 0, status: 'pending' })

    // ─── Group form ───
    const [editingGroup, setEditingGroup] = useState(null)
    const [groupForm, setGroupForm] = useState({ name: '', sort_order: 0, league_wide: false })
    const [groupFormStageId, setGroupFormStageId] = useState(null)

    // ─── Group teams editor ───
    const [editingGroupTeams, setEditingGroupTeams] = useState(null) // group_id
    const [groupTeamDraft, setGroupTeamDraft] = useState([]) // [{team_id, seed}]

    // ─── Round form ───
    const [editingRound, setEditingRound] = useState(null)
    const [roundForm, setRoundForm] = useState({ name: '', round_number: 1, sort_order: 0, best_of_override: '', scheduled_date: '', league_wide: false })
    const [roundFormStageId, setRoundFormStageId] = useState(null)

    const [saving, setSaving] = useState(false)

    // ─── Toast ───
    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    // ─── Season change ───
    const handleSeasonChange = (id) => {
        const parsed = id ? parseInt(id) : null
        setSelectedSeasonId(parsed)
        if (parsed) localStorage.setItem(SEASON_KEY, String(parsed))
        else localStorage.removeItem(SEASON_KEY)
        setExpandedStages({})
        setEditingStage(null)
        setEditingGroup(null)
        setEditingRound(null)
        setEditingGroupTeams(null)
    }

    // ─── Fetch seasons & teams (initial) ───
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

    // ─── Fetch stage data when season changes ───
    const fetchStages = useCallback(async (seasonId) => {
        if (!seasonId) { setStages([]); setGroups([]); setGroupTeams([]); setRounds([]); return }
        setStagesLoading(true)
        try {
            const res = await fetch(`${API}/stage-manage?seasonId=${seasonId}`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setStages(data.stages || [])
            setGroups(data.groups || [])
            setGroupTeams(data.groupTeams || [])
            setRounds(data.rounds || [])
        } catch {
            setStages([]); setGroups([]); setGroupTeams([]); setRounds([])
        } finally {
            setStagesLoading(false)
        }
    }, [])

    // ─── Fetch scheduled matches for bracket visualization ───
    const fetchMatches = useCallback(async (seasonId) => {
        if (!seasonId) { setScheduledMatches([]); return }
        try {
            const res = await fetch(`${API}/schedule-manage?seasonId=${seasonId}`, { headers: getAuthHeaders() })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setScheduledMatches(data.scheduledMatches || [])
        } catch {
            setScheduledMatches([])
        }
    }, [])

    useEffect(() => {
        if (selectedSeasonId) {
            fetchStages(selectedSeasonId)
            fetchMatches(selectedSeasonId)
        }
    }, [selectedSeasonId, fetchStages, fetchMatches])

    // ─── Generic POST action ───
    const doAction = useCallback(async (payload) => {
        const res = await fetch(`${API}/stage-manage`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        return data
    }, [])

    const reload = useCallback(() => {
        if (selectedSeasonId) {
            fetchStages(selectedSeasonId)
            fetchMatches(selectedSeasonId)
        }
    }, [selectedSeasonId, fetchStages, fetchMatches])

    // ─── Season teams ───
    const seasonTeams = teams.filter(t => String(t.season_id) === String(selectedSeasonId))

    // ─── League siblings (for league-wide stage creation) ───
    const selectedSeason = seasons.find(s => String(s.season_id) === String(selectedSeasonId))
    const leagueSiblings = selectedSeason
        ? seasons.filter(s => s.league_id === selectedSeason.league_id && s.is_active)
        : []
    const hasMultipleDivisions = leagueSiblings.length > 1

    // ─── Toggle stage expand/collapse ───
    const toggleStage = (stageId) => {
        setExpandedStages(prev => ({ ...prev, [stageId]: !prev[stageId] }))
    }

    // ═══════════════════════════════════════════════════
    // STAGE CRUD
    // ═══════════════════════════════════════════════════

    const openNewStageForm = () => {
        setEditingStage('new')
        setStageForm({ name: '', stage_type: '', sort_order: stages.length, status: 'pending', league_wide: false })
    }

    const openEditStageForm = (stage) => {
        setEditingStage(stage.id)
        setStageForm({
            name: stage.name,
            stage_type: stage.stage_type || '',
            sort_order: stage.sort_order,
            status: stage.status,
        })
    }

    const submitStage = async (e) => {
        e.preventDefault()
        if (!stageForm.name.trim()) { showToast('error', 'Name is required'); return }
        setSaving(true)
        try {
            if (editingStage === 'new') {
                const isLeagueWide = stageForm.league_wide && hasMultipleDivisions
                const result = await doAction({
                    action: isLeagueWide ? 'create-stage-league-wide' : 'create-stage',
                    season_id: selectedSeasonId,
                    name: stageForm.name.trim(),
                    stage_type: stageForm.stage_type || null,
                    sort_order: parseInt(stageForm.sort_order) || 0,
                })
                showToast('success', isLeagueWide
                    ? `Stage created in ${result.created_count} division${result.created_count !== 1 ? 's' : ''}`
                    : 'Stage created'
                )
            } else {
                await doAction({
                    action: 'update-stage',
                    id: editingStage,
                    name: stageForm.name.trim(),
                    stage_type: stageForm.stage_type || null,
                    sort_order: parseInt(stageForm.sort_order) || 0,
                    status: stageForm.status,
                })
                showToast('success', 'Stage updated')
            }
            setEditingStage(null)
            reload()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteStage = (stage) => {
        setConfirmModal({
            title: 'Delete Stage',
            message: `Delete "${stage.name}"? All groups and rounds within it will also be removed. Matches will be unlinked.`,
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'delete-stage', id: stage.id })
                    showToast('success', 'Stage deleted')
                    reload()
                } catch (err) {
                    showToast('error', err.message)
                }
            },
        })
    }

    // ═══════════════════════════════════════════════════
    // GROUP CRUD
    // ═══════════════════════════════════════════════════

    const openNewGroupForm = (stageId) => {
        const stageGroups = groups.filter(g => g.stage_id === stageId)
        setEditingGroup('new')
        setGroupFormStageId(stageId)
        setGroupForm({ name: '', sort_order: stageGroups.length, league_wide: false })
    }

    const openEditGroupForm = (group) => {
        setEditingGroup(group.id)
        setGroupFormStageId(group.stage_id)
        setGroupForm({ name: group.name, sort_order: group.sort_order })
    }

    const submitGroup = async (e) => {
        e.preventDefault()
        if (!groupForm.name.trim()) { showToast('error', 'Name is required'); return }
        setSaving(true)
        try {
            if (editingGroup === 'new') {
                const isLeagueWide = groupForm.league_wide && hasMultipleDivisions
                const result = await doAction({
                    action: isLeagueWide ? 'create-group-league-wide' : 'create-group',
                    stage_id: groupFormStageId,
                    name: groupForm.name.trim(),
                    sort_order: parseInt(groupForm.sort_order) || 0,
                })
                showToast('success', isLeagueWide
                    ? `Group created in ${result.created_count} division${result.created_count !== 1 ? 's' : ''}`
                    : 'Group created'
                )
            } else {
                await doAction({
                    action: 'update-group',
                    id: editingGroup,
                    name: groupForm.name.trim(),
                    sort_order: parseInt(groupForm.sort_order) || 0,
                })
                showToast('success', 'Group updated')
            }
            setEditingGroup(null)
            setGroupFormStageId(null)
            reload()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteGroup = (group) => {
        setConfirmModal({
            title: 'Delete Group',
            message: `Delete "${group.name}"? Team assignments will be removed.`,
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'delete-group', id: group.id })
                    showToast('success', 'Group deleted')
                    reload()
                } catch (err) {
                    showToast('error', err.message)
                }
            },
        })
    }

    // ─── Group teams editing ───
    const openGroupTeamsEditor = (groupId) => {
        const existing = groupTeams.filter(gt => gt.group_id === groupId)
        setEditingGroupTeams(groupId)
        setGroupTeamDraft(existing.map(gt => ({ team_id: gt.team_id, seed: gt.seed ?? '' })))
    }

    const addTeamToDraft = (teamId) => {
        if (!teamId || groupTeamDraft.some(d => String(d.team_id) === String(teamId))) return
        setGroupTeamDraft(prev => [...prev, { team_id: parseInt(teamId), seed: '' }])
    }

    const removeTeamFromDraft = (teamId) => {
        setGroupTeamDraft(prev => prev.filter(d => d.team_id !== teamId))
    }

    const updateDraftSeed = (teamId, seed) => {
        setGroupTeamDraft(prev => prev.map(d => d.team_id === teamId ? { ...d, seed: seed } : d))
    }

    const submitGroupTeams = async () => {
        setSaving(true)
        try {
            await doAction({
                action: 'set-group-teams',
                group_id: editingGroupTeams,
                teams: groupTeamDraft.map(d => ({
                    team_id: d.team_id,
                    seed: d.seed !== '' ? parseInt(d.seed) : null,
                })),
            })
            showToast('success', 'Teams updated')
            setEditingGroupTeams(null)
            reload()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    // ═══════════════════════════════════════════════════
    // ROUND CRUD
    // ═══════════════════════════════════════════════════

    const openNewRoundForm = (stageId) => {
        const stageRounds = rounds.filter(r => r.stage_id === stageId)
        const nextNum = stageRounds.length > 0 ? Math.max(...stageRounds.map(r => r.round_number)) + 1 : 1
        setEditingRound('new')
        setRoundFormStageId(stageId)
        setRoundForm({ name: `Round ${nextNum}`, round_number: nextNum, sort_order: nextNum, best_of_override: '', scheduled_date: '', league_wide: false })
    }

    const openEditRoundForm = (round) => {
        setEditingRound(round.id)
        setRoundFormStageId(round.stage_id)
        setRoundForm({
            name: round.name,
            round_number: round.round_number,
            sort_order: round.sort_order,
            best_of_override: round.best_of_override ?? '',
            scheduled_date: round.scheduled_date ? round.scheduled_date.slice(0, 10) : '',
        })
    }

    const submitRound = async (e) => {
        e.preventDefault()
        if (!roundForm.name.trim()) { showToast('error', 'Name is required'); return }
        if (roundForm.round_number === '' || roundForm.round_number == null) { showToast('error', 'Round number is required'); return }
        setSaving(true)
        try {
            if (editingRound === 'new') {
                const isLeagueWide = roundForm.league_wide && hasMultipleDivisions
                const result = await doAction({
                    action: isLeagueWide ? 'create-round-league-wide' : 'create-round',
                    stage_id: roundFormStageId,
                    name: roundForm.name.trim(),
                    round_number: parseInt(roundForm.round_number),
                    sort_order: parseInt(roundForm.sort_order) || parseInt(roundForm.round_number),
                    best_of_override: roundForm.best_of_override ? parseInt(roundForm.best_of_override) : null,
                    scheduled_date: roundForm.scheduled_date || null,
                })
                showToast('success', isLeagueWide
                    ? `Round created in ${result.created_count} division${result.created_count !== 1 ? 's' : ''}`
                    : 'Round created'
                )
            } else {
                await doAction({
                    action: 'update-round',
                    id: editingRound,
                    name: roundForm.name.trim(),
                    round_number: parseInt(roundForm.round_number),
                    sort_order: parseInt(roundForm.sort_order) || parseInt(roundForm.round_number),
                    best_of_override: roundForm.best_of_override ? parseInt(roundForm.best_of_override) : null,
                    scheduled_date: roundForm.scheduled_date || null,
                })
                showToast('success', 'Round updated')
            }
            setEditingRound(null)
            setRoundFormStageId(null)
            reload()
        } catch (err) {
            showToast('error', err.message)
        } finally {
            setSaving(false)
        }
    }

    const deleteRound = (round) => {
        setConfirmModal({
            title: 'Delete Round',
            message: `Delete "${round.name}"? Matches will be unlinked from this round.`,
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'delete-round', id: round.id })
                    showToast('success', 'Round deleted')
                    reload()
                } catch (err) {
                    showToast('error', err.message)
                }
            },
        })
    }

    // ═══════════════════════════════════════════════════
    // BRACKET HELPERS
    // ═══════════════════════════════════════════════════

    const getSourceDescription = (source) => {
        if (!source) return null
        if (source.type === 'match_result') {
            const srcMatch = scheduledMatches.find(m => m.id === source.scheduled_match_id)
            const label = source.result === 'winner' ? 'Winner' : 'Loser'
            if (srcMatch) {
                const t1 = srcMatch.team1_name || 'TBD'
                const t2 = srcMatch.team2_name || 'TBD'
                return `${label} of ${t1} vs ${t2}`
            }
            return `${label} of Match #${source.scheduled_match_id}`
        }
        if (source.type === 'group_standing') {
            const g = groups.find(gr => gr.id === source.group_id)
            return `${g ? g.name : 'Group'} #${source.position}`
        }
        if (source.type === 'seed') {
            return `Seed #${source.position}`
        }
        return null
    }

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--color-accent)] border-t-transparent mx-auto mb-4" />
                    <p className="text-[var(--color-text-secondary)]">Loading stage data...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto pb-8 px-4">
            <PageTitle title="Stage Manager" noindex />

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
                <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">Stage Manager</h1>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                    Manage tournament stages, groups, and rounds
                </p>
            </div>

            {/* Season Selector */}
            <div className="bg-[var(--color-secondary)] border border-white/10 rounded-xl p-4 mb-6">
                <div className="flex-1 max-w-md">
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Season</label>
                    <select
                        value={selectedSeasonId || ''}
                        onChange={e => handleSeasonChange(e.target.value)}
                        className={inputClass}
                        style={inputStyle}
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

            {/* Stage List */}
            {stagesLoading ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Loading stages...</p>
            ) : !selectedSeasonId ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Select a season to manage stages.</p>
            ) : (
                <div className="space-y-3">
                    {stages.map(stage => (
                        <StageCard
                            key={stage.id}
                            stage={stage}
                            expanded={!!expandedStages[stage.id]}
                            onToggle={() => toggleStage(stage.id)}
                            onEdit={() => openEditStageForm(stage)}
                            onDelete={() => deleteStage(stage)}
                            // Groups
                            groups={groups.filter(g => g.stage_id === stage.id)}
                            groupTeams={groupTeams}
                            seasonTeams={seasonTeams}
                            onNewGroup={() => openNewGroupForm(stage.id)}
                            onEditGroup={openEditGroupForm}
                            onDeleteGroup={deleteGroup}
                            onEditGroupTeams={openGroupTeamsEditor}
                            editingGroupTeams={editingGroupTeams}
                            groupTeamDraft={groupTeamDraft}
                            onAddTeamToDraft={addTeamToDraft}
                            onRemoveTeamFromDraft={removeTeamFromDraft}
                            onUpdateDraftSeed={updateDraftSeed}
                            onSubmitGroupTeams={submitGroupTeams}
                            onCancelGroupTeams={() => setEditingGroupTeams(null)}
                            // Rounds
                            rounds={rounds.filter(r => r.stage_id === stage.id)}
                            onNewRound={() => openNewRoundForm(stage.id)}
                            onEditRound={openEditRoundForm}
                            onDeleteRound={deleteRound}
                            // Bracket
                            scheduledMatches={scheduledMatches.filter(m => m.stage_id === stage.id)}
                            getSourceDescription={getSourceDescription}
                            saving={saving}
                        />
                    ))}

                    {stages.length === 0 && (
                        <div className="text-center py-12">
                            <p className="text-[var(--color-text-secondary)] text-sm">No stages yet for this season.</p>
                        </div>
                    )}

                    {/* Stage Form (inline at bottom) */}
                    {editingStage != null && (
                        <StageForm
                            isNew={editingStage === 'new'}
                            form={stageForm}
                            setForm={setStageForm}
                            onSubmit={submitStage}
                            onCancel={() => setEditingStage(null)}
                            saving={saving}
                            hasMultipleDivisions={hasMultipleDivisions}
                            leagueName={selectedSeason?.league_name}
                        />
                    )}

                    {/* Group Form (modal-like inline) */}
                    {editingGroup != null && (
                        <GroupForm
                            isNew={editingGroup === 'new'}
                            form={groupForm}
                            setForm={setGroupForm}
                            onSubmit={submitGroup}
                            onCancel={() => { setEditingGroup(null); setGroupFormStageId(null) }}
                            saving={saving}
                            hasMultipleDivisions={hasMultipleDivisions}
                            leagueName={selectedSeason?.league_name}
                        />
                    )}

                    {/* Round Form */}
                    {editingRound != null && (
                        <RoundForm
                            isNew={editingRound === 'new'}
                            form={roundForm}
                            setForm={setRoundForm}
                            onSubmit={submitRound}
                            onCancel={() => { setEditingRound(null); setRoundFormStageId(null) }}
                            saving={saving}
                            hasMultipleDivisions={hasMultipleDivisions}
                            leagueName={selectedSeason?.league_name}
                        />
                    )}

                    {editingStage == null && (
                        <button
                            onClick={openNewStageForm}
                            className="w-full py-3 rounded-xl border border-dashed border-white/20 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:border-white/40 hover:bg-white/5 transition-colors"
                        >
                            + Add Stage
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// STAGE CARD (collapsible)
// ═══════════════════════════════════════════════════

function StageCard({
    stage, expanded, onToggle, onEdit, onDelete,
    groups, groupTeams, seasonTeams,
    onNewGroup, onEditGroup, onDeleteGroup,
    onEditGroupTeams, editingGroupTeams, groupTeamDraft,
    onAddTeamToDraft, onRemoveTeamFromDraft, onUpdateDraftSeed,
    onSubmitGroupTeams, onCancelGroupTeams,
    rounds, onNewRound, onEditRound, onDeleteRound,
    scheduledMatches, getSourceDescription,
    saving,
}) {
    const typeLabel = stage.stage_type ? (STAGE_TYPE_LABELS[stage.stage_type] || stage.stage_type) : 'Freeform'
    const typeColor = stage.stage_type ? (STAGE_TYPE_COLORS[stage.stage_type] || 'bg-gray-500/15 border-gray-500/30 text-gray-400') : 'bg-gray-500/15 border-gray-500/30 text-gray-400'
    const statusColor = STATUS_COLORS[stage.status] || STATUS_COLORS.pending

    const isElimination = stage.stage_type === 'single_elimination' || stage.stage_type === 'double_elimination'

    return (
        <div className="bg-[var(--color-secondary)] border border-white/10 rounded-xl overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={onToggle}
            >
                <span className="text-[var(--color-text-secondary)] text-xs select-none w-4 text-center">
                    {expanded ? '\u25BC' : '\u25B6'}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums w-6 text-center">
                    #{stage.sort_order}
                </span>
                <span className="text-sm font-semibold text-[var(--color-text)] flex-1">{stage.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md border ${typeColor}`}>{typeLabel}</span>
                <span className={`text-xs px-2 py-0.5 rounded-md border ${statusColor}`}>{stage.status}</span>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={onEdit} className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors">
                        Edit
                    </button>
                    <button onClick={onDelete} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                        Delete
                    </button>
                </div>
            </div>

            {/* Expanded content */}
            {expanded && (
                <div className="border-t border-white/10 px-4 py-4 space-y-6">
                    {/* Groups section */}
                    <GroupsSection
                        groups={groups}
                        groupTeams={groupTeams}
                        seasonTeams={seasonTeams}
                        onNewGroup={onNewGroup}
                        onEditGroup={onEditGroup}
                        onDeleteGroup={onDeleteGroup}
                        onEditGroupTeams={onEditGroupTeams}
                        editingGroupTeams={editingGroupTeams}
                        groupTeamDraft={groupTeamDraft}
                        onAddTeamToDraft={onAddTeamToDraft}
                        onRemoveTeamFromDraft={onRemoveTeamFromDraft}
                        onUpdateDraftSeed={onUpdateDraftSeed}
                        onSubmitGroupTeams={onSubmitGroupTeams}
                        onCancelGroupTeams={onCancelGroupTeams}
                        saving={saving}
                    />

                    {/* Rounds section */}
                    <RoundsSection
                        rounds={rounds}
                        onNewRound={onNewRound}
                        onEditRound={onEditRound}
                        onDeleteRound={onDeleteRound}
                    />

                    {/* Bracket visualization for elimination types */}
                    {isElimination && scheduledMatches.length > 0 && (
                        <BracketVisualization
                            stage={stage}
                            rounds={rounds}
                            scheduledMatches={scheduledMatches}
                            getSourceDescription={getSourceDescription}
                        />
                    )}
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// GROUPS SECTION
// ═══════════════════════════════════════════════════

function GroupsSection({
    groups, groupTeams, seasonTeams,
    onNewGroup, onEditGroup, onDeleteGroup,
    onEditGroupTeams, editingGroupTeams, groupTeamDraft,
    onAddTeamToDraft, onRemoveTeamFromDraft, onUpdateDraftSeed,
    onSubmitGroupTeams, onCancelGroupTeams,
    saving,
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Groups</h3>
                <button onClick={onNewGroup} className="text-xs text-[var(--color-accent)] hover:underline">+ Add Group</button>
            </div>
            {groups.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)] italic">No groups yet.</p>
            ) : (
                <div className="space-y-2">
                    {groups.map(group => {
                        const gTeams = groupTeams.filter(gt => gt.group_id === group.id)
                        const isEditing = editingGroupTeams === group.id
                        return (
                            <div key={group.id} className="rounded-lg border border-white/5 bg-[var(--color-primary)] p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-[var(--color-text)]">{group.name}</span>
                                        <span className="text-xs text-[var(--color-text-secondary)]">({gTeams.length} teams)</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => isEditing ? onCancelGroupTeams() : onEditGroupTeams(group.id)}
                                            className={`px-2 py-1 rounded text-xs transition-colors ${isEditing ? 'text-yellow-400 bg-yellow-500/10' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5'}`}>
                                            {isEditing ? 'Cancel' : 'Set Teams'}
                                        </button>
                                        <button onClick={() => onEditGroup(group)} className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors">
                                            Edit
                                        </button>
                                        <button onClick={() => onDeleteGroup(group)} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                {/* Team list (read-only) */}
                                {!isEditing && gTeams.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {gTeams.map(gt => (
                                            <div key={gt.team_id} className="flex items-center gap-1.5 bg-[var(--color-secondary)] rounded-md px-2 py-1">
                                                <TeamLogo slug={gt.team_slug} name={gt.team_name} size={14} color={gt.team_color} />
                                                <span className="text-xs text-[var(--color-text)]">{gt.team_name}</span>
                                                {gt.seed != null && (
                                                    <span className="text-xs text-[var(--color-text-secondary)]">#{gt.seed}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Team editor (inline) */}
                                {isEditing && (
                                    <div className="mt-2 space-y-2">
                                        {groupTeamDraft.map(dt => {
                                            const team = seasonTeams.find(t => t.team_id === dt.team_id)
                                            return (
                                                <div key={dt.team_id} className="flex items-center gap-2">
                                                    <TeamLogo slug={team?.team_slug} name={team?.team_name || `Team #${dt.team_id}`} size={16} color={team?.color} />
                                                    <span className="text-xs text-[var(--color-text)] flex-1">{team?.team_name || `Team #${dt.team_id}`}</span>
                                                    <label className="text-xs text-[var(--color-text-secondary)]">Seed:</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={dt.seed}
                                                        onChange={e => onUpdateDraftSeed(dt.team_id, e.target.value)}
                                                        placeholder="-"
                                                        className={`w-14 ${numInputClassSm}`}
                                                        style={inputStyle}
                                                    />
                                                    <button onClick={() => onRemoveTeamFromDraft(dt.team_id)} className="text-xs text-red-400 hover:text-red-300">{'\u2715'}</button>
                                                </div>
                                            )
                                        })}
                                        <div className="flex items-center gap-2">
                                            <select
                                                defaultValue=""
                                                onChange={e => { onAddTeamToDraft(e.target.value); e.target.value = '' }}
                                                className={inputClassSm}
                                                style={inputStyle}
                                            >
                                                <option value="">+ Add team...</option>
                                                {seasonTeams
                                                    .filter(t => !groupTeamDraft.some(d => d.team_id === t.team_id))
                                                    .map(t => (
                                                        <option key={t.team_id} value={t.team_id}>{t.team_name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                onClick={onSubmitGroupTeams}
                                                disabled={saving}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 transition-colors"
                                            >
                                                {saving ? 'Saving...' : 'Set Teams'}
                                            </button>
                                            <button
                                                onClick={onCancelGroupTeams}
                                                className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors"
                                            >
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
    )
}

// ═══════════════════════════════════════════════════
// ROUNDS SECTION
// ═══════════════════════════════════════════════════

function RoundsSection({ rounds, onNewRound, onEditRound, onDeleteRound }) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Rounds</h3>
                <button onClick={onNewRound} className="text-xs text-[var(--color-accent)] hover:underline">+ Add Round</button>
            </div>
            {rounds.length === 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)] italic">No rounds yet.</p>
            ) : (
                <div className="space-y-1">
                    {rounds.map(round => (
                        <div key={round.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-[var(--color-primary)] px-3 py-2">
                            <span className="text-xs text-[var(--color-text-secondary)] tabular-nums w-6 text-center">R{round.round_number}</span>
                            <span className="text-sm text-[var(--color-text)] flex-1">{round.name}</span>
                            {round.best_of_override && (
                                <span className="text-xs text-[var(--color-text-secondary)]">Bo{round.best_of_override}</span>
                            )}
                            {round.scheduled_date && (
                                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">{round.scheduled_date.slice(0, 10)}</span>
                            )}
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => onEditRound(round)} className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-white/5 transition-colors">
                                    Edit
                                </button>
                                <button onClick={() => onDeleteRound(round)} className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ═══════════════════════════════════════════════════
// BRACKET VISUALIZATION
// ═══════════════════════════════════════════════════

function BracketVisualization({ stage, rounds, scheduledMatches, getSourceDescription }) {
    const isDouble = stage.stage_type === 'double_elimination'

    // Organize matches by round
    const roundMap = {}
    for (const r of rounds) {
        roundMap[r.id] = { ...r, matches: [] }
    }
    // Also handle matches without a round assignment
    const unroundedMatches = []
    for (const m of scheduledMatches) {
        if (m.round_id && roundMap[m.round_id]) {
            roundMap[m.round_id].matches.push(m)
        } else {
            unroundedMatches.push(m)
        }
    }

    // Sort matches within each round by bracket_position
    for (const r of Object.values(roundMap)) {
        r.matches.sort((a, b) => (a.bracket_position ?? 999) - (b.bracket_position ?? 999))
    }

    const sortedRounds = rounds.slice().sort((a, b) => a.sort_order - b.sort_order)

    // For double elimination, split into winners/losers by naming convention or group
    let winnersRounds = sortedRounds
    let losersRounds = []
    if (isDouble) {
        winnersRounds = sortedRounds.filter(r => {
            const nameLower = r.name.toLowerCase()
            return !nameLower.includes('loser') && !nameLower.startsWith('l')
        })
        losersRounds = sortedRounds.filter(r => {
            const nameLower = r.name.toLowerCase()
            return nameLower.includes('loser') || nameLower.startsWith('l')
        })
        // If the heuristic didn't split them, just show all in winners
        if (losersRounds.length === 0) {
            winnersRounds = sortedRounds
        }
    }

    return (
        <div>
            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Bracket</h3>
            <div className="overflow-x-auto">
                {isDouble && losersRounds.length > 0 && (
                    <div className="mb-2">
                        <span className="text-xs text-green-400 font-semibold uppercase tracking-wider">Winners Bracket</span>
                    </div>
                )}
                <BracketRow rounds={winnersRounds} roundMap={roundMap} getSourceDescription={getSourceDescription} />

                {isDouble && losersRounds.length > 0 && (
                    <>
                        <div className="my-3 border-t border-white/10" />
                        <div className="mb-2">
                            <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Losers Bracket</span>
                        </div>
                        <BracketRow rounds={losersRounds} roundMap={roundMap} getSourceDescription={getSourceDescription} />
                    </>
                )}
            </div>
        </div>
    )
}

function BracketRow({ rounds, roundMap, getSourceDescription }) {
    if (rounds.length === 0) return null

    return (
        <div className="flex gap-0 items-stretch min-w-fit">
            {rounds.map((round, roundIdx) => {
                const rd = roundMap[round.id]
                const matches = rd?.matches || []
                const isLast = roundIdx === rounds.length - 1

                return (
                    <div key={round.id} className="flex flex-col items-center" style={{ minWidth: 220 }}>
                        {/* Round header */}
                        <div className="text-xs text-[var(--color-text-secondary)] font-semibold mb-2 text-center px-2 truncate w-full">
                            {round.name}
                        </div>

                        {/* Match slots */}
                        <div className="flex flex-col justify-around flex-1 gap-2 w-full px-1">
                            {matches.length === 0 ? (
                                <div className="text-xs text-[var(--color-text-secondary)] italic text-center py-4">No matches</div>
                            ) : (
                                matches.map((match) => (
                                    <div key={match.id} className="flex items-center">
                                        <BracketMatchBox match={match} getSourceDescription={getSourceDescription} />
                                        {/* Connector line to next round */}
                                        {!isLast && (
                                            <div className="w-4 flex items-center justify-center">
                                                <div className="w-full h-px bg-white/20" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

function BracketMatchBox({ match, getSourceDescription }) {
    const isCancelled = match.status === 'cancelled'
    const statusColor = MATCH_STATUS_COLORS[match.status] || MATCH_STATUS_COLORS.scheduled

    const team1Label = match.team1_name || getSourceDescription(match.team1_source) || 'TBD'
    const team2Label = match.team2_name || getSourceDescription(match.team2_source) || 'TBD'

    return (
        <div className={`rounded-lg border border-white/10 overflow-hidden flex-1 ${isCancelled ? 'opacity-50' : ''}`}
            style={{ backgroundColor: 'var(--color-primary)', maxWidth: 200 }}>
            {/* Team 1 */}
            <div className={`flex items-center gap-1.5 px-2 py-1.5 ${match.team1_name ? '' : 'opacity-50'}`}>
                {match.team1_name ? (
                    <>
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: match.team1_color || '#3b82f6' }} />
                        <span className="text-xs text-[var(--color-text)] truncate flex-1">{match.team1_name}</span>
                    </>
                ) : (
                    <span className="text-xs text-[var(--color-text-secondary)] italic truncate flex-1">{team1Label}</span>
                )}
            </div>

            {/* Divider with status */}
            <div className="flex items-center gap-1 px-2 border-y border-white/5">
                <div className="flex-1 h-px bg-white/10" />
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor}`}>{match.status}</span>
                <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Team 2 */}
            <div className={`flex items-center gap-1.5 px-2 py-1.5 ${match.team2_name ? '' : 'opacity-50'}`}>
                {match.team2_name ? (
                    <>
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: match.team2_color || '#ef4444' }} />
                        <span className="text-xs text-[var(--color-text)] truncate flex-1">{match.team2_name}</span>
                    </>
                ) : (
                    <span className="text-xs text-[var(--color-text-secondary)] italic truncate flex-1">{team2Label}</span>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// FORMS
// ═══════════════════════════════════════════════════

function StageForm({ isNew, form, setForm, onSubmit, onCancel, saving, hasMultipleDivisions, leagueName }) {
    return (
        <div className="bg-[var(--color-secondary)] border border-cyan-500/20 rounded-xl p-5">
            <h2 className="text-sm font-bold text-[var(--color-text)] mb-4">{isNew ? 'New Stage' : 'Edit Stage'}</h2>
            <form onSubmit={onSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            required
                            placeholder="e.g. Regular Season, Playoffs"
                            className={inputClass}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Type</label>
                        <select
                            value={form.stage_type}
                            onChange={e => setForm(p => ({ ...p, stage_type: e.target.value }))}
                            className={inputClass}
                            style={inputStyle}
                        >
                            <option value="">Freeform</option>
                            <option value="round_robin">Round Robin</option>
                            <option value="single_elimination">Single Elimination</option>
                            <option value="double_elimination">Double Elimination</option>
                            <option value="swiss">Swiss</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Sort Order</label>
                        <input
                            type="number"
                            value={form.sort_order}
                            onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                            className={numInputClass}
                            style={inputStyle}
                        />
                    </div>
                    {!isNew && (
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Status</label>
                            <select
                                value={form.status}
                                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                                className={inputClass}
                                style={inputStyle}
                            >
                                <option value="pending">Pending</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                    )}
                </div>
                {isNew && hasMultipleDivisions && (
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!form.league_wide}
                            onChange={e => setForm(p => ({ ...p, league_wide: e.target.checked }))}
                            className="rounded border-white/20 bg-[var(--color-primary)] text-cyan-500 focus:ring-cyan-500/30"
                        />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                            Create in all {leagueName} divisions
                        </span>
                    </label>
                )}
                <div className="flex gap-2 mt-4">
                    <button type="submit" disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 transition-colors">
                        {saving ? 'Saving...' : isNew ? 'Create Stage' : 'Update Stage'}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}

function GroupForm({ isNew, form, setForm, onSubmit, onCancel, saving, hasMultipleDivisions, leagueName }) {
    return (
        <div className="bg-[var(--color-secondary)] border border-cyan-500/20 rounded-xl p-5">
            <h2 className="text-sm font-bold text-[var(--color-text)] mb-4">{isNew ? 'New Group' : 'Edit Group'}</h2>
            <form onSubmit={onSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            required
                            placeholder="e.g. Group A, Conference East"
                            className={inputClass}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Sort Order</label>
                        <input
                            type="number"
                            value={form.sort_order}
                            onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
                            className={numInputClass}
                            style={inputStyle}
                        />
                    </div>
                </div>
                {isNew && hasMultipleDivisions && (
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!form.league_wide}
                            onChange={e => setForm(p => ({ ...p, league_wide: e.target.checked }))}
                            className="rounded border-white/20 bg-[var(--color-primary)] text-cyan-500 focus:ring-cyan-500/30"
                        />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                            Create in all {leagueName} divisions
                        </span>
                    </label>
                )}
                <div className="flex gap-2 mt-4">
                    <button type="submit" disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 transition-colors">
                        {saving ? 'Saving...' : isNew ? 'Create Group' : 'Update Group'}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}

function RoundForm({ isNew, form, setForm, onSubmit, onCancel, saving, hasMultipleDivisions, leagueName }) {
    return (
        <div className="bg-[var(--color-secondary)] border border-cyan-500/20 rounded-xl p-5">
            <h2 className="text-sm font-bold text-[var(--color-text)] mb-4">{isNew ? 'New Round' : 'Edit Round'}</h2>
            <form onSubmit={onSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Name</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            required
                            placeholder="e.g. Quarterfinals"
                            className={inputClass}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Round Number</label>
                        <input
                            type="number"
                            min="1"
                            value={form.round_number}
                            onChange={e => setForm(p => ({ ...p, round_number: e.target.value }))}
                            required
                            className={numInputClass}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                            Best Of <span className="opacity-50">(override)</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="9"
                            value={form.best_of_override}
                            onChange={e => setForm(p => ({ ...p, best_of_override: e.target.value }))}
                            placeholder="—"
                            className={numInputClass}
                            style={inputStyle}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                            Date <span className="opacity-50">(optional)</span>
                        </label>
                        <input
                            type="date"
                            value={form.scheduled_date}
                            onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))}
                            className={inputClass}
                            style={inputStyle}
                        />
                    </div>
                </div>
                {isNew && hasMultipleDivisions && (
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!form.league_wide}
                            onChange={e => setForm(p => ({ ...p, league_wide: e.target.checked }))}
                            className="rounded border-white/20 bg-[var(--color-primary)] text-cyan-500 focus:ring-cyan-500/30"
                        />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                            Create in all {leagueName} divisions
                        </span>
                    </label>
                )}
                <div className="flex gap-2 mt-4">
                    <button type="submit" disabled={saving}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 transition-colors">
                        {saving ? 'Saving...' : isNew ? 'Create Round' : 'Update Round'}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    )
}
