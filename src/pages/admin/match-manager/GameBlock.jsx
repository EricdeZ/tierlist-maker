import { useState, useEffect, useRef } from 'react'
import { ROLE_IMAGES, ROLE_LIST } from './constants'
import { NumInput, WinnerBtn } from './shared'
import GodAutocomplete from './GodAutocomplete'
import PlayerSwap from './PlayerSwap'


export default function GameBlock({ game, gameIdx, matchId, team1_id, team2_id, team1_name, team2_name, team1_color, team2_color, gods, adminData, saving, onSave, onDelete, onEditGame, onEditPlayer }) {
    return (
        <div className="border-t border-[var(--color-border)]">
            {/* Winner + actions */}
            <div className="px-4 py-3 flex items-center gap-4 bg-[var(--color-card)]/50">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">Winner:</span>
                <div className="flex gap-2">
                    <WinnerBtn label={team1_name} color={team1_color || '#3b82f6'}
                               isActive={game.winner_team_id === team1_id}
                               onClick={() => onEditGame({ winner_team_id: team1_id })} />
                    <WinnerBtn label={team2_name} color={team2_color || '#ef4444'}
                               isActive={game.winner_team_id === team2_id}
                               onClick={() => onEditGame({ winner_team_id: team2_id })} />
                </div>
                <div className="ml-auto flex gap-2">
                    <button onClick={onSave} disabled={saving}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Game'}
                    </button>
                    <button onClick={onDelete}
                            className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20">
                        Delete Game
                    </button>
                </div>
            </div>

            {/* Player tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--color-border)]">
                <StatsTable
                    label={team1_name}
                    color={team1_color || '#3b82f6'}
                    players={game.team1_players || []}
                    teamSide={1}
                    gods={gods}
                    adminData={adminData}
                    onUpdate={(idx, updates) => onEditPlayer(1, idx, updates)}
                    isWinner={game.winner_team_id === team1_id}
                />
                <StatsTable
                    label={team2_name}
                    color={team2_color || '#ef4444'}
                    players={game.team2_players || []}
                    teamSide={2}
                    gods={gods}
                    adminData={adminData}
                    onUpdate={(idx, updates) => onEditPlayer(2, idx, updates)}
                    isWinner={game.winner_team_id === team2_id}
                />
            </div>
        </div>
    )
}


function StatsTable({ label, color, players, teamSide, gods, adminData, onUpdate, isWinner }) {
    const handleRoleSelect = (playerIdx, newRole) => {
        if (!newRole) {
            onUpdate(playerIdx, { role_played: null })
            return
        }
        const conflictIdx = players.findIndex((p, i) => i !== playerIdx && p.role_played === newRole)
        if (conflictIdx !== -1) {
            const currentRole = players[playerIdx]?.role_played || null
            onUpdate(conflictIdx, { role_played: currentRole })
        }
        onUpdate(playerIdx, { role_played: newRole })
    }

    return (
        <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className={`text-xs font-bold ${isWinner ? 'text-[var(--color-text)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {label} {isWinner && '\u2714'}
                </span>
            </div>
            <div>
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-[var(--color-text-secondary)] text-[10px]">
                            <th className="text-left py-1 pr-2 min-w-[90px]">Player</th>
                            <th className="text-left py-1 pr-2 w-16">Role</th>
                            <th className="text-left py-1 pr-2 min-w-[90px]">God</th>
                            <th className="text-center py-1 px-1 w-10">K</th>
                            <th className="text-center py-1 px-1 w-10">D</th>
                            <th className="text-center py-1 px-1 w-10">A</th>
                            <th className="text-right py-1 px-1 w-14">Dmg</th>
                            <th className="text-right py-1 px-1 w-14">Mit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {players.map((player, idx) => (
                            <StatRow key={player.stat_id || idx}
                                     player={player}
                                     gods={gods}
                                     adminData={adminData}
                                     onChange={(updates) => onUpdate(idx, updates)}
                                     onRoleSelect={(newRole) => handleRoleSelect(idx, newRole)} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}


function StatRow({ player, gods, adminData, onChange, onRoleSelect }) {
    const [showRolePicker, setShowRolePicker] = useState(false)
    const roleRef = useRef(null)

    useEffect(() => {
        if (!showRolePicker) return
        const handler = (e) => { if (roleRef.current && !roleRef.current.contains(e.target)) setShowRolePicker(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showRolePicker])

    const roleImg = player.role_played ? ROLE_IMAGES[player.role_played] : null

    return (
        <tr className="border-t border-[var(--color-border)]/30">
            <td className="py-1.5 pr-2">
                <PlayerSwap player={player} adminData={adminData} onChange={onChange} />
            </td>
            <td className="py-1.5 pr-2">
                <div ref={roleRef} className="relative flex items-center justify-center">
                    <button
                        type="button"
                        onClick={() => setShowRolePicker(!showRolePicker)}
                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
                        title={player.role_played || 'Set role'}
                    >
                        {roleImg ? (
                            <img src={roleImg} alt={player.role_played} className="w-5 h-5 object-contain" />
                        ) : (
                            <span className="text-[10px] text-[var(--color-text-secondary)]/50">—</span>
                        )}
                    </button>
                    {showRolePicker && (
                        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 flex gap-0.5 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-xl p-1">
                            {ROLE_LIST.map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => { onRoleSelect(player.role_played === r ? null : r); setShowRolePicker(false) }}
                                    className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                                        player.role_played === r ? 'bg-[var(--color-accent)]/20 ring-1 ring-[var(--color-accent)]' : 'hover:bg-white/10'
                                    }`}
                                    title={r}
                                >
                                    <img src={ROLE_IMAGES[r]} alt={r} className="w-5 h-5 object-contain" />
                                </button>
                            ))}
                            {player.role_played && (
                                <button
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => { onRoleSelect(null); setShowRolePicker(false) }}
                                    className="w-7 h-7 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all text-xs font-bold"
                                    title="Clear role"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </td>
            <td className="py-1.5 pr-2">
                <GodAutocomplete value={player.god_played || ''} gods={gods} onChange={updates => onChange(updates)} />
            </td>
            <NumInput value={player.kills} onChange={v => onChange({ kills: v })} />
            <NumInput value={player.deaths} onChange={v => onChange({ deaths: v })} />
            <NumInput value={player.assists} onChange={v => onChange({ assists: v })} />
            <NumInput value={player.damage} onChange={v => onChange({ damage: v })} align="right" />
            <NumInput value={player.mitigated} onChange={v => onChange({ mitigated: v })} align="right" />
        </tr>
    )
}
