// src/pages/admin/roster/PlayerRow.jsx
import { useState, useEffect, useRef } from 'react'
import { Crown } from 'lucide-react'
import { RoleBadge } from './RoleBadge'

export function PlayerRow({ player, teamId, teamName, teamColor, isDragOverTarget, hasDraggedPlayer, isLoading, onDragStart, onDragEnd, onDropOnPlayer, onSetDragOverPlayer, onRoleChange, onSetCaptain, onDropPlayer, onPromoteSub, onRemovePendingAdd, onManageAliases, onRenamePlayer }) {
    const [showActions, setShowActions] = useState(false)
    const actionsRef = useRef(null)
    const isPending = player.is_pending

    useEffect(() => {
        if (!showActions) return
        const handler = (e) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target)) {
                setShowActions(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [showActions])

    return (
        <div
            className={`group relative flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all ${
                isPending ? 'border border-dashed border-green-500/30 bg-green-500/5' :
                isLoading ? 'opacity-50 pointer-events-none' :
                isDragOverTarget && hasDraggedPlayer ? 'bg-blue-500/15 ring-1 ring-blue-400/40' :
                'hover:bg-white/5'
            } ${isPending ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
            draggable={!isLoading && !isPending}
            onDragStart={(e) => onDragStart(e, player, teamId)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move' }}
            onDragEnter={(e) => { e.stopPropagation(); onSetDragOverPlayer(player.league_player_id) }}
            onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                    onSetDragOverPlayer(null)
                }
            }}
            onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onSetDragOverPlayer(null)
                onDropOnPlayer(player)
            }}
        >
            {/* Drag handle indicator */}
            <div className="w-4 flex flex-col items-center gap-[2px] opacity-0 group-hover:opacity-40 transition-opacity shrink-0">
                <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
                <span className="w-1 h-1 rounded-full bg-[var(--color-text)]" />
            </div>

            {/* Captain crown */}
            {!isPending && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        if (player.roster_status !== 'captain') {
                            onSetCaptain(player.league_player_id, player.name, teamId)
                        }
                    }}
                    className={`shrink-0 transition-all ${
                        player.roster_status === 'captain'
                            ? 'text-yellow-400 opacity-100'
                            : 'text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-30 hover:!opacity-70 hover:!text-yellow-400'
                    }`}
                    title={player.roster_status === 'captain' ? 'Team Captain' : 'Set as Captain'}
                >
                    <Crown className="w-4 h-4" />
                </button>
            )}

            {/* Player name */}
            <span className="text-sm text-[var(--color-text)] flex-1 truncate" title={player.name}>
                {player.name}
            </span>

            {/* Role badge */}
            <RoleBadge
                role={player.role}
                leaguePlayerId={player.league_player_id}
                playerName={player.name}
                onRoleChange={onRoleChange}
            />

            {/* Actions menu */}
            <div className="relative" ref={actionsRef}>
                <button
                    onClick={() => setShowActions(!showActions)}
                    className="w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/10 transition-all text-xs"
                >
                    ⋮
                </button>

                {showActions && (
                    <div
                        className="absolute right-0 top-full mt-1 z-40 w-40 rounded-lg border shadow-xl overflow-hidden"
                        style={{
                            backgroundColor: 'var(--color-primary)',
                            borderColor: 'rgba(255,255,255,0.1)',
                        }}
                    >
                        {isPending ? (
                            <button
                                onClick={() => {
                                    setShowActions(false)
                                    onRemovePendingAdd(player.player_id, player.name)
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                            >
                                <span>✕</span> Remove
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        setShowActions(false)
                                        onRenamePlayer(player.player_id, player.name)
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-white/5 transition-colors flex items-center gap-2"
                                >
                                    <span>✏</span> Rename
                                </button>
                                <button
                                    onClick={() => {
                                        setShowActions(false)
                                        onManageAliases(player.player_id, player.name)
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-white/5 transition-colors flex items-center gap-2"
                                >
                                    <span>↔</span> Manage Aliases
                                </button>
                                {player.roster_status === 'sub' && (
                                    <button
                                        onClick={() => {
                                            setShowActions(false)
                                            onPromoteSub(player.league_player_id, player.name, teamName)
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs text-green-400 hover:bg-green-500/10 transition-colors flex items-center gap-2"
                                    >
                                        <span>↑</span> Promote to Member
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowActions(false)
                                        onDropPlayer(player.league_player_id, player.name, teamName)
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                >
                                    <span>🚫</span> Drop from Roster
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Loading spinner */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--color-secondary)]/80">
                    <div className="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    )
}
