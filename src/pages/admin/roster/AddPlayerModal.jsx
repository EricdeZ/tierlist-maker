// src/pages/admin/roster/AddPlayerModal.jsx
import { useState, useEffect, useRef } from 'react'
import { ROLES } from './constants'

export function AddPlayerModal({ teamName, teamColor, seasonId, globalPlayers, leagueRosteredPlayerIds, pendingChanges, onClose, onAddExisting, onCreateNew, opLoading }) {
    const [mode, setMode] = useState('search') // 'search' | 'create'
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedRole, setSelectedRole] = useState('Fill')
    const [newPlayerName, setNewPlayerName] = useState('')
    const [error, setError] = useState(null)
    const [addedIds, setAddedIds] = useState(new Set()) // Track players added in this session
    const inputRef = useRef(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [mode])

    // Players already in pending add changes
    const pendingAddIds = new Set(
        (pendingChanges || []).filter(c => c.type === 'add').map(c => c.player_id)
    )

    // Filter global players — only show free agents (not on any team in this league)
    const searchResults = searchQuery.trim().length >= 2
        ? globalPlayers
            .filter(p => {
                const q = searchQuery.trim().toLowerCase()
                const nameMatch = p.name.toLowerCase().includes(q) || (p.discord_name && p.discord_name.toLowerCase().includes(q))
                return nameMatch && !leagueRosteredPlayerIds.has(p.player_id)
            })
            .map(p => ({
                ...p,
                is_pending_add: pendingAddIds.has(p.player_id),
                is_just_added: addedIds.has(p.player_id),
            }))
            .slice(0, 15)
        : []

    const isAnyLoading = Object.values(opLoading).some(Boolean)

    const handleAddExisting = (player) => {
        if (player.is_pending_add || player.is_just_added) return
        setError(null)
        // Pass null for role — backend/pending logic uses player.main_role
        // Only pass selectedRole if the player has no default role
        const role = player.main_role ? null : selectedRole
        onAddExisting(player, role)
        setAddedIds(prev => new Set([...prev, player.player_id]))
        setSearchQuery('')
        setSelectedRole('Fill')
        setTimeout(() => inputRef.current?.focus(), 0)
    }

    const handleCreateNew = async () => {
        const trimmed = newPlayerName.trim()
        if (!trimmed) {
            setError('Please enter a player name.')
            return
        }
        if (trimmed.length < 2) {
            setError('Player name must be at least 2 characters.')
            return
        }
        setError(null)
        await onCreateNew(trimmed, selectedRole)
        setNewPlayerName('')
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div
                className="rounded-xl border border-white/10 shadow-2xl max-w-md w-full overflow-hidden"
                style={{ backgroundColor: 'var(--color-secondary)' }}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
                        <h3 className="text-base font-bold text-[var(--color-text)]">
                            Add Player to {teamName}
                        </h3>
                        {addedIds.size > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">
                                {addedIds.size} queued
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] text-lg">✕</button>
                </div>

                {/* Mode tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        onClick={() => { setMode('search'); setError(null) }}
                        className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                            mode === 'search'
                                ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        Search Existing
                    </button>
                    <button
                        onClick={() => { setMode('create'); setError(null) }}
                        className={`flex-1 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                            mode === 'create'
                                ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        Create New
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Role selector — only for create mode, or search results with no default role */}
                {(mode === 'create' || (mode === 'search' && searchResults.some(p => !p.main_role))) && (
                    <div className="px-5 pt-4 pb-2">
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                            Role
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                            {ROLES.map(r => (
                                <button
                                    key={r}
                                    onClick={() => setSelectedRole(r)}
                                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                        selectedRole === r
                                            ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30'
                                            : 'bg-white/5 text-[var(--color-text-secondary)] hover:bg-white/10'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Search mode */}
                {mode === 'search' && (
                    <div className="px-5 pb-5 pt-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setError(null) }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    const addable = searchResults.filter(p => !p.is_pending_add && !p.is_just_added)
                                    if (addable.length === 1) {
                                        handleAddExisting(addable[0])
                                    }
                                }
                            }}
                            placeholder="Search by player name..."
                            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />

                        {searchQuery.trim().length >= 2 && (
                            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10">
                                {searchResults.length === 0 ? (
                                    <div className="px-3 py-4 text-center text-xs text-[var(--color-text-secondary)]">
                                        No free agents found for "{searchQuery}". Try the "Create New" tab.
                                    </div>
                                ) : (
                                    searchResults.map(player => {
                                        const isAdded = player.is_just_added || player.is_pending_add
                                        return (
                                            <button
                                                key={player.player_id}
                                                onClick={() => handleAddExisting(player)}
                                                disabled={isAnyLoading || isAdded}
                                                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors border-b border-white/5 last:border-b-0 ${
                                                    isAdded
                                                        ? 'opacity-60 cursor-default'
                                                        : 'hover:bg-[var(--color-accent)]/10 cursor-pointer'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="min-w-0">
                                                        <span className="text-[var(--color-text)] block truncate">{player.name}</span>
                                                        {player.discord_name && (
                                                            <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60 block truncate">{player.discord_name}</span>
                                                        )}
                                                    </div>
                                                    {player.main_role && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--color-text-secondary)] shrink-0">
                                                            {player.main_role}
                                                        </span>
                                                    )}
                                                </div>
                                                {isAdded ? (
                                                    <span className="text-[10px] text-green-400 font-semibold shrink-0">✓ Added</span>
                                                ) : (
                                                    <span className="text-[10px] text-[var(--color-accent)] font-semibold shrink-0">+ ADD</span>
                                                )}
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        )}

                        {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                            <p className="mt-2 text-xs text-[var(--color-text-secondary)] text-center">
                                Type at least 2 characters to search
                            </p>
                        )}
                    </div>
                )}

                {/* Create mode */}
                {mode === 'create' && (
                    <div className="px-5 pb-5 pt-2">
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                            Player Name
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={newPlayerName}
                            onChange={e => { setNewPlayerName(e.target.value); setError(null) }}
                            onKeyDown={e => e.key === 'Enter' && handleCreateNew()}
                            placeholder="Enter new player name..."
                            className="w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/50 mb-4"
                            style={{
                                backgroundColor: 'var(--color-primary)',
                                color: 'var(--color-text)',
                                borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />

                        <button
                            onClick={handleCreateNew}
                            disabled={isAnyLoading || !newPlayerName.trim()}
                            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                        >
                            {isAnyLoading ? 'Creating...' : `Create & Add to ${teamName}`}
                        </button>
                    </div>
                )}

                {/* Queued players list */}
                {addedIds.size > 0 && (
                    <div className="border-t border-white/10">
                        <div className="px-5 pt-3 pb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                Queued ({addedIds.size})
                            </span>
                        </div>
                        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                            {[...addedIds].map(pid => {
                                const p = globalPlayers.find(g => g.player_id === pid)
                                return p ? (
                                    <span
                                        key={pid}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[11px] text-green-400"
                                    >
                                        <span className="text-green-400/70">✓</span>
                                        {p.name}
                                    </span>
                                ) : null
                            })}
                        </div>
                        <div className="px-5 pb-3 flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-accent)] text-[var(--color-primary)] hover:opacity-90 transition-opacity"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
