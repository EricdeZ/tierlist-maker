import { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { ROLE_IMAGES, ROLE_LIST } from './constants'
import { NumCell } from './FormControls'
import { GodAutocomplete } from './GodAutocomplete'
import { AliasLinkModal } from './AliasLinkModal'


// ═══════════════════════════════════════════════════
// ROLE ICON (draggable role badge with click-to-cycle)
// ═══════════════════════════════════════════════════
function RoleIcon({ role, playerIdx, onRoleSelect, onDragStart, onDrop, isDragSource }) {
    const [showPicker, setShowPicker] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!showPicker) return
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowPicker(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showPicker])

    const img = role ? ROLE_IMAGES[role] : null

    return (
        <div
            ref={ref}
            className={`relative flex items-center justify-center ${isDragSource ? 'opacity-40' : ''}`}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(playerIdx))
                onDragStart(playerIdx)
            }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDrop={(e) => { e.preventDefault(); onDrop(playerIdx) }}
            onDragEnd={() => onDragStart(null)}
        >
            <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/10 transition-colors cursor-grab active:cursor-grabbing"
                title={role ? `${role} — drag to swap, click to change` : 'Click to set role, drag to swap'}
            >
                {img ? (
                    <img src={img} alt={role} className="w-5 h-5 object-contain" draggable={false} />
                ) : (
                    <span className="text-[10px] text-[var(--color-text-secondary)]/50">{'\u2014'}</span>
                )}
            </button>

            {showPicker && (
                <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 flex gap-0.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-xl p-1">
                    {ROLE_LIST.map(r => (
                        <button
                            key={r}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                                onRoleSelect(role === r ? null : r)
                                setShowPicker(false)
                            }}
                            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                                role === r ? 'bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)]' : 'hover:bg-white/10'
                            }`}
                            title={r}
                        >
                            <img src={ROLE_IMAGES[r]} alt={r} className="w-5 h-5 object-contain" draggable={false} />
                        </button>
                    ))}
                    {role && (
                        <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { onRoleSelect(null); setShowPicker(false) }}
                            className="w-7 h-7 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all text-xs font-bold"
                            title="Clear role"
                        >
                            {'\u00d7'}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}


// ═══════════════════════════════════════════════════
// PLAYER ROW (inline editing + DB name search)
// ═══════════════════════════════════════════════════
function PlayerRow({ player, playerIdx, seasonId, adminData, usedLpIds, usedNames, onChange, onRoleSelect, onRoleDragStart, onRoleDrop, isDragSource }) {
    const [showSearch, setShowSearch] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showAliasModal, setShowAliasModal] = useState(false)
    const originalExtractedName = player.original_name || player.player_name
    const searchRef = useRef(null)
    const inputRef = useRef(null)

    // Close dropdown on outside click
    useEffect(() => {
        if (!showSearch) return
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearch(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showSearch])

    // Build search results
    // On focus (empty query): show all season roster players
    // While typing: filter by typed text across roster + global
    // Always exclude players already assigned in this game
    const searchResults = (() => {
        if (!showSearch || !adminData) return []
        const q = searchQuery.trim().toLowerCase()
        const results = []
        const seen = new Set()

        // This player's own ID shouldn't be excluded (so they can re-select themselves)
        const selfLpId = player.matched_lp_id
        const selfName = player.player_name?.toLowerCase()

        // Get season roster — if seasonId is set filter by it, otherwise show all
        const seasonPlayers = seasonId
            ? (adminData.players || []).filter(p => String(p.season_id) === String(seasonId))
            : (adminData.players || [])

        for (const p of seasonPlayers) {
            if (seen.has(p.league_player_id)) continue

            // Skip if already used by another row in this game
            const isUsedById = p.league_player_id && usedLpIds?.has(p.league_player_id) && p.league_player_id !== selfLpId
            const isUsedByName = usedNames?.has(p.name.toLowerCase()) && p.name.toLowerCase() !== selfName
            if (isUsedById || isUsedByName) continue

            // If no query, show all roster. If query, filter by it.
            if (!q || p.name.toLowerCase().includes(q)) {
                seen.add(p.league_player_id)
                results.push({
                    name: p.name,
                    league_player_id: p.league_player_id,
                    team_name: p.team_name,
                    team_color: p.team_color,
                    role: p.role,
                    source: 'roster',
                })
            }
        }

        // Global players only when actively searching (not on blank focus)
        if (q.length >= 2) {
            const globalPlayers = adminData.globalPlayers || []
            for (const p of globalPlayers) {
                const alreadyInResults = results.find(r => r.name.toLowerCase() === p.name.toLowerCase())
                const isUsedByName = usedNames?.has(p.name.toLowerCase()) && p.name.toLowerCase() !== selfName
                if (!alreadyInResults && !isUsedByName && p.name.toLowerCase().includes(q)) {
                    results.push({ name: p.name, player_id: p.player_id, league_player_id: null, source: 'global' })
                }
            }

            // Also search aliases
            const aliases = adminData.aliases || []
            for (const a of aliases) {
                if (!a.alias.toLowerCase().includes(q)) continue
                // Find the player this alias belongs to
                const rosterMatch = seasonPlayers.find(p => p.player_id === a.player_id)
                const globalMatch = globalPlayers.find(p => p.player_id === a.player_id)
                const alreadyInResults = results.find(r => r.name.toLowerCase() === (rosterMatch?.name || globalMatch?.name || '').toLowerCase())
                if (alreadyInResults) continue

                if (rosterMatch) {
                    const isUsedById = rosterMatch.league_player_id && usedLpIds?.has(rosterMatch.league_player_id) && rosterMatch.league_player_id !== selfLpId
                    if (!isUsedById) {
                        results.push({
                            name: rosterMatch.name,
                            league_player_id: rosterMatch.league_player_id,
                            team_name: rosterMatch.team_name,
                            team_color: rosterMatch.team_color,
                            role: rosterMatch.role,
                            source: 'alias',
                            alias_matched: a.alias,
                        })
                    }
                } else if (globalMatch) {
                    results.push({ name: globalMatch.name, player_id: globalMatch.player_id, league_player_id: null, source: 'alias', alias_matched: a.alias })
                }
            }
        }

        return results.slice(0, 12)
    })()

    const isMatched = !!player.matched_lp_id

    const openSearch = () => {
        setSearchQuery('') // blank = show full roster
        setShowSearch(true)
    }

    return (
        <tr className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-card)]/30">
            {/* Player name with search */}
            <td className="py-1.5 pr-2">
                <div className="relative" ref={searchRef}>
                    <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMatched ? 'bg-green-400' : 'bg-yellow-400'}`} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={showSearch ? searchQuery : player.player_name}
                            onChange={e => {
                                const val = e.target.value
                                setSearchQuery(val)
                                setShowSearch(true)
                                // Also update the actual player name live
                                onChange({ player_name: val, matched_name: null, matched_lp_id: null })
                            }}
                            onFocus={openSearch}
                            onKeyDown={e => {
                                if (e.key === 'Escape') { setShowSearch(false); inputRef.current?.blur() }
                                if (e.key === 'Tab') setShowSearch(false)
                            }}
                            placeholder="Search player..."
                            className={`bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)] outline-none w-full text-xs transition-colors ${
                                isMatched ? 'text-green-400' : 'text-yellow-400'
                            } placeholder:text-[var(--color-text-secondary)]/40`}
                        />
                        {/* Small search icon / clear button */}
                        {isMatched && !showSearch && (
                            <span className="text-green-400 text-[10px] shrink-0">{'\u2713'}</span>
                        )}
                    </div>
                    {isMatched && player.matched_name && player.matched_name !== player.player_name && !showSearch && (
                        <div className="text-[10px] text-[var(--color-text-secondary)] pl-3 truncate">{'\u2192'} {player.matched_name}</div>
                    )}
                    {player.is_sub && !isMatched && !showSearch && (
                        <>
                            <span className="text-[9px] ml-3 px-1 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">
                                {player.sub_type === 'new' ? 'NEW RULE 0-SUB' : 'RULE 0-SUB'}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAliasModal(true) }}
                                className="text-[9px] ml-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors font-semibold"
                                title={`Link "${originalExtractedName}" as alias for an existing player`}
                            >
                                Link Alias
                            </button>
                        </>
                    )}

                    {/* Alias match indicator — shown when auto-matched via alias */}
                    {player.match_source === 'alias' && isMatched && !showSearch && (
                        <span className="text-[9px] ml-3 px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold">
                            via alias{player.matched_alias ? `: "${player.matched_alias}"` : ''}
                        </span>
                    )}

                    {/* Search dropdown */}
                    {showSearch && searchResults.length > 0 && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-72 border rounded shadow-xl max-h-56 overflow-y-auto"
                             style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                            {searchQuery === '' && (
                                <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)] border-b border-[var(--color-border)]/50 sticky top-0"
                                     style={{ backgroundColor: 'var(--color-card, #1e1e2e)' }}>
                                    {seasonId ? 'Season roster \u2014 type to filter' : 'All players \u2014 select season to filter'}
                                </div>
                            )}
                            {searchResults.map((r, i) => (
                                <button key={`${r.league_player_id || r.player_id}_${i}`}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-accent)]/10 flex items-center gap-2 transition-colors"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => {
                                            onChange({
                                                player_name: r.name,
                                                matched_name: r.name,
                                                matched_lp_id: r.league_player_id,
                                                is_sub: false,
                                                sub_type: null,
                                            })
                                            setShowSearch(false)
                                            setSearchQuery('')
                                        }}>
                                    {r.team_color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: r.team_color }} />}
                                    <span className="text-[var(--color-text)]">{r.name}</span>
                                    {r.role && <span className="text-[10px] text-[var(--color-text-secondary)] opacity-60">{r.role === 'Sub' ? 'Rule 0-Sub' : r.role}</span>}
                                    {r.team_name && <span className="text-[var(--color-text-secondary)] ml-auto text-[10px]">{r.team_name}</span>}
                                    {r.source === 'global' && <span className="text-yellow-400/60 ml-auto text-[10px]">global</span>}
                                    {r.source === 'alias' && <span className="text-blue-400/60 ml-auto text-[10px]">alias: {r.alias_matched}</span>}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* No results hint */}
                    {showSearch && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <div className="absolute z-50 top-full left-0 mt-1 w-64 border rounded shadow-lg px-3 py-2 text-[10px] text-[var(--color-text-secondary)]"
                             style={{ backgroundColor: 'var(--color-card, #1e1e2e)', borderColor: 'var(--color-border, #333)' }}>
                            No players found for "{searchQuery}" {'\u2014'} will be created as Rule 0-Sub on submit
                        </div>
                    )}
                </div>
            </td>

            <td className="py-1.5 pr-2">
                <RoleIcon
                    role={player.role_played}
                    playerIdx={playerIdx}
                    onRoleSelect={onRoleSelect}
                    onDragStart={onRoleDragStart}
                    onDrop={onRoleDrop}
                    isDragSource={isDragSource}
                />
            </td>
            <td className="py-1.5 pr-2">
                <GodAutocomplete value={player.god_played || ''} gods={adminData?.gods} onChange={updates => onChange(updates)} />
            </td>
            <NumCell value={player.kills} onChange={v => onChange({ kills: v })} />
            <NumCell value={player.deaths} onChange={v => onChange({ deaths: v })} />
            <NumCell value={player.assists} onChange={v => onChange({ assists: v })} />
            <NumCell value={player.player_damage} onChange={v => onChange({ player_damage: v })} align="right" />
            <NumCell value={player.mitigated} onChange={v => onChange({ mitigated: v })} align="right" />

            {/* Alias link modal — rendered via portal to avoid table nesting issues */}
            {showAliasModal && ReactDOM.createPortal(
                <AliasLinkModal
                    extractedName={originalExtractedName}
                    adminData={adminData}
                    seasonId={seasonId}
                    onSave={(selectedPlayer) => {
                        onChange({
                            player_name: selectedPlayer.name,
                            matched_name: selectedPlayer.name,
                            matched_lp_id: selectedPlayer.league_player_id,
                            match_source: 'alias',
                            matched_alias: originalExtractedName,
                            is_sub: false,
                            sub_type: null,
                        })
                        setShowAliasModal(false)
                    }}
                    onClose={() => setShowAliasModal(false)}
                />,
                document.body
            )}
        </tr>
    )
}


// ═══════════════════════════════════════════════════
// PLAYER TABLE
// ═══════════════════════════════════════════════════
export function PlayerTable({ label, color, players, allGamePlayers, seasonId, adminData, onUpdatePlayer, isWinner }) {
    // Collect all matched league_player_ids already used in this game (both sides)
    const usedLpIds = new Set()
    const usedNames = new Set()
    for (const p of (allGamePlayers || [])) {
        if (p.matched_lp_id) usedLpIds.add(p.matched_lp_id)
        if (p.player_name) usedNames.add(p.player_name.toLowerCase())
    }

    // Drag-and-drop role swap between players in this team
    const [dragSource, setDragSource] = useState(null)

    const handleRoleDragStart = (playerIdx) => {
        setDragSource(playerIdx)
    }

    const handleRoleDrop = (targetIdx) => {
        if (dragSource === null || dragSource === targetIdx) { setDragSource(null); return }
        const sourceRole = players[dragSource]?.role_played || null
        const targetRole = players[targetIdx]?.role_played || null
        // Swap roles
        onUpdatePlayer(dragSource, { role_played: targetRole })
        onUpdatePlayer(targetIdx, { role_played: sourceRole })
        setDragSource(null)
    }

    // Click-to-pick with swap enforcement — each role at most once per team
    const handleRoleSelect = (playerIdx, newRole) => {
        if (!newRole) {
            onUpdatePlayer(playerIdx, { role_played: null })
            return
        }
        // If another player on this team already has this role, swap
        const conflictIdx = players.findIndex((p, i) => i !== playerIdx && p.role_played === newRole)
        if (conflictIdx !== -1) {
            const currentRole = players[playerIdx]?.role_played || null
            onUpdatePlayer(conflictIdx, { role_played: currentRole })
        }
        onUpdatePlayer(playerIdx, { role_played: newRole })
    }

    return (
        <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                <span className="text-xs font-semibold text-[var(--color-text)]">{label}</span>
                {isWinner && <span className="text-xs text-green-400">{'\u2713'} Winner</span>}
            </div>
            <table className="w-full text-xs">
                <thead>
                <tr className="text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                    <th className="text-left py-1 pr-2 font-medium min-w-[140px]">Player</th>
                    <th className="text-center py-1 pr-2 font-medium w-10">Role</th>
                    <th className="text-left py-1 pr-2 font-medium min-w-[80px]">God</th>
                    <th className="text-center py-1 px-1 font-medium w-8">K</th>
                    <th className="text-center py-1 px-1 font-medium w-8">D</th>
                    <th className="text-center py-1 px-1 font-medium w-8">A</th>
                    <th className="text-right py-1 px-1 font-medium w-14">Dmg</th>
                    <th className="text-right py-1 px-1 font-medium w-14">Mit</th>
                </tr>
                </thead>
                <tbody>
                {(players || []).map((player, idx) => (
                    <PlayerRow key={idx} player={player} playerIdx={idx} seasonId={seasonId} adminData={adminData}
                               usedLpIds={usedLpIds} usedNames={usedNames}
                               onChange={(updates) => onUpdatePlayer(idx, updates)}
                               onRoleSelect={(newRole) => handleRoleSelect(idx, newRole)}
                               onRoleDragStart={handleRoleDragStart}
                               onRoleDrop={handleRoleDrop}
                               isDragSource={dragSource === idx} />
                ))}
                </tbody>
            </table>
        </div>
    )
}
