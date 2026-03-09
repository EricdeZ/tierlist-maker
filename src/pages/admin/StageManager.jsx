// src/pages/admin/StageManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '../../services/adminApi.js'
import PageTitle from '../../components/PageTitle'
import BaseModal from '../../components/BaseModal'
import { inputStyle, inputClass } from './stage-manager/constants'
import StageCard from './stage-manager/StageCard'
import StageForm from './stage-manager/StageForm'
import GroupForm from './stage-manager/GroupForm'
import RoundForm from './stage-manager/RoundForm'

const API = import.meta.env.VITE_API_URL || '/api'
const SEASON_KEY = 'smite2_admin_season'

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
        setStageForm({ name: '', stage_type: '', sort_order: stages.length, status: 'pending', counts_for_team_record: true, league_wide: false })
    }

    const openEditStageForm = (stage) => {
        setEditingStage(stage.id)
        setStageForm({
            name: stage.name,
            stage_type: stage.stage_type || '',
            sort_order: stage.sort_order,
            status: stage.status,
            counts_for_team_record: stage.counts_for_team_record !== false,
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
                    counts_for_team_record: stageForm.counts_for_team_record,
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
                    counts_for_team_record: stageForm.counts_for_team_record,
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
                <BaseModal onClose={() => setConfirmModal(null)} maxWidth="max-w-sm" className="p-6">
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
                </BaseModal>
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
