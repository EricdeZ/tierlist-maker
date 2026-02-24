import { useState, useEffect, useRef } from 'react'
import { API } from './constants'
import { getAuthHeaders } from '../../../services/adminApi.js'

export function AliasLinkModal({ extractedName, adminData, seasonId, onSave, onClose }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedPlayer, setSelectedPlayer] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const inputRef = useRef(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    const searchResults = (() => {
        const q = searchQuery.trim().toLowerCase()
        if (q.length < 2) return []
        const results = []
        const seen = new Set()

        // Search season roster
        const seasonPlayers = seasonId
            ? (adminData?.players || []).filter(p => String(p.season_id) === String(seasonId))
            : (adminData?.players || [])

        for (const p of seasonPlayers) {
            if (seen.has(p.league_player_id)) continue
            if (p.name.toLowerCase().includes(q)) {
                seen.add(p.league_player_id)
                results.push({ ...p, source: 'roster' })
            }
        }

        // Search global players
        if (q.length >= 2) {
            for (const p of (adminData?.globalPlayers || [])) {
                if (seen.has(p.player_id)) continue
                if (p.name.toLowerCase().includes(q)) {
                    seen.add(p.player_id)
                    results.push({ ...p, source: 'global' })
                }
            }
        }

        return results.slice(0, 12)
    })()

    const handleSave = async () => {
        if (!selectedPlayer) return
        setSaving(true)
        setError(null)
        try {
            const pid = selectedPlayer.player_id
            const res = await fetch(`${API}/roster-manage`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ action: 'add-alias', player_id: pid, alias: extractedName }),
            })
            const data = await res.json()
            if (res.ok || res.status === 409) {
                onSave(selectedPlayer)
            } else {
                setError(data.error || 'Failed to save alias')
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
             onClick={onClose}>
            <div className="rounded-xl border border-white/10 shadow-2xl max-w-sm w-full p-5"
                 style={{ backgroundColor: 'var(--color-secondary)' }}
                 onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-bold text-[var(--color-text)] mb-3">Link Alias</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                    Save <span className="text-yellow-400 font-semibold">"{extractedName}"</span> as an alias for an existing player.
                </p>

                {/* Player search */}
                <div className="relative mb-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSelectedPlayer(null) }}
                        placeholder="Search for existing player..."
                        className="w-full px-3 py-2 rounded-lg text-xs bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] transition-colors"
                    />
                    {searchResults.length > 0 && !selectedPlayer && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-lg shadow-xl max-h-48 overflow-y-auto"
                             style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                            {searchResults.map((r, i) => (
                                <button key={`${r.league_player_id || r.player_id}_${i}`}
                                        className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                        onClick={() => { setSelectedPlayer(r); setSearchQuery(r.name) }}>
                                    {r.team_color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: r.team_color }} />}
                                    <span className="text-[var(--color-text)]">{r.name}</span>
                                    {r.role && <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60">{r.role === 'Sub' ? 'Rule 0-Sub' : r.role}</span>}
                                    {r.team_name && <span className="text-[var(--color-text-secondary)] ml-auto text-[10px]">{r.team_name}</span>}
                                    {r.source === 'global' && <span className="text-yellow-400/60 ml-auto text-[10px]">global</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected player preview */}
                {selectedPlayer && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs">
                        <span className="text-green-400 font-semibold">{selectedPlayer.name}</span>
                        {selectedPlayer.team_name && <span className="text-[var(--color-text-secondary)] ml-2">{selectedPlayer.team_name}</span>}
                        <div className="text-[var(--color-text-secondary)] mt-1">
                            "{extractedName}" will be saved as alias
                        </div>
                    </div>
                )}

                {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

                <div className="flex items-center gap-2 justify-end">
                    <button onClick={onClose}
                            className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-white/5 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave}
                            disabled={!selectedPlayer || saving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {saving ? 'Saving...' : 'Save Alias'}
                    </button>
                </div>
            </div>
        </div>
    )
}
