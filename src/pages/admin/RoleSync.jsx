import { useState, useEffect, useCallback, useMemo } from 'react'
import { getAuthHeaders } from '../../services/adminApi.js'
import { useAuth } from '../../context/AuthContext'
import PageTitle from '../../components/PageTitle'

const API = import.meta.env.VITE_API_URL || '/api'

const ROLE_COLORS = {
    solo: 'text-red-400 bg-red-900/40',
    jungle: 'text-green-400 bg-green-900/40',
    mid: 'text-blue-400 bg-blue-900/40',
    support: 'text-yellow-400 bg-yellow-900/40',
    adc: 'text-purple-400 bg-purple-900/40',
    fill: 'text-gray-400 bg-gray-700/40',
}

function RoleBadge({ role, className = '' }) {
    if (!role) return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase bg-gray-700/50 text-gray-500 ${className}`}>none</span>
    const colors = ROLE_COLORS[role] || 'text-gray-400 bg-gray-700/40'
    return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${colors} ${className}`}>{role}</span>
}

export default function RoleSync() {
    useAuth()
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState(null)
    const [seasons, setSeasons] = useState([])

    // Scope: 'all' | 'league' | 'season'
    const [scope, setScope] = useState('season')
    const [selectedLeagueId, setSelectedLeagueId] = useState(null)
    const [selectedSeasonId, setSelectedSeasonId] = useState(null)

    const [preview, setPreview] = useState(null)
    const [previewing, setPreviewing] = useState(false)
    const [applying, setApplying] = useState(false)
    const [excluded, setExcluded] = useState(new Set())

    const showToast = useCallback((type, message) => {
        const id = Date.now()
        setToast({ type, message, id })
        setTimeout(() => setToast(prev => prev?.id === id ? null : prev), 4000)
    }, [])

    useEffect(() => {
        fetch(`${API}/admin-data`, { headers: getAuthHeaders() })
            .then(r => r.json())
            .then(data => setSeasons(data.seasons || []))
            .catch(err => showToast('error', err.message))
            .finally(() => setLoading(false))
    }, [showToast])

    // Derive unique leagues from seasons
    const leagues = useMemo(() => {
        const map = {}
        for (const s of seasons) {
            if (!map[s.league_id]) {
                map[s.league_id] = { id: s.league_id, name: s.league_name }
            }
        }
        return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
    }, [seasons])

    // Resolve which season IDs to send based on scope
    const targetSeasonIds = useMemo(() => {
        if (scope === 'all') return seasons.filter(s => s.is_active).map(s => s.season_id)
        if (scope === 'league' && selectedLeagueId) return seasons.filter(s => s.league_id === selectedLeagueId).map(s => s.season_id)
        if (scope === 'season' && selectedSeasonId) return [selectedSeasonId]
        return []
    }, [scope, seasons, selectedLeagueId, selectedSeasonId])

    const canScan = targetSeasonIds.length > 0

    const scopeLabel = useMemo(() => {
        if (scope === 'all') return 'all active divisions'
        if (scope === 'league') {
            const l = leagues.find(l => l.id === selectedLeagueId)
            return l ? l.name : 'league'
        }
        if (scope === 'season') {
            const s = seasons.find(s => s.season_id === selectedSeasonId)
            return s ? `${s.division_name}` : 'season'
        }
        return ''
    }, [scope, leagues, seasons, selectedLeagueId, selectedSeasonId])

    const runPreview = async () => {
        if (!canScan) return
        setPreviewing(true)
        setPreview(null)
        setExcluded(new Set())
        try {
            const res = await fetch(`${API}/role-sync`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'preview', seasonIds: targetSeasonIds }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setPreview(data)
        } catch (err) {
            showToast('error', `Preview failed: ${err.message}`)
        } finally {
            setPreviewing(false)
        }
    }

    const toggleChange = (lpId) => {
        setExcluded(prev => {
            const next = new Set(prev)
            if (next.has(lpId)) next.delete(lpId)
            else next.add(lpId)
            return next
        })
    }

    const allChanges = useMemo(() => {
        if (!preview) return []
        return preview.teams.flatMap(t => t.changes)
    }, [preview])

    const includedChanges = useMemo(() => {
        return allChanges.filter(ch => !excluded.has(ch.leaguePlayerId))
    }, [allChanges, excluded])

    const applyChanges = async () => {
        if (!targetSeasonIds.length || !includedChanges.length) return
        setApplying(true)
        try {
            const updates = includedChanges.map(ch => ({
                leaguePlayerId: ch.leaguePlayerId,
                newRole: ch.newRole,
            }))
            const res = await fetch(`${API}/role-sync`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'apply', seasonIds: targetSeasonIds, updates }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast('success', `Applied ${data.applied} role change${data.applied !== 1 ? 's' : ''}${data.skipped ? ` (${data.skipped} skipped)` : ''}`)
            runPreview()
        } catch (err) {
            showToast('error', `Apply failed: ${err.message}`)
        } finally {
            setApplying(false)
        }
    }

    const matchUrl = (ch) => `/${ch.leagueSlug}/${ch.divisionSlug}/matches`

    const resetPreview = () => {
        setPreview(null)
        setExcluded(new Set())
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <PageTitle title="Role Sync" noindex />

            <div className="max-w-7xl mx-auto p-4 space-y-6">
                <div>
                    <h1 className="text-lg font-semibold">Role Sync</h1>
                    <p className="text-xs text-gray-500">Detect role mismatches by comparing each player's assigned role to their most played role</p>
                </div>

                {toast && (
                    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm transition-all ${
                        toast.type === 'success' ? 'bg-green-900/90 border-green-600 text-green-200' : 'bg-red-900/90 border-red-600 text-red-200'
                    }`}>
                        {toast.message}
                    </div>
                )}

                {/* Scope selector */}
                <div className="space-y-3">
                    <div className="flex items-center gap-1 bg-gray-900 rounded-lg p-1 w-fit">
                        {[
                            { key: 'season', label: 'Single Season' },
                            { key: 'league', label: 'Entire League' },
                            { key: 'all', label: 'All Divisions' },
                        ].map(s => (
                            <button
                                key={s.key}
                                onClick={() => { setScope(s.key); resetPreview() }}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                                    scope === s.key
                                        ? 'bg-gray-700 text-white'
                                        : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3">
                        {scope === 'season' && (
                            <select
                                value={selectedSeasonId || ''}
                                onChange={e => {
                                    setSelectedSeasonId(e.target.value ? parseInt(e.target.value) : null)
                                    resetPreview()
                                }}
                                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 max-w-xl focus:border-purple-500 focus:outline-none"
                            >
                                <option value="">Select a season...</option>
                                {seasons.map(s => (
                                    <option key={s.season_id} value={s.season_id}>
                                        {s.league_name} — {s.division_name} — {s.season_name}{s.is_active ? '' : ' (inactive)'}
                                    </option>
                                ))}
                            </select>
                        )}

                        {scope === 'league' && (
                            <select
                                value={selectedLeagueId || ''}
                                onChange={e => {
                                    setSelectedLeagueId(e.target.value ? parseInt(e.target.value) : null)
                                    resetPreview()
                                }}
                                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 max-w-xl focus:border-purple-500 focus:outline-none"
                            >
                                <option value="">Select a league...</option>
                                {leagues.map(l => {
                                    const count = seasons.filter(s => s.league_id === l.id).length
                                    return (
                                        <option key={l.id} value={l.id}>
                                            {l.name} ({count} season{count !== 1 ? 's' : ''})
                                        </option>
                                    )
                                })}
                            </select>
                        )}

                        {scope === 'all' && (
                            <span className="text-sm text-gray-400">
                                Scanning {seasons.filter(s => s.is_active).length} active season{seasons.filter(s => s.is_active).length !== 1 ? 's' : ''} across all leagues
                            </span>
                        )}

                        <button
                            onClick={runPreview}
                            disabled={!canScan || previewing}
                            className="text-xs px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium shrink-0"
                        >
                            {previewing ? 'Scanning...' : 'Scan Roles'}
                        </button>
                    </div>
                </div>

                {/* Preview Results */}
                {preview && (
                    <div className="space-y-4">
                        {/* Summary bar */}
                        <div className="flex flex-wrap items-center gap-4 bg-gray-800/60 rounded-lg px-4 py-3">
                            {preview.summary.changes > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                    <span className="text-sm text-amber-400 font-medium">{preview.summary.changes} mismatch{preview.summary.changes !== 1 ? 'es' : ''}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                                <span className="text-sm text-green-400">{preview.summary.unchanged} correct</span>
                            </div>
                            {preview.summary.noData > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                                    <span className="text-sm text-gray-400">{preview.summary.noData} no game data</span>
                                </div>
                            )}
                            {excluded.size > 0 && (
                                <span className="text-xs text-gray-500">
                                    ({excluded.size} excluded)
                                </span>
                            )}
                            {scope !== 'season' && (
                                <span className="text-xs text-gray-500 ml-auto">
                                    {scopeLabel}
                                </span>
                            )}
                        </div>

                        {/* Team changes */}
                        {preview.teams.filter(t => t.changes.length > 0).map(team => {
                            const teamIncluded = team.changes.filter(ch => !excluded.has(ch.leaguePlayerId)).length
                            return (
                                <div key={`${team.teamId}-${team.divisionName}`} className="bg-gray-800/40 border border-gray-700/50 rounded-lg overflow-hidden">
                                    <div className="px-3 py-2 border-b border-gray-700/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.teamColor }} />
                                            <span className="text-sm font-semibold">{team.teamName}</span>
                                            {scope !== 'season' && team.divisionName && (
                                                <span className="text-[10px] text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
                                                    {team.leagueName} — {team.divisionName}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {teamIncluded}/{team.changes.length} selected
                                            {team.unchanged > 0 && <>, {team.unchanged} correct</>}
                                            {team.noData > 0 && <>, {team.noData} no data</>}
                                        </span>
                                    </div>
                                    <div className="divide-y divide-gray-700/30">
                                        {team.changes.map((ch) => {
                                            const isExcluded = excluded.has(ch.leaguePlayerId)
                                            return (
                                                <label
                                                    key={ch.leaguePlayerId}
                                                    className={`px-3 py-1.5 flex items-center gap-3 text-sm cursor-pointer hover:bg-white/[0.02] transition-colors ${
                                                        isExcluded ? 'opacity-40' : ''
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={!isExcluded}
                                                        onChange={() => toggleChange(ch.leaguePlayerId)}
                                                        className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 shrink-0"
                                                    />
                                                    <span className="text-gray-300 min-w-0 truncate w-36">{ch.playerName}</span>
                                                    <RoleBadge role={ch.currentRole} />
                                                    <span className="text-gray-600">&rarr;</span>
                                                    <RoleBadge role={ch.newRole} />
                                                    <a
                                                        href={matchUrl(ch)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={e => e.stopPropagation()}
                                                        className="text-[10px] text-blue-400 hover:text-blue-300 underline underline-offset-2 shrink-0 ml-auto"
                                                    >
                                                        {ch.gameCount} game{ch.gameCount !== 1 ? 's' : ''}
                                                        {ch.matchDate && <span className="text-gray-600 ml-1">last {new Date(ch.matchDate).toLocaleDateString()}</span>}
                                                    </a>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}

                        {/* No changes */}
                        {allChanges.length === 0 && (
                            <div className="text-center py-4 text-sm text-gray-500">
                                All roles are already correct based on game data.
                            </div>
                        )}

                        {/* Apply button */}
                        {includedChanges.length > 0 && (
                            <button
                                onClick={applyChanges}
                                disabled={applying}
                                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold transition"
                            >
                                {applying ? 'Applying...' : `Apply ${includedChanges.length} Role Change${includedChanges.length !== 1 ? 's' : ''}`}
                            </button>
                        )}
                    </div>
                )}

                {!canScan && !preview && (
                    <p className="text-sm text-gray-500 py-2">
                        {scope === 'season' && 'Select a season to scan for role mismatches.'}
                        {scope === 'league' && 'Select a league to scan all its divisions.'}
                    </p>
                )}
            </div>
        </div>
    )
}
