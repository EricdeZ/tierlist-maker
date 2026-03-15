// src/pages/admin/LeagueManager.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Power, Check, X, Globe, Layers, Calendar, MessageCircle, Flag } from 'lucide-react'
import { LeagueManagerHelp } from '../../components/admin/AdminHelp'
import BaseModal from '../../components/BaseModal'
import ImageUpload from '../../components/ImageUpload'
import { getAuthHeaders } from '../../services/adminApi.js'
import { useAuth } from '../../context/AuthContext'

const API = import.meta.env.VITE_API_URL || '/api'

export default function LeagueManager() {
    const { hasPermission } = useAuth()
    const isOwner = hasPermission('permission_manage')
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Expand state
    const [expandedLeagues, setExpandedLeagues] = useState(new Set())
    const [expandedDivisions, setExpandedDivisions] = useState(new Set())
    const [expandedSeasons, setExpandedSeasons] = useState(new Set())

    // Edit/create state
    const [editItem, setEditItem] = useState(null) // { type, id, ...fields }
    const [createItem, setCreateItem] = useState(null) // { type, parentId, ...fields }
    const [saving, setSaving] = useState(false)

    // Confirm modal
    const [confirmModal, setConfirmModal] = useState(null)

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
            const res = await fetch(`${API}/league-manage`, { headers: getAuthHeaders() })
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
        const res = await fetch(`${API}/league-manage`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        })
        const d = await res.json()
        if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`)
        return d
    }, [])

    // ─── Save edit ───
    const handleSaveEdit = async () => {
        if (!editItem) return
        setSaving(true)
        try {
            await doAction({ action: `update-${editItem.type}`, ...editItem })
            showToast('success', `${editItem.type} updated`)
            setEditItem(null)
            fetchData()
        } catch (e) { showToast('error', e.message) }
        finally { setSaving(false) }
    }

    // ─── Save create ───
    const handleSaveCreate = async () => {
        if (!createItem) return
        setSaving(true)
        try {
            await doAction({ action: `create-${createItem.type}`, ...createItem })
            showToast('success', `${createItem.type} created`)
            setCreateItem(null)
            fetchData()
        } catch (e) { showToast('error', e.message) }
        finally { setSaving(false) }
    }

    // ─── Toggle season ───
    const handleToggleSeason = async (id, currentActive) => {
        try {
            await doAction({ action: 'toggle-season', id, is_active: !currentActive })
            showToast('success', `Season ${!currentActive ? 'activated' : 'deactivated'}`)
            fetchData()
        } catch (e) { showToast('error', e.message) }
    }

    // ─── End season (Owner only) ───
    const handleEndSeason = (id, name) => {
        setConfirmModal({
            title: 'End Season',
            message: `End "${name}"? This will close the season, set end date to today, and award season-based challenges. This cannot be undone.`,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: 'end-season', id })
                    showToast('success', `Season "${name}" ended — challenges awarded`)
                    fetchData()
                } catch (e) { showToast('error', e.message) }
            },
        })
    }

    // ─── Delete ───
    const handleDelete = (type, id, name) => {
        setConfirmModal({
            title: `Delete ${type}`,
            message: `Permanently delete "${name}"? This cannot be undone.`,
            danger: true,
            onConfirm: async () => {
                setConfirmModal(null)
                try {
                    await doAction({ action: `delete-${type}`, id })
                    showToast('success', `${name} deleted`)
                    fetchData()
                } catch (e) { showToast('error', e.message) }
            },
        })
    }

    // ─── Toggle expand ───
    const toggleExpand = (set, setter, id) => {
        setter(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    // ─── Derived data ───
    const { leagues, divisionsByLeague, seasonsByDivision, teamsBySeason, playerCountMap, matchCountMap, allSeasons, tagsByDivision } = useMemo(() => {
        if (!data) return { leagues: [], divisionsByLeague: {}, seasonsByDivision: {}, teamsBySeason: {}, playerCountMap: {}, matchCountMap: {}, allSeasons: [], tagsByDivision: {} }

        const divisionsByLeague = {}
        for (const d of data.divisions) {
            if (!divisionsByLeague[d.league_id]) divisionsByLeague[d.league_id] = []
            divisionsByLeague[d.league_id].push(d)
        }

        const seasonsByDivision = {}
        for (const s of data.seasons) {
            if (!seasonsByDivision[s.division_id]) seasonsByDivision[s.division_id] = []
            seasonsByDivision[s.division_id].push(s)
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

        const matchCountMap = {}
        for (const mc of data.seasonMatchCounts) {
            matchCountMap[mc.season_id] = parseInt(mc.match_count)
        }

        const tagsByDivision = {}
        for (const t of (data.divisionTags || [])) {
            if (!tagsByDivision[t.division_id]) tagsByDivision[t.division_id] = []
            tagsByDivision[t.division_id].push({ label: t.label, show_on_league: t.show_on_league })
        }

        // Flat season list with context labels for copy picker
        const allSeasons = data.seasons.map(s => {
            const div = data.divisions.find(d => d.id === s.division_id)
            const league = data.leagues.find(l => l.id === s.league_id)
            const teamCount = (teamsBySeason[s.id] || []).length
            return { ...s, label: `${league?.name || '?'} / ${div?.name || '?'} / ${s.name}`, teamCount }
        })

        return { leagues: data.leagues, divisionsByLeague, seasonsByDivision, teamsBySeason, playerCountMap, matchCountMap, allSeasons, tagsByDivision }
    }, [data])

    // ─── Loading ───
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[var(--color-accent)] border-t-transparent mx-auto mb-4" />
                    <p className="text-[var(--color-text-secondary)]">Loading league data...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="max-w-5xl mx-auto py-8 px-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                    Failed to load: {error}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto pb-8 px-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] max-w-sm px-4 py-3 rounded-lg shadow-xl border text-sm font-medium ${
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
                            <button onClick={() => setConfirmModal(null)} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5">Cancel</button>
                            <button onClick={confirmModal.onConfirm} className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${confirmModal.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>Confirm</button>
                        </div>
                </BaseModal>
            )}

            {/* Header */}
            <div className="mb-6">
                <h1 className="font-heading text-2xl font-bold text-[var(--color-text)]">League Manager</h1>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                    {leagues.length} league{leagues.length !== 1 ? 's' : ''} · {data.divisions.length} division{data.divisions.length !== 1 ? 's' : ''} · {data.seasons.length} season{data.seasons.length !== 1 ? 's' : ''}
                </p>
            </div>

            <LeagueManagerHelp />

            {/* League tree */}
            <div className="space-y-3">
                {leagues.map(league => {
                    const isExpanded = expandedLeagues.has(league.id)
                    const divs = divisionsByLeague[league.id] || []

                    return (
                        <div key={league.id} className="border border-white/10 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-secondary)' }}>
                            {/* League row */}
                            <div className="flex items-center gap-3 px-4 py-3">
                                <button onClick={() => toggleExpand(expandedLeagues, setExpandedLeagues, league.id)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </button>
                                <Globe className="w-4 h-4 text-blue-400 shrink-0" />

                                {editItem?.type === 'league' && editItem.id === league.id ? (
                                    <div className="flex items-start gap-3 flex-1">
                                        <ImageUpload
                                            currentUrl={league.image_url}
                                            uploadFn={async (file) => {
                                                const formData = new FormData()
                                                formData.append('leagueId', league.id)
                                                formData.append('file', file)
                                                const token = localStorage.getItem('auth_token')
                                                const res = await fetch(`${API}/league-upload`, {
                                                    method: 'POST',
                                                    headers: { Authorization: `Bearer ${token}` },
                                                    body: formData,
                                                })
                                                const d = await res.json()
                                                if (!res.ok) throw new Error(d.error || 'Upload failed')
                                            }}
                                            onRemove={async () => {
                                                const token = localStorage.getItem('auth_token')
                                                const res = await fetch(`${API}/league-upload?leagueId=${league.id}`, {
                                                    method: 'DELETE',
                                                    headers: { Authorization: `Bearer ${token}` },
                                                })
                                                const d = await res.json()
                                                if (!res.ok) throw new Error(d.error || 'Delete failed')
                                            }}
                                            onComplete={fetchData}
                                            onError={(msg) => showToast('error', msg)}
                                            size={48}
                                            maxDim={512}
                                        />
                                        <InlineEdit
                                            fields={[
                                                { key: 'name', label: 'Name', value: editItem.name },
                                                { key: 'slug', label: 'Slug', value: editItem.slug },
                                                { key: 'slogan', label: 'Slogan', value: editItem.slogan || '', wide: true },
                                                { key: 'description', label: 'Description', value: editItem.description || '', wide: true },
                                                { key: 'promotional_text', label: 'Promo Text', value: editItem.promotional_text || '', wide: true },
                                                { key: 'discord_url', label: 'Discord URL', value: editItem.discord_url || '', wide: true },
                                                { key: 'color', label: 'Color', value: editItem.color || '#3b82f6', type: 'color', small: true },
                                            ]}
                                            onChange={(k, v) => setEditItem(prev => ({ ...prev, [k]: v }))}
                                            onSave={handleSaveEdit}
                                            onCancel={() => setEditItem(null)}
                                            saving={saving}
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            {league.image_url
                                                ? <img src={league.image_url} alt="" className="w-5 h-5 rounded-sm object-contain shrink-0" />
                                                : league.color && <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: league.color }} />
                                            }
                                            <span className="font-semibold text-[var(--color-text)]">{league.name}</span>
                                            <span className="text-xs text-[var(--color-text-secondary)]">/{league.slug}</span>
                                            <span className="text-xs text-[var(--color-text-secondary)]">{divs.length} div{divs.length !== 1 ? 's' : ''}</span>
                                            {league.discord_url && <MessageCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" title="Discord linked" />}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <IconBtn icon={Pencil} title="Edit" onClick={() => setEditItem({ type: 'league', id: league.id, name: league.name, slug: league.slug, description: league.description || '', discord_url: league.discord_url || '', color: league.color || '', slogan: league.slogan || '', promotional_text: league.promotional_text || '' })} />
                                            <IconBtn icon={Trash2} title="Delete" onClick={() => handleDelete('league', league.id, league.name)} danger />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Divisions */}
                            {isExpanded && (
                                <div className="border-t border-white/5">
                                    {divs.map(div => {
                                        const divExpanded = expandedDivisions.has(div.id)
                                        const seasons = seasonsByDivision[div.id] || []

                                        return (
                                            <div key={div.id} className="border-b border-white/5 last:border-b-0">
                                                {/* Division row */}
                                                <div className="flex items-center gap-3 pl-10 pr-4 py-2.5">
                                                    <button onClick={() => toggleExpand(expandedDivisions, setExpandedDivisions, div.id)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                                                        {divExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />

                                                    {editItem?.type === 'division' && editItem.id === div.id ? (
                                                        <div className="flex-1">
                                                            <InlineEdit
                                                                fields={[
                                                                    { key: 'name', label: 'Name', value: editItem.name },
                                                                    { key: 'slug', label: 'Slug', value: editItem.slug },
                                                                    { key: 'tier', label: 'Tier', value: editItem.tier || '', type: 'number', small: true },
                                                                ]}
                                                                onChange={(k, v) => setEditItem(prev => ({ ...prev, [k]: v }))}
                                                                onSave={handleSaveEdit}
                                                                onCancel={() => setEditItem(null)}
                                                                saving={saving}
                                                            />
                                                            <TagEditor
                                                                tags={editItem.tags || []}
                                                                onChange={tags => setEditItem(prev => ({ ...prev, tags }))}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex-1 min-w-0 flex items-center flex-wrap gap-y-1">
                                                                <span className="font-medium text-sm text-[var(--color-text)]">{div.name}</span>
                                                                <span className="text-xs text-[var(--color-text-secondary)] ml-2">/{div.slug}</span>
                                                                {div.tier && <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Tier {div.tier}</span>}
                                                                {(tagsByDivision[div.id] || []).map(t => (
                                                                    <span key={t.label} className={`text-[10px] ml-1.5 px-1.5 py-0.5 rounded ${t.show_on_league ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-[var(--color-text-secondary)]'}`} title={t.show_on_league ? 'Shown on league' : 'Division only'}>
                                                                        {t.label}{t.show_on_league ? ' \u2191' : ''}
                                                                    </span>
                                                                ))}
                                                                <span className="text-xs text-[var(--color-text-secondary)] ml-2">{seasons.length} season{seasons.length !== 1 ? 's' : ''}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <IconBtn icon={Pencil} title="Edit" onClick={() => setEditItem({ type: 'division', id: div.id, name: div.name, slug: div.slug, tier: div.tier || '', description: div.description || '', tags: tagsByDivision[div.id] || [] })} />
                                                                <IconBtn icon={Trash2} title="Delete" onClick={() => handleDelete('division', div.id, div.name)} danger />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Seasons */}
                                                {divExpanded && (
                                                    <div>
                                                        {seasons.map(season => {
                                                            const seasonExpanded = expandedSeasons.has(season.id)
                                                            const teams = teamsBySeason[season.id] || []
                                                            const matchCount = matchCountMap[season.id] || 0

                                                            return (
                                                                <div key={season.id} className="border-t border-white/[0.03]">
                                                                    {/* Season row */}
                                                                    <div className="flex items-center gap-3 pl-20 pr-4 py-2">
                                                                        <button onClick={() => toggleExpand(expandedSeasons, setExpandedSeasons, season.id)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
                                                                            {seasonExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                                        </button>
                                                                        <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />

                                                                        {editItem?.type === 'season' && editItem.id === season.id ? (
                                                                            <InlineEdit
                                                                                fields={[
                                                                                    { key: 'name', label: 'Name', value: editItem.name },
                                                                                    { key: 'slug', label: 'Slug', value: editItem.slug },
                                                                                    { key: 'start_date', label: 'Start', value: editItem.start_date || '', type: 'date', small: true },
                                                                                    { key: 'end_date', label: 'End', value: editItem.end_date || '', type: 'date', small: true },
                                                                                ]}
                                                                                onChange={(k, v) => setEditItem(prev => ({ ...prev, [k]: v }))}
                                                                                onSave={handleSaveEdit}
                                                                                onCancel={() => setEditItem(null)}
                                                                                saving={saving}
                                                                            />
                                                                        ) : (
                                                                            <>
                                                                                <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                                                                    <span className="text-sm text-[var(--color-text)]">{season.name}</span>
                                                                                    <span className="text-xs text-[var(--color-text-secondary)]">/{season.slug}</span>
                                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${season.is_active ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400'}`}>
                                                                                        {season.is_active ? 'Active' : 'Inactive'}
                                                                                    </span>
                                                                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                                                                        {teams.length} team{teams.length !== 1 ? 's' : ''} · {matchCount} match{matchCount !== 1 ? 'es' : ''}
                                                                                    </span>
                                                                                    {season.start_date && (
                                                                                        <span className="text-[10px] text-[var(--color-text-secondary)]">
                                                                                            {season.start_date.slice(0, 10)}{season.end_date ? ` → ${season.end_date.slice(0, 10)}` : ''}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="flex items-center gap-1">
                                                                                    {isOwner && season.is_active && (
                                                                                        <button
                                                                                            onClick={() => handleEndSeason(season.id, season.name)}
                                                                                            className="p-1 rounded transition-colors text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                                                                            title="End Season"
                                                                                        >
                                                                                            <Flag className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    )}
                                                                                    <button
                                                                                        onClick={() => handleToggleSeason(season.id, season.is_active)}
                                                                                        className={`p-1 rounded transition-colors ${season.is_active ? 'text-green-400 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-500 hover:text-green-400 hover:bg-green-500/10'}`}
                                                                                        title={season.is_active ? 'Deactivate' : 'Activate'}
                                                                                    >
                                                                                        <Power className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                    <IconBtn icon={Pencil} title="Edit" onClick={() => setEditItem({ type: 'season', id: season.id, name: season.name, slug: season.slug, start_date: season.start_date?.slice(0, 10) || '', end_date: season.end_date?.slice(0, 10) || '', description: season.description || '' })} />
                                                                                    <IconBtn icon={Trash2} title="Delete" onClick={() => handleDelete('season', season.id, season.name)} danger />
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}

                                                        {/* Add season */}
                                                        <div className="pl-20 pr-4 py-2 border-t border-white/[0.03]">
                                                            {createItem?.type === 'season' && createItem.division_id === div.id ? (
                                                                <InlineEdit
                                                                    fields={[
                                                                        { key: 'name', label: 'Season name', value: createItem.name || '' },
                                                                        { key: 'start_date', label: 'Start', value: createItem.start_date || '', type: 'date', small: true },
                                                                        { key: 'end_date', label: 'End', value: createItem.end_date || '', type: 'date', small: true },
                                                                    ]}
                                                                    onChange={(k, v) => setCreateItem(prev => ({ ...prev, [k]: v }))}
                                                                    onSave={handleSaveCreate}
                                                                    onCancel={() => setCreateItem(null)}
                                                                    saving={saving}
                                                                />
                                                            ) : (
                                                                <button
                                                                    onClick={() => setCreateItem({ type: 'season', league_id: league.id, division_id: div.id, name: '', start_date: '', end_date: '' })}
                                                                    className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" /> Add season
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}

                                    {/* Add division */}
                                    <div className="pl-10 pr-4 py-2.5 border-t border-white/5">
                                        {createItem?.type === 'division' && createItem.league_id === league.id ? (
                                            <div>
                                                <InlineEdit
                                                    fields={[
                                                        { key: 'name', label: 'Division name', value: createItem.name || '' },
                                                        { key: 'tier', label: 'Tier', value: createItem.tier || '', type: 'number', small: true },
                                                    ]}
                                                    onChange={(k, v) => setCreateItem(prev => ({ ...prev, [k]: v }))}
                                                    onSave={handleSaveCreate}
                                                    onCancel={() => setCreateItem(null)}
                                                    saving={saving}
                                                />
                                                <TagEditor
                                                    tags={createItem.tags || []}
                                                    onChange={tags => setCreateItem(prev => ({ ...prev, tags }))}
                                                />
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => setCreateItem({ type: 'division', league_id: league.id, name: '', tier: '', tags: [] })}
                                                className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Add division
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Add league */}
            <div className="mt-4">
                {createItem?.type === 'league' ? (
                    <div className="border border-white/10 rounded-xl p-4" style={{ backgroundColor: 'var(--color-secondary)' }}>
                        <InlineEdit
                            fields={[
                                { key: 'name', label: 'League name', value: createItem.name || '' },
                                { key: 'slogan', label: 'Slogan', value: createItem.slogan || '', wide: true },
                                { key: 'description', label: 'Description', value: createItem.description || '', wide: true },
                                { key: 'promotional_text', label: 'Promo Text', value: createItem.promotional_text || '', wide: true },
                                { key: 'discord_url', label: 'Discord URL', value: createItem.discord_url || '', wide: true },
                                { key: 'color', label: 'Color', value: createItem.color || '#3b82f6', type: 'color', small: true },
                            ]}
                            onChange={(k, v) => setCreateItem(prev => ({ ...prev, [k]: v }))}
                            onSave={handleSaveCreate}
                            onCancel={() => setCreateItem(null)}
                            saving={saving}
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => setCreateItem({ type: 'league', name: '', description: '', discord_url: '', color: '', slogan: '', promotional_text: '' })}
                        className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors px-4 py-2 rounded-xl border border-dashed border-white/10 hover:border-white/20 w-full justify-center"
                    >
                        <Plus className="w-4 h-4" /> Add League
                    </button>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// INLINE EDIT COMPONENT
// ═══════════════════════════════════════════════════
function InlineEdit({ fields, onChange, onSave, onCancel, saving }) {
    return (
        <div className="flex items-center gap-2 flex-1 flex-wrap">
            {fields.map(f => (
                <div key={f.key} className={f.wide ? 'flex-1 min-w-[200px]' : ''}>
                    <label className="block text-[10px] text-[var(--color-text-secondary)] mb-0.5">{f.label}</label>
                    {f.type === 'color' ? (
                        <input
                            type="color"
                            value={f.value || '#3b82f6'}
                            onChange={e => onChange(f.key, e.target.value)}
                            className="w-8 h-7 rounded border border-white/10 cursor-pointer"
                        />
                    ) : (
                        <input
                            type={f.type || 'text'}
                            value={f.value}
                            onChange={e => onChange(f.key, e.target.value)}
                            placeholder={f.label}
                            className={`rounded px-2 py-1 text-xs border ${f.small ? 'w-24' : f.wide ? 'w-full' : 'w-36'}`}
                            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                            autoFocus={fields.indexOf(f) === 0}
                            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}
                        />
                    )}
                </div>
            ))}
            <div className="flex items-end gap-1 pb-0.5">
                <button onClick={onSave} disabled={saving} className="p-1 rounded text-green-400 hover:bg-green-500/10 disabled:opacity-40" title="Save">
                    <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={onCancel} className="p-1 rounded text-[var(--color-text-secondary)] hover:bg-white/5" title="Cancel">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// TAG EDITOR
// ═══════════════════════════════════════════════════
function TagEditor({ tags, onChange }) {
    const [input, setInput] = useState('')
    const [showOnLeague, setShowOnLeague] = useState(false)

    const addTag = () => {
        const label = input.trim()
        if (!label || tags.some(t => t.label.toLowerCase() === label.toLowerCase())) return
        onChange([...tags, { label, show_on_league: showOnLeague }])
        setInput('')
        setShowOnLeague(false)
    }

    const removeTag = (idx) => {
        onChange(tags.filter((_, i) => i !== idx))
    }

    const toggleLeague = (idx) => {
        onChange(tags.map((t, i) => i === idx ? { ...t, show_on_league: !t.show_on_league } : t))
    }

    return (
        <div className="mt-1.5">
            <label className="block text-[10px] text-[var(--color-text-secondary)] mb-1">Tags</label>
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                    {tags.map((t, i) => (
                        <span
                            key={i}
                            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${t.show_on_league ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-[var(--color-text-secondary)]'}`}
                        >
                            {t.label}
                            <button onClick={() => toggleLeague(i)} className="hover:text-[var(--color-accent)]" title={t.show_on_league ? 'Shown on league (click to toggle)' : 'Division only (click to show on league)'}>
                                {t.show_on_league ? '\u2191' : '\u00b7'}
                            </button>
                            <button onClick={() => removeTag(i)} className="hover:text-red-400">{'\u2715'}</button>
                        </span>
                    ))}
                </div>
            )}
            <div className="flex items-center gap-1.5">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Add tag..."
                    className="rounded px-2 py-1 text-xs border w-28"
                    style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-text)', borderColor: 'rgba(255,255,255,0.1)' }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                />
                <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)] cursor-pointer select-none">
                    <input type="checkbox" checked={showOnLeague} onChange={e => setShowOnLeague(e.target.checked)} className="accent-blue-500" />
                    League
                </label>
                <button onClick={addTag} className="text-[10px] text-[var(--color-accent)] hover:text-[var(--color-text)]">+ Add</button>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// ICON BUTTON
// ═══════════════════════════════════════════════════
function IconBtn({ icon: Icon, title, onClick, danger, size = 'sm' }) {
    const sizeClass = size === 'xs' ? 'p-0.5' : 'p-1'
    const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'
    return (
        <button
            onClick={onClick}
            className={`${sizeClass} rounded transition-colors ${
                danger
                    ? 'text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-500/10'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5'
            }`}
            title={title}
        >
            <Icon className={iconSize} />
        </button>
    )
}
